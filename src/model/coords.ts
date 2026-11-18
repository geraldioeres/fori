import type { PageInfo, Rect } from './types';

type Box = PageInfo['box'];

/** PDF user-space point → display point (scale 1, top-left origin, rotation applied). */
export function pdfToDisplay(px: number, py: number, box: Box, rotation: number): [number, number] {
  const [x0, y0, x1, y1] = box;
  switch (rotation) {
    case 90:
      return [py - y0, px - x0];
    case 180:
      return [x1 - px, py - y0];
    case 270:
      return [y1 - py, x1 - px];
    default:
      return [px - x0, y1 - py];
  }
}

/** Display point → PDF user-space point. Inverse of {@link pdfToDisplay}. */
export function displayToPdf(dx: number, dy: number, box: Box, rotation: number): [number, number] {
  const [x0, y0, x1, y1] = box;
  switch (rotation) {
    case 90:
      return [dy + x0, dx + y0];
    case 180:
      return [x1 - dx, dy + y0];
    case 270:
      return [x1 - dy, y1 - dx];
    default:
      return [dx + x0, y1 - dy];
  }
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function displayRectToPdf(r: Rect, page: Pick<PageInfo, 'box' | 'rotation'>): PdfRect {
  const [ax, ay] = displayToPdf(r.x, r.y, page.box, page.rotation);
  const [bx, by] = displayToPdf(r.x + r.w, r.y + r.h, page.box, page.rotation);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

export function pdfRectToDisplay(r: PdfRect, page: Pick<PageInfo, 'box' | 'rotation'>): Rect {
  const [ax, ay] = pdfToDisplay(r.x, r.y, page.box, page.rotation);
  const [bx, by] = pdfToDisplay(r.x + r.width, r.y + r.height, page.box, page.rotation);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

export function normalizeRotation(deg: number): PageInfo['rotation'] {
  const r = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return r as PageInfo['rotation'];
}

export function pageInfo(box: PageInfo['box'], rotationDeg: number): PageInfo {
  const rotation = normalizeRotation(rotationDeg);
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  return rotation % 180 === 0
    ? { width: w, height: h, rotation, box }
    : { width: h, height: w, rotation, box };
}
