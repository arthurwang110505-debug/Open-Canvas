import {
  createBlankDocument,
  createPage,
  createRectElement,
  ok,
  type DesignDocument,
} from '@opencanvas/document';
import type { VideoFrameRecorder, VideoRecordingSpec } from '@opencanvas/export';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import type { ExportServices } from './export/ExportServices';

const fixedDate = new Date('2026-05-06T07:08:09.000Z');

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** The design the tests record: one rectangle with a one second entrance. */
function animatedDesign(pages = 1): DesignDocument {
  const document = createBlankDocument({ id: 'doc_video', name: 'Promo', now: fixedDate });
  document.pages[0]?.elements.push({
    ...createRectElement({ id: 'r1', x: 40, y: 50, width: 200, height: 100 }),
    animation: { type: 'rise', duration: 1, delay: 0 },
  });
  for (let index = 1; index < pages; index += 1) {
    document.pages.push(createPage({ id: `page_${String(index + 1)}` }));
  }
  return document;
}

interface Harness {
  user: ReturnType<typeof userEvent.setup>;
  downloads: { blob: Blob; filename: string }[];
  frames: string[];
  specs: VideoRecordingSpec[];
  rasterize: ReturnType<typeof vi.fn>;
}

/**
 * jsdom has no `MediaRecorder`, so the encoder is replaced by a fake that records what it was
 * given. Everything above it — planning, frame rendering, rasterizing, naming, downloading —
 * is the real code path.
 */
function renderEditor(
  document: DesignDocument,
  options: { videoSupported?: boolean; failRecording?: boolean } = {},
): Harness {
  const downloads: { blob: Blob; filename: string }[] = [];
  const frames: string[] = [];
  const specs: VideoRecordingSpec[] = [];
  const rasterize = vi.fn(() => Promise.resolve(ok(ONE_PIXEL_PNG)));

  const createVideoRecorder = (spec: VideoRecordingSpec): VideoFrameRecorder => {
    specs.push(spec);
    return {
      addFrame: (dataUrl) => {
        frames.push(dataUrl);
      },
      finish: () =>
        options.failRecording === true
          ? Promise.reject(new Error('the browser produced an empty video file'))
          : Promise.resolve({
              blob: new Blob(['fake-webm'], { type: 'video/webm' }),
              mimeType: 'video/webm',
              extension: 'webm' as const,
            }),
      cancel: () => undefined,
    };
  };

  const services: Partial<ExportServices> = {
    rasterize,
    download: (blob, filename) => downloads.push({ blob, filename }),
    resolveFontFaces: () => Promise.resolve([]),
    ...(options.videoSupported === false ? {} : { createVideoRecorder }),
  };

  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} exportServices={services} />
    </TooltipProvider>,
  );
  return { user, downloads, frames, specs, rasterize };
}

/** The dialog's live region: what it promises the download will be. */
function summaryOf(dialog: HTMLElement): HTMLElement {
  const node = dialog.querySelector('[aria-live="polite"]');
  if (!(node instanceof HTMLElement)) throw new Error('the dialog has no summary');
  return node;
}

async function openVideoFormat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Download' }));
  const dialog = await screen.findByRole('dialog', { name: 'Download design' });
  await user.click(within(dialog).getByRole('radio', { name: /Video/ }));
  return dialog;
}

