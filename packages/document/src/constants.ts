/**
 * Hard limits for the document format. They protect the editor, exporters and
 * AI validation from pathological input (huge canvases, millions of elements, ...).
 */
export const CURRENT_SCHEMA_VERSION = 9 as const;

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
  /** Largest raster asset edge we accept (decoders and GPUs struggle beyond this). */
  maxAssetDimension: 32_768,
  /** Upload size cap for a single image asset. */
  maxAssetBytes: 25 * 1024 * 1024,
  maxAssetsPerDocument: 500,
  maxUrlLength: 2_048,
  maxPathPoints: 2_000,
} as const;

/** Raster formats every supported browser can decode and draw to a canvas. */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

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
  {
    id: 'instagram-story',
    label: 'Instagram story',
    category: 'social',
    width: 1080,
    height: 1920,
  },
  { id: 'facebook-post', label: 'Facebook post', category: 'social', width: 1200, height: 630 },
  { id: 'x-post', label: 'X / Twitter post', category: 'social', width: 1600, height: 900 },
  {
    id: 'youtube-thumbnail',
    label: 'YouTube thumbnail',
    category: 'video',
    width: 1280,
    height: 720,
  },
  {
    id: 'presentation-16-9',
    label: 'Presentation (16:9)',
    category: 'presentation',
    width: 1920,
    height: 1080,
  },
  { id: 'poster-a4', label: 'Poster A4 (300 dpi)', category: 'print', width: 2480, height: 3508 },
  { id: 'business-card', label: 'Business card', category: 'print', width: 1050, height: 600 },
];

export const DEFAULT_PRESET: CanvasPreset = INSTAGRAM_POST_PRESET;
