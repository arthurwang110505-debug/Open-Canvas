import type {
  EmbeddedFontFace,
  FontUsage,
  SvgRasterizer,
  TextMeasurer,
  VideoRecorderFactory,
} from '@opencanvas/export';

/**
 * The browser steps an export needs. They are injectable because jsdom has no canvas backend
 * and no file system, and because tests must be able to assert what was produced.
 */
export interface ExportServices {
  /** SVG string → PNG data URL. */
  rasterize: SvgRasterizer;
  /** Word wrapping metric for text; `undefined` exports hard line breaks only. */
  measureText?: TextMeasurer;
  /** Hands a finished file to the user. */
  download: (blob: Blob, filename: string) => void;
  /**
   * Resolves the fonts the exported pages use to embeddable bytes. A failure is surfaced as an
   * export error instead of silently rendering the wrong typeface.
   */
  resolveFontFaces: (usages: readonly FontUsage[]) => Promise<EmbeddedFontFace[]>;
  /**
   * Encodes rendered frames into a video file. Undefined in a browser that cannot record
   * (no `MediaRecorder`), which is why the download dialog asks before offering the format.
   */
  createVideoRecorder?: VideoRecorderFactory;
}
