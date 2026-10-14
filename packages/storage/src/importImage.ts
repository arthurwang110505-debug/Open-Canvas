import {
  LIMITS,
  SUPPORTED_IMAGE_MIME_TYPES,
  createImageAsset,
  err,
  ok,
  type ImageAsset,
  type Result,
  type SupportedImageMimeType,
} from '@opencanvas/document';

import { browserImageDecoder, type ImageDecoder } from './decode';
import { SNIFF_BYTES, sniffImageMimeType } from './sniff';

export interface ImportImageOptions {
  /** Upper bound on file size in bytes. Defaults to `LIMITS.maxAssetBytes`. */
  maxBytes?: number;
  /** Formats accepted after sniffing. Defaults to every supported raster format. */
  allowedTypes?: readonly SupportedImageMimeType[];
  /** Decoder used to learn the pixel size; injectable for tests and workers. */
  decode?: ImageDecoder;
  /** Asset id to use (generated when omitted). */
  assetId?: string;
  now?: Date;
}

export interface ImportedImage {
  asset: ImageAsset;
  /** Bytes to persist in an `AssetBlobStore` under `asset.id`. */
  blob: Blob;
}

export interface ImageImportError {
  code: 'empty' | 'too-large' | 'unsupported-type' | 'decode-failed' | 'too-large-dimensions';
  message: string;
}

const KIB = 1024;

function formatBytes(bytes: number): string {
  if (bytes >= KIB * KIB) return `${(bytes / (KIB * KIB)).toFixed(1)} MB`;
  if (bytes >= KIB) return `${Math.round(bytes / KIB)} KB`;
  return `${bytes} B`;
}

function describeTypes(types: readonly SupportedImageMimeType[]): string {
  return types.map((type) => type.replace('image/', '').toUpperCase()).join(', ');
}

/**
 * Validates and measures an image file so it can become a document asset. Validation never
 * trusts the reported `File.type`: the format is sniffed from the bytes and the dimensions
 * come from actually decoding the image.
 */
export async function importImageFile(
  file: Blob & { name?: string },
  options: ImportImageOptions = {},
): Promise<Result<ImportedImage, ImageImportError>> {
  const maxBytes = options.maxBytes ?? LIMITS.maxAssetBytes;
  const allowedTypes = options.allowedTypes ?? SUPPORTED_IMAGE_MIME_TYPES;
  const decode = options.decode ?? browserImageDecoder;

  if (file.size === 0) {
    return err({ code: 'empty', message: 'The file is empty.' });
  }
  if (file.size > maxBytes) {
    return err({
      code: 'too-large',
      message: `This file is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}.`,
    });
  }

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const mimeType = sniffImageMimeType(head);
  if (mimeType === null || !allowedTypes.includes(mimeType)) {
    return err({
      code: 'unsupported-type',
      message: `Unsupported image format. Use ${describeTypes(allowedTypes)}.`,
    });
  }

  let size: { width: number; height: number };
  try {
    size = await decode(file);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return err({ code: 'decode-failed', message: `The image could not be decoded: ${detail}` });
  }
  if (
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    size.width < 1 ||
    size.height < 1
  ) {
    return err({ code: 'decode-failed', message: 'The image reported an invalid size.' });
  }
  if (size.width > LIMITS.maxAssetDimension || size.height > LIMITS.maxAssetDimension) {
    return err({
      code: 'too-large-dimensions',
      message: `Images may be at most ${LIMITS.maxAssetDimension} pixels on each side (this one is ${size.width}×${size.height}).`,
    });
  }

  const name = typeof file.name === 'string' && file.name.length > 0 ? file.name : undefined;
  const asset = createImageAsset({
    ...(options.assetId !== undefined ? { id: options.assetId } : {}),
    ...(name !== undefined ? { name: name.slice(0, LIMITS.maxNameLength) } : {}),
    mimeType,
    width: size.width,
    height: size.height,
    byteSize: file.size,
    source: { type: 'local' },
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  // Normalise the blob type to the sniffed format so downstream consumers can trust it.
  const blob = file.type === mimeType ? file : file.slice(0, file.size, mimeType);
  return ok({ asset, blob });
}
