/**
 * Hard limits for the document format. They protect the editor, exporters and
 * AI validation from pathological input (huge canvases, millions of elements, ...).
 */
export const CURRENT_SCHEMA_VERSION = 1 as const;

export const LIMITS = {
  /** Maximum canvas edge length in pixels (browser canvases degrade well before this). */
  maxCanvasDimension: 16_384,
  minCanvasDimension: 1,
  /** Coordinates may live outside the page (partially visible elements), but stay bounded. */
  maxCoordinate: 100_000,
  maxElementDimension: 100_000,
  minElementDimension: 1,
  maxElementsPerPage: 2_000,
  maxPages: 100,
  maxTextLength: 20_000,
  maxNameLength: 200,
  maxIdLength: 64,
  maxStrokeWidth: 1_000,
  maxFontSize: 2_000,
  minFontSize: 1,
} as const;

export interface CanvasPreset {
  id: string;
  label: string;
  category: 'social' | 'print' | 'presentation' | 'video';
  width: number;
  height: number;
}

const INSTAGRAM_POST_PRESET: CanvasPreset = {
  id: 'instagram-post',
  label: 'Instagram post',
  category: 'social',
  width: 1080,
  height: 1080,
};

/** Common starting sizes offered when creating a blank document. */
export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  INSTAGRAM_POST_PRESET,
  { id: 'instagram-story', label: 'Instagram story', category: 'social', width: 1080, height: 1920 },
  { id: 'facebook-post', label: 'Facebook post', category: 'social', width: 1200, height: 630 },
  { id: 'x-post', label: 'X / Twitter post', category: 'social', width: 1600, height: 900 },
  { id: 'youtube-thumbnail', label: 'YouTube thumbnail', category: 'video', width: 1280, height: 720 },
  { id: 'presentation-16-9', label: 'Presentation (16:9)', category: 'presentation', width: 1920, height: 1080 },
  { id: 'poster-a4', label: 'Poster A4 (300 dpi)', category: 'print', width: 2480, height: 3508 },
  { id: 'business-card', label: 'Business card', category: 'print', width: 1050, height: 600 },
];

export const DEFAULT_PRESET: CanvasPreset = INSTAGRAM_POST_PRESET;
