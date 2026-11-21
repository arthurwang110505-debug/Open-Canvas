import { err, ok, type DesignDocument, type Page, type Result } from '@opencanvas/document';

import { elementsAnimationEnd, hasElementAnimations } from './animation';
import type { SvgRasterizer } from './raster';
import { renderPageToSvg, type ImageHrefResolver, type SvgPageOptions } from './svg';
import { describeCause, type ExportError } from './types';

/**
 * Turning a design's entrance animations into a video file.
 *
 * The document already describes the motion (`element.animation`) and `./animation.ts` can
 * evaluate it at any instant, so a video is a plan plus a loop: decide which page is on screen
 * at each frame time, render that frame as a still SVG, rasterize it, and hand it to a recorder.
 * The recorder is injected because encoding is a browser capability (`MediaRecorder`), which
 * keeps this module testable and keeps the encoder out of the document model.
 */

/** Frame rates offered to the user. 30 is smooth; 15 halves the work on slow machines. */
export const VIDEO_FPS_OPTIONS = [15, 30] as const;
export type VideoFps = (typeof VIDEO_FPS_OPTIONS)[number];
export const DEFAULT_VIDEO_FPS: VideoFps = 30;

/** Seconds a page stays on screen after its last entrance has finished. */
export const DEFAULT_VIDEO_HOLD = 1.2;

/** No page is shorter than this, so a page without animation is still readable in the video. */
export const MIN_PAGE_SECONDS = 2;

/**
 * Frames are rendered before they are recorded, so a long design would otherwise hold hundreds
 * of megabytes of image data. Past this the timeline is cut and the caller is told.
 */
export const MAX_VIDEO_SECONDS = 20;

/** Longest edge of the recorded frame, per quality. Canvas work scales with the square of this. */
export const VIDEO_QUALITY_EDGES = { standard: 1280, hd: 1920 } as const;
export type VideoQuality = keyof typeof VIDEO_QUALITY_EDGES;
export const DEFAULT_VIDEO_QUALITY: VideoQuality = 'standard';

export interface VideoFrameSize {
  width: number;
  height: number;
  /** Multiplier the rasterizer needs to reach that size from the document's own units. */
  scale: number;
}

/**
 * The pixel size of a recorded frame. Dimensions are even because video encoders subsample
 * chroma in 2×2 blocks and reject (or silently pad) odd sizes.
 */
export function videoFrameSize(
  size: { width: number; height: number },
  quality: VideoQuality = DEFAULT_VIDEO_QUALITY,
): VideoFrameSize {
  const edge = VIDEO_QUALITY_EDGES[quality];
  const longest = Math.max(size.width, size.height);
  const scale = longest > edge ? edge / longest : 1;
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: even(size.width), height: even(size.height), scale };
}

/** One page's slot in the video, in seconds from the start of the file. */
export interface VideoSegment {
  pageId: string;
  /** Seconds from the start of the video at which this page appears. */
  start: number;
  /** How long this page is on screen. */
  duration: number;
  /** When this page's last entrance finishes, relative to the page appearing. */
  animationEnd: number;
}

export interface VideoTimeline {
  fps: number;
  /** Total length in seconds. */
  duration: number;
  frameCount: number;
  segments: readonly VideoSegment[];
  /** True when pages were cut to stay inside `MAX_VIDEO_SECONDS`. */
  truncated: boolean;
  /** True when at least one included page has something that moves. */
  animated: boolean;
}

export interface VideoTimelineOptions {
  /** Pages to include, in order. Defaults to every page. */
  pageIds?: readonly string[];
  fps?: number;
  /** Seconds to hold a page after its last entrance. Defaults to `DEFAULT_VIDEO_HOLD`. */
  hold?: number;
  /** Overall cap. Defaults to `MAX_VIDEO_SECONDS`. */
  maxSeconds?: number;
}

