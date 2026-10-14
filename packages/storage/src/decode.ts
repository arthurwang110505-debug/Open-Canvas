export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Decodes an image blob far enough to learn its pixel size. Rejects when the browser cannot
 * decode the data (corrupt file, unsupported codec).
 */
export type ImageDecoder = (blob: Blob) => Promise<ImageDimensions>;

function decodeWithImageElement(blob: Blob): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };
    image.onload = () => {
      cleanup();
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('The browser could not decode this image.'));
    };
    image.src = url;
  });
}

/**
 * Browser decoder: prefers `createImageBitmap` (off-main-thread, no DOM) and falls back to an
 * `<img>` element where it is unavailable.
 */
export const browserImageDecoder: ImageDecoder = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }
  return decodeWithImageElement(blob);
};
