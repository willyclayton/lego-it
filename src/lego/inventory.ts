import { COLOR_ORDER, color } from './colors';
import { part } from './parts';
import type { Brick, Model } from './types';

export interface InvItem {
  part: string;
  color: string;
  count: number;
}

const KIND_ORDER = ['plate', 'wheelHolder', 'brick', 'tile', 'grille', 'jumper', 'slope', 'slopeInv', 'ridge', 'curve', 'round', 'roundTile', 'cone', 'dish', 'wheel', 'tire'];

/** Sort order used in the per-step callout boxes: biggest parts first, grouped by color. */
export function sortParts(a: InvItem, b: InvItem) {
  const pa = part(a.part), pb = part(b.part);
  return pb.w * pb.l * pb.h - pa.w * pa.l * pa.h || COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) || a.part.localeCompare(b.part);
}

/** Sort order for the inventory page: by color, then by part type and size (like the back pages of a manual). */
export function sortInventory(a: InvItem, b: InvItem) {
  const pa = part(a.part), pb = part(b.part);
  return (
    COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) ||
    KIND_ORDER.indexOf(pa.kind) - KIND_ORDER.indexOf(pb.kind) ||
    pa.w * pa.l - pb.w * pb.l ||
    a.part.localeCompare(b.part)
  );
}

export function tally(bricks: Brick[]): InvItem[] {
  const m = new Map<string, InvItem>();
  for (const b of bricks) {
    const k = `${b.part}|${b.color}`;
    const it = m.get(k);
    if (it) it.count++;
    else m.set(k, { part: b.part, color: b.color, count: 1 });
  }
  return [...m.values()];
}

export function inventory(model: Model) {
  return tally(model.bricks).sort(sortInventory);
}

export function stepParts(model: Model, stepIndex: number) {
  const s = model.steps[stepIndex];
  return tally(s.bricks.map((i) => model.bricks[i])).sort(sortParts);
}

export function colorsUsed(model: Model) {
  const m = new Map<string, number>();
  for (const b of model.bricks) m.set(b.color, (m.get(b.color) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ color: color(k), count: n }));
}

/** Rough build-time estimate: ~6 s per part plus finding time growing with the number of unique parts. */
export function buildMinutes(model: Model) {
  const uniq = new Set(model.bricks.map((b) => `${b.part}|${b.color}`)).size;
  return Math.max(5, Math.round((model.bricks.length * 6 + uniq * 12) / 60 / 5) * 5);
}
