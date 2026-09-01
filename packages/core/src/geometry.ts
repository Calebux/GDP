export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const right = (r: Rect): number => r.x + r.width;
export const bottom = (r: Rect): number => r.y + r.height;
export const centerOf = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
export const areaOf = (r: Rect): number => Math.max(0, r.width) * Math.max(0, r.height);

export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(right(a), right(b)) - x;
  const h = Math.min(bottom(a), bottom(b)) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

export function overlapRatio(a: Rect, b: Rect): number {
  const i = intersection(a, b);
  if (!i) return 0;
  const smaller = Math.min(areaOf(a), areaOf(b));
  return smaller === 0 ? 0 : areaOf(i) / smaller;
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    right(inner) <= right(outer) &&
    bottom(inner) <= bottom(outer)
  );
}

export function inset(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, width: r.width - by * 2, height: r.height - by * 2 };
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Round to a whole device pixel — designs must be deterministic across runs. */
export const px = (v: number): number => Math.round(v * 100) / 100;