function clampFps(fps: number | undefined): number {
  if (fps === undefined || !Number.isFinite(fps)) return DEFAULT_VIDEO_FPS;
  return Math.min(60, Math.max(1, Math.round(fps)));
}

function visibleElements(page: Page) {
  return page.elements.filter((element) => element.visible);
}

/**
 * Lays out the pages on a timeline. Each page runs until its slowest entrance has finished plus
 * a hold, never shorter than `MIN_PAGE_SECONDS`, and the whole thing is cut at `maxSeconds` so
 * the renderer cannot be asked for an unbounded number of frames.
 */
export function planVideoTimeline(
  document: DesignDocument,
  options: VideoTimelineOptions = {},
): Result<VideoTimeline, ExportError> {
  const ids = options.pageIds ?? document.pages.map((page) => page.id);
  const pages = ids
    .map((id) => document.pages.find((page) => page.id === id))
    .filter((page): page is Page => page !== undefined);
  if (pages.length === 0) {
    return err({ code: 'page-not-found', message: 'The document has no pages to record.' });
  }

  const fps = clampFps(options.fps);
  const hold =
    options.hold !== undefined && Number.isFinite(options.hold) && options.hold >= 0
      ? options.hold
      : DEFAULT_VIDEO_HOLD;
  const maxSeconds =
    options.maxSeconds !== undefined &&
    Number.isFinite(options.maxSeconds) &&
    options.maxSeconds > 0
      ? options.maxSeconds
      : MAX_VIDEO_SECONDS;

  const segments: VideoSegment[] = [];
  let start = 0;
  let truncated = false;
  let animated = false;

  for (const page of pages) {
    if (start >= maxSeconds) {
      truncated = true;
      break;
    }
    const elements = visibleElements(page);
    if (hasElementAnimations(elements)) animated = true;
    const animationEnd = elementsAnimationEnd(elements);
    const wanted = Math.max(MIN_PAGE_SECONDS, animationEnd + hold);
    const duration = Math.min(wanted, maxSeconds - start);
    if (duration < wanted) truncated = true;
    segments.push({ pageId: page.id, start, duration, animationEnd });
    start += duration;
  }

  const duration = start;
  // One frame per step plus the closing frame, so the last page is actually seen at rest.
  const frameCount = Math.max(1, Math.round(duration * fps));
  return ok({ fps, duration, frameCount, segments, truncated, animated });
}

export interface VideoFrameSpec {
  index: number;
  total: number;
  /** Seconds from the start of the video. */
  time: number;
  pageId: string;
  /** Seconds since this page appeared — what the animations are evaluated against. */
  pageTime: number;
}

/** Which page is on screen at a frame index, and how far into its own playback it is. */
export function timelineFrame(timeline: VideoTimeline, index: number): VideoFrameSpec {
  const clamped = Math.min(Math.max(0, Math.round(index)), timeline.frameCount - 1);
  const time = clamped / timeline.fps;
  // A timeline is never planned with zero segments, so the last one is always there; the final
  // frame can land exactly on the end of the last segment, which is why it is the fallback.
  const segment =
    timeline.segments.find((entry) => time < entry.start + entry.duration) ??
    timeline.segments[timeline.segments.length - 1];
  if (!segment) {
    return { index: clamped, total: timeline.frameCount, time, pageId: '', pageTime: 0 };
  }
  return {
    index: clamped,
    total: timeline.frameCount,
    time,
    pageId: segment.pageId,
    pageTime: Math.max(0, time - segment.start),
  };
}

/** A finished recording, ready to be handed to the user. */
export interface VideoRecording {
  blob: Blob;
  /** The container the encoder actually produced, e.g. `video/webm;codecs=vp9`. */
  mimeType: string;
  /** File extension matching `mimeType`, without the dot. */
  extension: 'webm' | 'mp4';
}

/** What the orchestrator tells the encoder before the first frame arrives. */
export interface VideoRecordingSpec {
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  duration: number;
}

