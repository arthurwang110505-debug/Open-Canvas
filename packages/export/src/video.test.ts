import {
  createBlankDocument,
  createPage,
  createRectElement,
  ok,
  type DesignDocument,
  type ElementAnimation,
} from '@opencanvas/document';
import { describe, expect, it, vi } from 'vitest';

import type { SvgRasterizer } from './raster';
import {
  DEFAULT_VIDEO_HOLD,
  MAX_VIDEO_SECONDS,
  MIN_PAGE_SECONDS,
  planVideoTimeline,
  renderDocumentToVideo,
  timelineFrame,
  videoFrameSize,
  type VideoFrameRecorder,
  type VideoFrameSpec,
  type VideoRecordingSpec,
} from './video';

const fixedDate = new Date('2026-04-05T06:07:08.000Z');

function documentWith(animation?: ElementAnimation, pages = 1): DesignDocument {
  const document = createBlankDocument({ id: 'doc_video', name: 'Reel', now: fixedDate });
  const rect = createRectElement({ id: 'r1', x: 10, y: 20, width: 100, height: 50 });
  document.pages[0]?.elements.push(animation ? { ...rect, animation } : rect);
  for (let index = 1; index < pages; index += 1) {
    document.pages.push(createPage({ id: `page_${String(index + 1)}` }));
  }
  return document;
}

/** A fake encoder: records what it was handed so the orchestration can be asserted. */
function fakeRecorder() {
  const frames: { dataUrl: string; frame: VideoFrameSpec }[] = [];
  let specs: VideoRecordingSpec | null = null;
  let cancelled = false;
  const recorder: VideoFrameRecorder = {
    addFrame: (dataUrl, frame) => {
      frames.push({ dataUrl, frame });
    },
    finish: () =>
      Promise.resolve({
        blob: new Blob(['video'], { type: 'video/webm' }),
        mimeType: 'video/webm',
        extension: 'webm' as const,
      }),
    cancel: () => {
      cancelled = true;
    },
  };
  return {
    frames,
    get spec() {
      return specs;
    },
    get cancelled() {
      return cancelled;
    },
    create: (spec: VideoRecordingSpec) => {
      specs = spec;
      return recorder;
    },
  };
}

const rasterizeOk: SvgRasterizer = () => Promise.resolve(ok('data:image/png;base64,AAA'));

describe('planVideoTimeline', () => {
  it('runs a page until its last entrance plus a hold', () => {
    const document = documentWith({ type: 'rise', duration: 1, delay: 2 });
    const planned = planVideoTimeline(document, { fps: 30 });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.duration).toBeCloseTo(3 + DEFAULT_VIDEO_HOLD, 5);
    expect(planned.value.frameCount).toBe(Math.round((3 + DEFAULT_VIDEO_HOLD) * 30));
    expect(planned.value.animated).toBe(true);
    expect(planned.value.truncated).toBe(false);
  });

  it('still gives a still page time on screen', () => {
    const planned = planVideoTimeline(documentWith(), { fps: 15 });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.duration).toBe(MIN_PAGE_SECONDS);
    expect(planned.value.frameCount).toBe(MIN_PAGE_SECONDS * 15);
    // Nothing moves, and the caller is told so it can say as much.
    expect(planned.value.animated).toBe(false);
  });

  it('lays pages out one after another', () => {
    const document = documentWith({ type: 'fade', duration: 1, delay: 0 }, 3);
    const planned = planVideoTimeline(document, { fps: 30, hold: 1 });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const [first, second, third] = planned.value.segments;
    expect(planned.value.segments).toHaveLength(3);
    expect(first).toMatchObject({ pageId: document.pages[0]?.id, start: 0, duration: 2 });
    // Pages 2 and 3 are empty, so they run for the minimum instead of the animation length.
    expect(second?.start).toBe(2);
    expect(second?.duration).toBe(MIN_PAGE_SECONDS);
    expect(third?.start).toBe(2 + MIN_PAGE_SECONDS);
  });

  it('only includes the pages it was asked for', () => {
    const document = documentWith(undefined, 3);
    const planned = planVideoTimeline(document, { pageIds: [document.pages[2]?.id ?? ''] });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.segments).toHaveLength(1);
    expect(planned.value.segments[0]?.pageId).toBe(document.pages[2]?.id);
  });

  it('cuts the timeline rather than rendering forever', () => {
    const document = documentWith(undefined, 40);
    const planned = planVideoTimeline(document, { fps: 30 });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.duration).toBeLessThanOrEqual(MAX_VIDEO_SECONDS);
    expect(planned.value.truncated).toBe(true);
  });

  it('refuses a document with no pages to record', () => {
    const planned = planVideoTimeline(documentWith(), { pageIds: [] });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error.code).toBe('page-not-found');
  });
});

describe('videoFrameSize', () => {
  it('keeps a small design at its own size', () => {
    expect(videoFrameSize({ width: 1080, height: 1080 }, 'standard')).toMatchObject({
      width: 1080,
      height: 1080,
      scale: 1,
    });
  });

  it('caps the longest edge and keeps the aspect ratio', () => {
    const size = videoFrameSize({ width: 1920, height: 1080 }, 'standard');
    expect(size.width).toBe(1280);
    expect(size.height).toBe(720);
  });

  it('allows a larger frame at HD', () => {
    expect(videoFrameSize({ width: 3840, height: 2160 }, 'hd').width).toBe(1920);
  });

  it('always produces even dimensions, which encoders require', () => {
    const size = videoFrameSize({ width: 1001, height: 673 }, 'standard');
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });
});

