/**
 * Hard limits for the document format. They protect the editor, exporters and
 * AI validation from pathological input (huge canvases, millions of elements, ...).
 */
export const CURRENT_SCHEMA_VERSION = 12 as const;

export const LIMITS = {
  /** Maximum canvas edge length in pixels (browser canvases degrade well before this). */
  maxCanvasDimension: 16_384,
  minCanvasDimension: 1,
  /** Coordinates may live outside the page (partially visible elements), but stay bounded. */
  maxCoordinate: 100_000,
  maxElementDimension: 100_000,
  minElementDimension: 1,
  maxElementsPerPage: 2_000,
  maxGuidesPerPage: 64,
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
  // --- Canva-parity sizes added in Sprint 4 ---
  { id: 'tiktok-video', label: 'TikTok video', category: 'video', width: 1080, height: 1920 },
  { id: 'pinterest-pin', label: 'Pinterest Pin', category: 'social', width: 1000, height: 1500 },
  { id: 'linkedin-post', label: 'LinkedIn post', category: 'social', width: 1200, height: 627 },
  { id: 'facebook-story', label: 'Facebook story', category: 'social', width: 1080, height: 1920 },
  { id: 'youtube-banner', label: 'YouTube banner', category: 'video', width: 2560, height: 1440 },
  { id: 'poster-a5', label: 'Poster A5 (300 dpi)', category: 'print', width: 1748, height: 2480 },
  {
    id: 'instagram-landscape',
    label: 'Instagram landscape',
    category: 'social',
    width: 1080,
    height: 566,
  },
  { id: 'x-header', label: 'X header', category: 'social', width: 1500, height: 500 },
  {
    id: 'presentation-4-3',
    label: 'Presentation (4:3)',
    category: 'presentation',
    width: 1600,
    height: 1200,
  },
  { id: 'facebook-cover', label: 'Facebook cover', category: 'social', width: 820, height: 312 },
  // --- Canva-parity sizes added in Sprint 8 ---
  { id: 'logo', label: 'Logo', category: 'print', width: 500, height: 500 },
  { id: 'poster-a3', label: 'Poster A3 (300 dpi)', category: 'print', width: 3508, height: 4961 },
  { id: 'postcard', label: 'Postcard (6 × 4 in)', category: 'print', width: 1800, height: 1200 },
  { id: 'resume', label: 'Resume (US Letter)', category: 'print', width: 2550, height: 3300 },
  {
    id: 'invitation',
    label: 'Invitation (5 × 7 in)',
    category: 'print',
    width: 1500,
    height: 2100,
  },
  {
    id: 'video-background',
    label: 'Video call background',
    category: 'video',
    width: 1920,
    height: 1080,
  },
];

export const DEFAULT_PRESET: CanvasPreset = INSTAGRAM_POST_PRESET;