describe('exporting the animations as a video', () => {
  it('states the frame size, rate, length, and page count before recording', async () => {
    const { user } = renderEditor(animatedDesign());
    const dialog = await openVideoFormat(user);

    expect(within(dialog).getByText('Promo.webm')).toBeInTheDocument();
    // The 1080 × 1080 design fits inside the 1280 px standard frame, and a one second
    // entrance plus the 1.2 s hold is below the two second floor for a page.
    expect(summaryOf(dialog)).toHaveTextContent('1080 × 1080 px · 30 fps · 2.2 s · 1 page');

    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    expect(summaryOf(dialog)).toHaveTextContent('15 fps');
  });

  it('records one frame per step and downloads the file', async () => {
    const { user, downloads, frames, specs, rasterize } = renderEditor(animatedDesign());
    const dialog = await openVideoFormat(user);
    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    await user.click(within(dialog).getByRole('button', { name: 'Download video' }));

    // 1 s entrance + 1.2 s hold = 2.2 s at 15 fps.
    expect(frames).toHaveLength(33);
    expect(rasterize).toHaveBeenCalledTimes(33);
    expect(specs[0]).toMatchObject({ fps: 15, width: 1080, height: 1080, frameCount: 33 });
    expect(downloads[0]?.filename).toBe('Promo.webm');
    expect(downloads[0]?.blob.type).toBe('video/webm');
    // Success closes the dialog, like every other format.
    expect(screen.queryByRole('dialog', { name: 'Download design' })).not.toBeInTheDocument();
  });

  it('draws the entrance frame by frame rather than the finished page', async () => {
    const { user, rasterize } = renderEditor(animatedDesign());
    const dialog = await openVideoFormat(user);
    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    await user.click(within(dialog).getByRole('button', { name: 'Download video' }));

    const svgs = rasterize.mock.calls.map((call) => call[0] as string);
    // First frame: transparent and 24 units low, exactly where `rise` begins.
    expect(svgs[0]).toContain('translate(40 74)');
    expect(svgs[0]).toContain('opacity="0"');
    // Last frame: the design as the canvas draws it.
    expect(svgs[svgs.length - 1]).toContain('translate(40 50)');
    expect(svgs[svgs.length - 1]).not.toContain('opacity=');
  });

  it('records every page in order when asked for the whole design', async () => {
    const { user, specs } = renderEditor(animatedDesign(3));
    const dialog = await openVideoFormat(user);
    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    expect(summaryOf(dialog)).toHaveTextContent('3 pages');

    await user.click(within(dialog).getByRole('radio', { name: 'Current page only' }));
    expect(summaryOf(dialog)).toHaveTextContent('page 1 of 3');
    await user.click(within(dialog).getByRole('button', { name: 'Download video' }));

    // Current page only: 2.2 s at 15 fps, not the whole deck.
    expect(specs[0]?.frameCount).toBe(33);
  });

  it('halves the frame size when the design is larger than the quality allows', async () => {
    const document = animatedDesign();
    document.size = { width: 1920, height: 1080 };
    const { user, specs } = renderEditor(document);
    const dialog = await openVideoFormat(user);
    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    expect(summaryOf(dialog)).toHaveTextContent('1280 × 720 px');

    await user.click(within(dialog).getByRole('radio', { name: /HD/ }));
    expect(summaryOf(dialog)).toHaveTextContent('1920 × 1080 px');
    await user.click(within(dialog).getByRole('button', { name: 'Download video' }));
    expect(specs[0]).toMatchObject({ width: 1920, height: 1080 });
  });

  it('says so when nothing on the page is animated', async () => {
    const document = createBlankDocument({ id: 'doc_still', name: 'Flyer', now: fixedDate });
    document.pages[0]?.elements.push(
      createRectElement({ id: 'r1', x: 0, y: 0, width: 10, height: 10 }),
    );
    const { user } = renderEditor(document);
    const dialog = await openVideoFormat(user);

    expect(within(dialog).getByText(/Nothing here is animated yet/)).toBeInTheDocument();
  });

  it('refuses the format in a browser that cannot record, instead of failing later', async () => {
    const { user } = renderEditor(animatedDesign(), { videoSupported: false });
    await user.click(screen.getByRole('button', { name: 'Download' }));
    const dialog = await screen.findByRole('dialog', { name: 'Download design' });
    const option = within(dialog).getByRole('radio', { name: /Video/ });

    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByText(/This browser cannot record video/)).toBeInTheDocument();
    await user.click(option);
    // The choice does not take, so the dialog still offers PNG.
    expect(within(dialog).getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
  });

  it('reports a recording failure in the dialog and keeps it open', async () => {
    const { user, downloads } = renderEditor(animatedDesign(), { failRecording: true });
    const dialog = await openVideoFormat(user);
    await user.click(within(dialog).getByRole('radio', { name: '15 frames per second' }));
    await user.click(within(dialog).getByRole('button', { name: 'Download video' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/empty video file/);
    expect(downloads).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Download design' })).toBeInTheDocument();
  });
});