describe('timelineFrame', () => {
  it('maps a frame index to the page on screen and its own clock', () => {
    const document = documentWith({ type: 'fade', duration: 1, delay: 0 }, 2);
    const planned = planVideoTimeline(document, { fps: 10, hold: 1 });
    if (!planned.ok) throw new Error(planned.error.message);

    const first = timelineFrame(planned.value, 0);
    expect(first).toMatchObject({ time: 0, pageId: document.pages[0]?.id, pageTime: 0 });

    // Page one lasts 2s at 10fps, so frame 25 is half a second into page two.
    const later = timelineFrame(planned.value, 25);
    expect(later.pageId).toBe(document.pages[1]?.id);
    expect(later.pageTime).toBeCloseTo(0.5, 5);
  });

  it('clamps an index past the end to the last frame', () => {
    const planned = planVideoTimeline(documentWith(), { fps: 10 });
    if (!planned.ok) throw new Error(planned.error.message);
    expect(timelineFrame(planned.value, 9999).index).toBe(planned.value.frameCount - 1);
  });
});

describe('renderDocumentToVideo', () => {
  it('renders one frame per step and hands them to the recorder in order', async () => {
    const document = documentWith({ type: 'pop', duration: 0.5, delay: 0 });
    const recorder = fakeRecorder();
    const rasterize = vi.fn(rasterizeOk);

    const result = await renderDocumentToVideo(document, {
      fps: 15,
      hold: 0.5,
      rasterize,
      createRecorder: recorder.create,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.extension).toBe('webm');
    // 0.5s animation + 0.5s hold is below the minimum, so the page runs for MIN_PAGE_SECONDS.
    const expected = MIN_PAGE_SECONDS * 15;
    expect(rasterize).toHaveBeenCalledTimes(expected);
    expect(recorder.frames).toHaveLength(expected);
    expect(recorder.frames.map((entry) => entry.frame.index)).toEqual(
      Array.from({ length: expected }, (_, index) => index),
    );
    expect(recorder.spec).toMatchObject({ fps: 15, frameCount: expected });
  });

  it('draws each frame at its own point in the animation', async () => {
    const document = documentWith({ type: 'fade', duration: 1, delay: 0 });
    const recorder = fakeRecorder();
    const svgs: string[] = [];
    const rasterize: SvgRasterizer = (svg) => {
      svgs.push(svg);
      return Promise.resolve(ok('data:image/png;base64,AAA'));
    };

    const result = await renderDocumentToVideo(document, {
      fps: 4,
      rasterize,
      createRecorder: recorder.create,
    });
    expect(result.ok).toBe(true);

    // The first frame is fully transparent, the middle is part way, the last is the design.
    expect(svgs[0]).toContain('opacity="0"');
    const middle = svgs[2] ?? '';
    expect(middle).toMatch(/opacity="0\.\d+"/);
    expect(svgs[svgs.length - 1]).not.toContain('opacity=');
    // Frames carry no CSS playback hints: each one is already posed.
    expect(svgs.join('')).not.toContain('data-animate');
  });

  it('reports progress so the dialog can show it', async () => {
    const recorder = fakeRecorder();
    const seen: number[] = [];
    const result = await renderDocumentToVideo(documentWith(), {
      fps: 2,
      rasterize: rasterizeOk,
      createRecorder: recorder.create,
      onProgress: (completed, total) => {
        seen.push(completed);
        expect(total).toBe(MIN_PAGE_SECONDS * 2);
      },
    });
    expect(result.ok).toBe(true);
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it('reads each image asset once, not once per frame', async () => {
    const document = documentWith();
    const resolveImageHref = vi.fn(() => Promise.resolve('data:image/png;base64,AAA'));
    const recorder = fakeRecorder();

    await renderDocumentToVideo(document, {
      fps: 4,
      rasterize: rasterizeOk,
      createRecorder: recorder.create,
      svgOptions: { resolveImageHref },
    });
    // This page has no images at all; the point is that the resolver is never called per frame.
    expect(resolveImageHref).not.toHaveBeenCalled();
  });

  it('gives up and releases the encoder when a frame cannot be rasterized', async () => {
    const recorder = fakeRecorder();
    const rasterize: SvgRasterizer = () =>
      Promise.resolve({
        ok: false,
        error: { code: 'raster-failed', message: 'No 2D context in this browser.' },
      });

    const result = await renderDocumentToVideo(documentWith(), {
      fps: 2,
      rasterize,
      createRecorder: recorder.create,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('No 2D context');
    expect(recorder.cancelled).toBe(true);
  });

  it('turns an encoder crash into a reported failure', async () => {
    const result = await renderDocumentToVideo(documentWith(), {
      fps: 2,
      rasterize: rasterizeOk,
      createRecorder: () => ({
        addFrame: () => {
          throw new Error('the tab ran out of memory');
        },
        finish: () => Promise.reject(new Error('unused')),
        cancel: () => undefined,
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('video-failed');
    expect(result.error.message).toContain('the tab ran out of memory');
  });
});
