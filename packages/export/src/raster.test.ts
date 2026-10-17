import { describe, expect, it, vi } from 'vitest';

import { createSvgRasterizer, MAX_RASTER_DIMENSION, svgDataUrl } from './raster';

function fakeImage(): HTMLImageElement {
  return { naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
}

interface FakeCanvasOptions {
  dataUrl?: string;
  context?: CanvasRenderingContext2D | null;
}

function fakeCanvas(options: FakeCanvasOptions = {}) {
  const drawn: unknown[][] = [];
  const context =
    options.context === undefined
      ? ({
          drawImage: (...args: unknown[]) => {
            drawn.push(args);
          },
        } as unknown as CanvasRenderingContext2D)
      : options.context;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: () => options.dataUrl ?? 'data:image/png;base64,AAAA',
  } as unknown as HTMLCanvasElement;
  return { canvas, drawn };
}

describe('svgDataUrl', () => {
  it('percent-encodes the markup so it survives as a URL', () => {
    expect(svgDataUrl('<svg><title>a b&c</title></svg>')).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg><title>a b&c</title></svg>')}`,
    );
  });
});

describe('createSvgRasterizer', () => {
  it('draws the SVG into a scaled canvas and returns a PNG data URL', async () => {
    const loadImage = vi.fn().mockResolvedValue(fakeImage());
    const { canvas, drawn } = fakeCanvas();
    const createCanvas = vi.fn().mockReturnValue(canvas);
    const rasterize = createSvgRasterizer({ loadImage, createCanvas });

    const result = await rasterize('<svg/>', { width: 100, height: 50 }, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('data:image/png;base64,AAAA');
    expect(createCanvas).toHaveBeenCalledWith(200, 100);
    expect(drawn).toEqual([[expect.anything(), 0, 0, 200, 100]]);
    expect(loadImage).toHaveBeenCalledWith(svgDataUrl('<svg/>'));
  });

  it('defaults to scale 1 and rounds fractional sizes', async () => {
    const { canvas } = fakeCanvas();
    const createCanvas = vi.fn().mockReturnValue(canvas);
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockResolvedValue(fakeImage()),
      createCanvas,
    });

    await rasterize('<svg/>', { width: 100.4, height: 49.6 });
    expect(createCanvas).toHaveBeenCalledWith(100, 50);
  });

  it('ignores a nonsensical scale', async () => {
    const { canvas } = fakeCanvas();
    const createCanvas = vi.fn().mockReturnValue(canvas);
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockResolvedValue(fakeImage()),
      createCanvas,
    });

    await rasterize('<svg/>', { width: 100, height: 100 }, Number.NaN);
    expect(createCanvas).toHaveBeenCalledWith(100, 100);
  });

  it('refuses sizes beyond the canvas limit', async () => {
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockResolvedValue(fakeImage()),
      createCanvas: vi.fn(),
    });

    const result = await rasterize('<svg/>', { width: MAX_RASTER_DIMENSION, height: 10 }, 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('raster-too-large');
  });

  it('reports a decoder failure', async () => {
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockRejectedValue(new Error('The rendered SVG could not be decoded.')),
      createCanvas: vi.fn(),
    });

    const result = await rasterize('<svg/>', { width: 10, height: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('raster-failed');
    expect(result.error.message).toContain('could not be decoded');
  });

  it('reports a missing 2D context', async () => {
    const { canvas } = fakeCanvas({ context: null });
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockResolvedValue(fakeImage()),
      createCanvas: vi.fn().mockReturnValue(canvas),
    });

    const result = await rasterize('<svg/>', { width: 10, height: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('raster-failed');
    expect(result.error.message).toContain('2D drawing context');
  });

  it('reports a canvas that returns no PNG', async () => {
    const { canvas } = fakeCanvas({ dataUrl: 'data:,' });
    const rasterize = createSvgRasterizer({
      loadImage: vi.fn().mockResolvedValue(fakeImage()),
      createCanvas: vi.fn().mockReturnValue(canvas),
    });

    const result = await rasterize('<svg/>', { width: 10, height: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('raster-failed');
  });
});
