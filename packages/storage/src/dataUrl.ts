/**
 * Base64 `data:` URL helpers. Object URLs are session-scoped and only meaningful inside the tab
 * that created them, so anything that has to travel (an exported SVG, a PDF, a shared file)
 * embeds bytes as a data URL instead.
 */

const BASE64_CHUNK = 0x8000;

function toBase64(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Embeds a blob's bytes as `data:<mime>;base64,…`. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type.length > 0 ? blob.type : 'application/octet-stream';
  return `data:${mime};base64,${toBase64(bytes)}`;
}

export interface DataUrl {
  mimeType: string;
  /** Typed as an `ArrayBuffer`-backed view so it can be handed straight to `new Blob(...)`. */
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Splits a base64 data URL. Returns `undefined` for anything that is not one, so callers can
 * reject remote references instead of fetching them.
 */
export function parseDataUrl(dataUrl: string): DataUrl | undefined {
  const match = /^data:([^;,]*)(;[^,]*)?,(.*)$/s.exec(dataUrl);
  if (!match) return undefined;
  const [, mimeType = '', params = '', payload = ''] = match;
  if (!params.includes('base64')) return undefined;
  return { mimeType: mimeType.length > 0 ? mimeType : 'text/plain', bytes: fromBase64(payload) };
}

/** Rebuilds a blob from a base64 data URL; `undefined` when the input is not one. */
export function dataUrlToBlob(dataUrl: string): Blob | undefined {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return undefined;
  return new Blob([parsed.bytes], { type: parsed.mimeType });
}
