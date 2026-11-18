import type { Rect } from './types';

export interface Guide {
  axis: 'x' | 'y';
  /** Position in display points. */
  at: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

function best(moving: number[], targets: number[], threshold: number): { delta: number; at: number } | null {
  let out: { delta: number; at: number } | null = null;
  for (const m of moving) {
    for (const t of targets) {
      const d = t - m;
      if (Math.abs(d) <= threshold && (!out || Math.abs(d) < Math.abs(out.delta))) out = { delta: d, at: t };
    }
  }
  return out;
}

const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];

/**
 * Snap a rectangle's edges/centers to other rectangles' edges/centers.
 * `edges` limits which of the moving rect's x/y edges may snap (for resizing).
 */
export function snapRect(
  rect: Rect,
  others: Rect[],
  threshold: number,
  edges: { x: number[]; y: number[] } = { x: xs(rect), y: ys(rect) },
): SnapResult {
  const tx = others.flatMap(xs);
  const ty = others.flatMap(ys);
  const bx = best(edges.x, tx, threshold);
  const by = best(edges.y, ty, threshold);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { dx: bx?.delta ?? 0, dy: by?.delta ?? 0, guides };
}
