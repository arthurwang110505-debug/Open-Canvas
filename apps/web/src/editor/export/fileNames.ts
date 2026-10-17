// eslint-disable-next-line no-control-regex -- control characters are exactly what a filename must not contain.
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/g;
const MAX_FILENAME_LENGTH = 80;

/**
 * A design name is user input, so it is reduced to something every file system accepts.
 * Empty results fall back to a generic name rather than producing ".png".
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(ILLEGAL_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
    .trimEnd();
  return cleaned.length > 0 ? cleaned : 'design';
}

export type ExportExtension = 'png' | 'svg' | 'pdf';

export function exportFileName(designName: string, extension: ExportExtension): string {
  return `${sanitizeFileName(designName)}.${extension}`;
}
