import '@opencanvas/canvas-fabric/test/setup-canvas';
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // Layout never changes in jsdom; the stage reads its size once on mount.
  }
  unobserve(): void {
    // Nothing to release.
  }
  disconnect(): void {
    // Nothing to release.
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom reports 0x0 layout boxes; give the workspace a believable size.
vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
  this: HTMLElement,
) {
  const width = this.dataset['testid'] === 'canvas-stage' ? 1200 : 0;
  const height = this.dataset['testid'] === 'canvas-stage' ? 800 : 0;
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  };
});

// jsdom has no DragEvent; without it drop events lose their pointer coordinates.
if (typeof globalThis.DragEvent === 'undefined') {
  class DragEventPolyfill extends MouseEvent {
    readonly dataTransfer: DataTransfer | null;
    constructor(type: string, init: DragEventInit = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  }
  globalThis.DragEvent = DragEventPolyfill;
}

// jsdom does not implement object URLs; thumbnails and the canvas resolve assets through them.
if (typeof URL.createObjectURL !== 'function') {
  let objectUrlCounter = 0;
  URL.createObjectURL = () => `blob:jsdom/${String(++objectUrlCounter)}`;
  URL.revokeObjectURL = () => undefined;
}

afterEach(() => {
  cleanup();
});