/**
 * Receives rendered frames in order and produces the file. Implemented in the app against
 * `MediaRecorder`; tests provide a fake.
 */
export interface VideoFrameRecorder {
  /** Called once per frame, in order, with a raster data URL. */
  addFrame(dataUrl: string, frame: VideoFrameSpec): Promise<void> | void;
  /** Called after the last frame. Resolves with the encoded file. */
  finish(): Promise<VideoRecording>;
  /** Called instead of `finish` when rendering failed, so the encoder can release resources. */
  cancel(): void;
}

export type VideoRecorderFactory = (spec: VideoRecordingSpec) => VideoFrameRecorder;

export interface VideoRenderOptions extends VideoTimelineOptions {
  quality?: VideoQuality;
  /** Renders one frame's SVG to a raster data URL (browser: `createSvgRasterizer`). */
  rasterize: SvgRasterizer;
  /** Builds the encoder once the frame size and count are known. */
  createRecorder: VideoRecorderFactory;
  /** Passed through to the SVG renderer; the page and the frame time are set per frame. */
  svgOptions?: Omit<SvgPageOptions, 'pageId' | 'animationTime' | 'scale'>;
  /** Reports progress after each frame, for a progress indicator. */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Image assets are read and base64-encoded by the caller's resolver, which for a locally stored
 * photo means a trip to IndexedDB. Frames reuse the same page, so the result is cached: without
 * this, a ten second video would re-read every photo six hundred times.
 */
function cacheResolver(resolve: ImageHrefResolver | undefined): ImageHrefResolver | undefined {
  if (!resolve) return undefined;
  const cache = new Map<string, Promise<string>>();
  return (asset) => {
    const hit = cache.get(asset.id);
    if (hit) return hit;
    const pending = Promise.resolve(resolve(asset));
    cache.set(asset.id, pending);
    return pending;
  };
}

/**
 * Renders the document's animations to a video file.
 *
 * Every frame is a still of the design at one instant, produced by the same SVG renderer the
 * other exports use — so a frame can never disagree with a PNG of the finished page.
 */
export async function renderDocumentToVideo(
  document: DesignDocument,
  options: VideoRenderOptions,
): Promise<Result<VideoRecording, ExportError>> {
  const planned = planVideoTimeline(document, options);
  if (!planned.ok) return planned;
  const timeline = planned.value;

  const size = videoFrameSize(document.size, options.quality ?? DEFAULT_VIDEO_QUALITY);
  const recorder = options.createRecorder({
    fps: timeline.fps,
    width: size.width,
    height: size.height,
    frameCount: timeline.frameCount,
    duration: timeline.duration,
  });

  const svgOptions: Omit<SvgPageOptions, 'pageId' | 'animationTime' | 'scale'> = {
    ...options.svgOptions,
    ...(options.svgOptions?.resolveImageHref
      ? { resolveImageHref: cacheResolver(options.svgOptions.resolveImageHref) }
      : {}),
  };

  try {
    for (let index = 0; index < timeline.frameCount; index += 1) {
      const frame = timelineFrame(timeline, index);
      const svg = await renderPageToSvg(document, {
        ...svgOptions,
        pageId: frame.pageId,
        animationTime: frame.pageTime,
      });
      if (!svg.ok) {
        recorder.cancel();
        return svg;
      }
      const raster = await options.rasterize(
        svg.value,
        { width: document.size.width, height: document.size.height },
        size.scale,
        'png',
      );
      if (!raster.ok) {
        recorder.cancel();
        return raster;
      }
      await recorder.addFrame(raster.value, frame);
      options.onProgress?.(index + 1, timeline.frameCount);
    }
    return ok(await recorder.finish());
  } catch (cause) {
    recorder.cancel();
    return err({
      code: 'video-failed',
      message: `The video could not be recorded: ${describeCause(cause)}`,
      cause,
    });
  }
}
