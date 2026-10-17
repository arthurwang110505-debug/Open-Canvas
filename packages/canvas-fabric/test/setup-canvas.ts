/**
 * jsdom has no 2D rendering context. Fabric only needs a context that accepts drawing calls
 * and answers `measureText`, so a permissive stub is enough to exercise object management,
 * events and transforms without a real rasterizer (pixel output is covered by E2E tests).
 */
function createContextStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { canvas };
  const noop = () => undefined;
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      switch (key) {
        case 'measureText':
          return (text: string) => {
            const font = typeof target['font'] === 'string' ? target['font'] : '16px sans-serif';
            const size = Number.parseFloat(font) || 16;
            return { width: text.length * size * 0.55, actualBoundingBoxAscent: size * 0.8 };
          };
        case 'getImageData':
          return (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(Math.max(1, w * h) * 4),
            width: w,
            height: h,
          });
        case 'createLinearGradient':
        case 'createRadialGradient':
          return () => ({ addColorStop: noop });
        case 'createPattern':
          return () => null;
        case 'getLineDash':
          return () => [];
        case 'getTransform':
          return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        case 'isPointInPath':
          return () => false;
        default:
          return noop;
      }
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

// The original is only ever invoked with an explicit receiver via `.call(this, ...)`.
// eslint-disable-next-line @typescript-eslint/unbound-method
const original = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function getContext(
  this: HTMLCanvasElement,
  contextId: string,
  ...rest: unknown[]
) {
  if (contextId === '2d') return createContextStub(this);
  return (original as (this: HTMLCanvasElement, id: string, ...args: unknown[]) => unknown).call(
    this,
    contextId,
    ...rest,
  );
} as typeof HTMLCanvasElement.prototype.getContext;

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
}
