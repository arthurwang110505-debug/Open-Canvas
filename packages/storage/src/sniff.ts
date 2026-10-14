import type { SupportedImageMimeType } from '@opencanvas/document';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

/**
 * Identifies the image format from the first bytes of a file. The `type` a browser reports
 * for a `File` comes from the file extension and is trivially spoofed, so the stored
 * `mimeType` is always derived from the bytes.
 */
export function sniffImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

/** Number of leading bytes needed by `sniffImageMimeType`. */
export const SNIFF_BYTES = 16;
