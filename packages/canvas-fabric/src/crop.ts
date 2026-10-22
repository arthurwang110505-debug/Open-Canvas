import type { ImageCrop, ImageElement } from '@opencanvas/document';

import { computeImageFit, cropWindowToCrop, moveCropWindow, type CropWindow } from './mapping';

/** A rectangle in page pixels. */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One of the eight crop handles, named by the edges it moves. */
export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Where a crop drag has put the element: its new box and the source window that fills it. */
export interface CropLayout {
  box: CropBox;
  crop?: ImageCrop | undefined;
}

/** Smallest window a drag may leave, as a share of the bitmap (the schema's own minimum). */
const MIN_FRACTION = 0.05;

/**
 * Page pixels per bitmap pixel for an image displayed with `cover`.
 *
 * Crop maths works in this one scale: a crop box and the source window inside it only stay
 * consistent while the picture is not stretched, which is why crop mode always lays out with
 * `cover` — a stretched (`fill`) image is being resized, not cropped.
 */
export function cropScale(
  element: Pick<ImageElement, 'width' | 'height' | 'fit' | 'crop'>,
  natural: { width: number; height: number },
): number {
  return computeImageFit(element, natural, 'cover', element.crop).scaleX || 1;
}

/** The part of the bitmap the element's box shows right now, in bitmap pixels. */
export function visibleSourceRect(
  element: Pick<ImageElement, 'width' | 'height' | 'fit' | 'crop'>,
  natural: { width: number; height: number },
): CropWindow {
  const fit = computeImageFit(element, natural, 'cover', element.crop);
  return { x: fit.cropX, y: fit.cropY, width: fit.width, height: fit.height };
}

/** The stored form of a source window; `undefined` when the window is the whole bitmap. */
export function cropFromSourceRect(
  rect: CropWindow,
  natural: { width: number; height: number },
): ImageCrop | undefined {
  const crop = cropWindowToCrop(rect, natural);
  const full = crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;
  return full ? undefined : crop;
}

function roundBox(box: CropBox): CropBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/**
 * Drags one crop handle to `box`.
 *
 * The picture keeps its scale and the edges the handle does not touch stay where they are, so
 * dragging a handle reveals or hides the photo instead of stretching it. The drag stops at the
 * bitmap's edges, which is also where the "whole photo is visible" state lives.
 */
export function resizeCrop(
  element: ImageElement,
  natural: { width: number; height: number },
  handle: CropHandle,
  box: CropBox,
): CropLayout {
  const scale = cropScale(element, natural);
  const visible = visibleSourceRect(element, natural);
  const naturalWidth = Math.max(1, natural.width);
  const naturalHeight = Math.max(1, natural.height);
  const minWidth = Math.max(1, naturalWidth * MIN_FRACTION);
  const minHeight = Math.max(1, naturalHeight * MIN_FRACTION);

  const movesWest = handle.includes('w');
  const movesEast = handle.includes('e');
  const movesNorth = handle.includes('n');
  const movesSouth = handle.includes('s');

  // Proposed source edges. The pinned edges come from the current window, not from the box, so
  // rounding in the document cannot make the photo jump by a pixel mid-drag.
  let left = movesWest ? visible.x + (box.x - element.x) / scale : visible.x;
  let right = movesEast
    ? visible.x + (box.x + box.width - element.x) / scale
    : visible.x + visible.width;
  let top = movesNorth ? visible.y + (box.y - element.y) / scale : visible.y;
  let bottom = movesSouth
    ? visible.y + (box.y + box.height - element.y) / scale
    : visible.y + visible.height;

  // Clamp to the bitmap, then to the minimum size, keeping the pinned edge pinned.
  left = Math.min(Math.max(left, 0), naturalWidth - minWidth);
  right = Math.max(Math.min(right, naturalWidth), left + minWidth);
  top = Math.min(Math.max(top, 0), naturalHeight - minHeight);
  bottom = Math.max(Math.min(bottom, naturalHeight), top + minHeight);

  const window: CropWindow = {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
  return {
    box: roundBox({
      x: element.x + (left - visible.x) * scale,
      y: element.y + (top - visible.y) * scale,
      width: window.width * scale,
      height: window.height * scale,
    }),
    crop: cropFromSourceRect(window, natural),
  };
}

/**
 * Reshapes the crop box to `ratio` (width / height), keeping its centre and its scale.
 *
 * The window grows into the photo where it can and shrinks where it must, so switching from 16:9
 * to 1:1 reveals the top and bottom of the picture if the bitmap has them rather than zooming in.
 */
export function cropAspect(
  element: ImageElement,
  natural: { width: number; height: number },
  ratio: number,
): CropLayout {
  const scale = cropScale(element, natural);
  const visible = visibleSourceRect(element, natural);
  const naturalWidth = Math.max(1, natural.width);
  const naturalHeight = Math.max(1, natural.height);
  const centreX = visible.x + visible.width / 2;
  const centreY = visible.y + visible.height / 2;

  // Grow the dimension the ratio stretches and keep the other one, then clamp to the bitmap. A
  // preset should reveal more photo when there is room, not zoom into what is already visible.
  let width = visible.width;
  let height = visible.height;
  if (width / height < ratio) width = height * ratio;
  else height = width / ratio;
  if (width > naturalWidth) {
    width = naturalWidth;
    height = width / ratio;
  }
  if (height > naturalHeight) {
    height = naturalHeight;
    width = height * ratio;
  }

  const x = Math.min(Math.max(centreX - width / 2, 0), naturalWidth - width);
  const y = Math.min(Math.max(centreY - height / 2, 0), naturalHeight - height);
  const window: CropWindow = { x, y, width, height };
  return {
    box: roundBox({
      x: element.x + (x - visible.x) * scale,
      y: element.y + (y - visible.y) * scale,
      width: width * scale,
      height: height * scale,
    }),
    crop: cropFromSourceRect(window, natural),
  };
}

/**
 * Moves the photo inside a fixed crop box by a page-pixel delta. The box holds still and the
 * window moves the opposite way, exactly like dragging a picture inside a frame.
 */
export function panCrop(
  element: ImageElement,
  natural: { width: number; height: number },
  delta: { x: number; y: number },
): CropLayout {
  const scale = cropScale(element, natural);
  const visible = visibleSourceRect(element, natural);
  const moved = moveCropWindow(visible, natural, -delta.x / scale, -delta.y / scale);
  return {
    box: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    },
    crop: cropFromSourceRect(moved, natural),
  };
}
