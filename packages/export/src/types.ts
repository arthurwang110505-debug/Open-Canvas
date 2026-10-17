/** Why an export could not be produced. Every failure is returned, never thrown. */
export type ExportErrorCode =
  | 'page-not-found'
  | 'asset-missing'
  | 'image-resolver-required'
  | 'image-failed'
  | 'raster-failed'
  | 'raster-too-large'
  | 'pdf-failed';

export interface ExportError {
  code: ExportErrorCode;
  message: string;
  cause?: unknown;
}

export function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
