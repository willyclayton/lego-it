import { footprint, part } from './parts';
import type { Brick, Model, ModelSource, Placement, Step } from './types';

/** Default camera azimuth for instructions: front-right, so the model's front points to the lower left. */
export const DEFAULT_VIEW = 35;

const OFF = 512;
const ckey = (x: number, y: number, z: number) => x + OFF + (z + OFF) * 1024 + (y + OFF) * 1048576;

interface Item {
  kind: 'brick' | 'sub';
  p: Placement;
  idx: number; // placement index (bricks) or -1
  subName?: string;
  phase: number;
  y: number;
  cx: number;
  cz: number;
}

function cells(p: Placement, fn: (x: number, z: number) => void) {
  const def = part(p.part);
  const [sx, sz] = footprint(def, p.rot);
  for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sx; dx++) fn(Math.floor(p.x) + dx, Math.floor(p.z) + dz);
}

function center(p: Placement): [number, number] {
  const [sx, sz] = footprint(part(p.part), p.rot);
  return [p.x + sx / 2, p.z + sz / 2];
}

const freeParts = new Set(['wheel', 'tire']);

/**
 * Order a group of placements into a buildable sequence and cut it into steps.
 * Rules (from assembly-instruction research): build bottom-up, every part must
 * rest on or hang from something already placed, work back-to-front so new parts
 * are not hidden, keep steps spatially compact and limit parts/types per step.
 */
function sequence(items: Item[], maxPerStep: number, span: number): Item[][] {
  const az = (DEFAULT_VIEW * Math.PI) / 180;
  const depth = (it: Item) => it.cx * Math.sin(az) + it.cz * Math.cos(az);
  const pending = [...items].sort(
    (a, b) => a.phase - b.phase || a.y - b.y || depth(a) - depth(b) || a.cx - b.cx || a.cz - b.cz,
  );
  const tops = new Set<number>();
  const bottoms = new Set<number>();
  const minY = Math.min(...items.map((i) => i.y));

  const placeable = (it: Item) => {
    if (it.kind === 'sub') return true;
    const p = it.p;
    const def = part(p.part);
    if (freeParts.has(def.kind) || !Number.isInteger(p.y) || p.y <= minY) return true;
    let ok = false;
    cells(p, (x, z) => {
      if (tops.has(ckey(x, p.y, z)) || bottoms.has(ckey(x, p.y + def.h, z))) ok = true;
    });
    return ok;
  };
  const place = (it: Item) => {
    if (it.kind === 'sub') return;
    const p = it.p;
    const def = part(p.part);
    if (!Number.isInteger(p.y)) return;
    cells(p, (x, z) => {
      tops.add(ckey(x, p.y + def.h, z));
      bottoms.add(ckey(x, p.y, z));
    });
  };

  const steps: Item[][] = [];
  let cur: Item[] = [];
  const reach = Math.max(6, span / 3);
  const flush = () => {
    if (cur.length) steps.push(cur);
    cur = [];
  };

  while (pending.length) {
    // Prefer the first placeable item; never skip past a different phase.
    let i = pending.findIndex((it) => it.phase === pending[0].phase && placeable(it));
    if (i < 0) i = 0;
    const it = pending.splice(i, 1)[0];
    place(it);
    if (it.kind === 'sub') {
      flush();
      steps.push([it]);
      continue;
    }
    if (cur.length) {
      const types = new Set([...cur, it].map((c) => c.p.part + c.p.color));
      const cx = cur.reduce((s, c) => s + c.cx, 0) / cur.length;
      const cz = cur.reduce((s, c) => s + c.cz, 0) / cur.length;
      const far = Math.hypot(it.cx - cx, it.cz - cz) > reach;
      const sameLayer = it.y === cur[0].y;
      const smallStack = cur.length <= 2 && it.y > cur[0].y && it.y - cur[0].y <= 3 && maxPerStep >= 4;
      if (
        cur.length >= maxPerStep ||
        types.size > Math.max(3, Math.ceil(maxPerStep * 0.6)) ||
        it.phase !== cur[0].phase ||
        (!sameLayer && !smallStack) ||
        far
      )
        flush();
    }
    cur.push(it);
  }
  flush();
  return balance(steps, maxPerStep);
}

/** Even out a long run of same-layer steps so we don't end with a lonely 1-part step. */
function balance(steps: Item[][], max: number): Item[][] {
  const out: Item[][] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const prev = out[out.length - 1];
    if (
      prev &&
      s.length === 1 &&
      s[0].kind === 'brick' &&
      prev[0].kind === 'brick' &&
      prev.length < max + 2 &&
      prev[0].y === s[0].y &&
      prev[0].phase === s[0].phase
    ) {
      prev.push(s[0]);
    } else out.push(s);
  }
  return out;
}

export function buildModel(src: ModelSource): Model {
  return assemble(src, src.build());
}

export function assemble(src: Omit<ModelSource, 'build'>, placements: Placement[]): Model {
  const maxPerStep = src.maxPerStep ?? 6;
  const xs = placements.map((p) => p.x);
  const zs = placements.map((p) => p.z);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);

  const toItem = (p: Placement, idx: number): Item => {
    const [cx, cz] = center(p);
    return { kind: 'brick', p, idx, phase: p.phase ?? 0, y: p.y, cx, cz };
  };

  const subs = new Map<string, Item[]>();
  const main: Item[] = [];
  placements.forEach((p, i) => {
    const it = toItem(p, i);
    if (p.sub) {
      if (!subs.has(p.sub)) subs.set(p.sub, []);
      subs.get(p.sub)!.push(it);
    } else main.push(it);
  });

  for (const [name, items] of subs) {
    const y = Math.min(...items.map((i) => i.y));
    const phase = Math.min(...items.map((i) => i.phase));
    const cx = items.reduce((s, i) => s + i.cx, 0) / items.length;
    const cz = items.reduce((s, i) => s + i.cz, 0) / items.length;
    main.push({ kind: 'sub', p: items[0].p, idx: -1, subName: name, phase, y, cx, cz });
  }

  const mainSteps = sequence(main, maxPerStep, span);
  const steps: Step[] = [];
  const bricks: Brick[] = [];
  const pushStep = (items: Item[], extra: Partial<Step>) => {
    const s: Step = { index: steps.length, bricks: [], view: DEFAULT_VIEW, rotated: false, bag: 0, ...extra };
    for (const it of items) {
      const b: Brick = { ...it.p, id: bricks.length, step: s.index };
      bricks.push(b);
      s.bricks.push(b.id);
    }
    steps.push(s);
  };

  for (const st of mainSteps) {
    if (st[0].kind === 'sub') {
      const name = st[0].subName!;
      const subItems = subs.get(name)!;
      const sspan = Math.max(...subItems.map((i) => i.cx)) - Math.min(...subItems.map((i) => i.cx)) + 2;
      for (const ss of sequence(subItems, Math.max(3, maxPerStep - 1), sspan)) pushStep(ss, { sub: name });
      pushStep([], { attaches: name });
    } else pushStep(st, {});
  }

  const model: Model = { ...src, bricks, steps };
  assignViews(model);
  assignBags(model);
  return model;
}

/* ------------------------------------------------------------------ */
/* View selection: rotate the model when new parts would be hidden.    */
/* ------------------------------------------------------------------ */

interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

export function brickAABB(b: Placement): AABB {
  const def = part(b.part);
  const [sx, sz] = footprint(def, b.rot);
  return { min: [b.x, b.y * 0.4, b.z], max: [b.x + sx, (b.y + def.h) * 0.4, b.z + sz] };
}

function rayHitsBox(o: number[], d: number[], box: AABB, maxT: number) {
  let t0 = 0.001;
  let t1 = maxT;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / d[a];
    let tn = (box.min[a] - o[a]) * inv;
    let tf = (box.max[a] - o[a]) * inv;
    if (tn > tf) [tn, tf] = [tf, tn];
    t0 = Math.max(t0, tn);
    t1 = Math.min(t1, tf);
    if (t1 < t0) return false;
  }
  return true;
}

function viewDir(azDeg: number, elDeg = 30) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/** Fraction of sample points on the new parts that are hidden behind already placed parts. */
function occlusion(newBoxes: AABB[], others: AABB[], az: number) {
  if (!newBoxes.length) return 0;
  const d = viewDir(az);
  let hidden = 0;
  let total = 0;
  for (const nb of newBoxes) {
    const pts = [
      [(nb.min[0] + nb.max[0]) / 2, nb.max[1] - 0.05, (nb.min[2] + nb.max[2]) / 2],
      [(nb.min[0] + nb.max[0]) / 2, (nb.min[1] + nb.max[1]) / 2, az > 90 && az < 270 ? nb.min[2] : nb.max[2]],
    ];
    for (const p of pts) {
      total++;
      if (others.some((ob) => ob !== nb && rayHitsBox(p, d, ob, 200))) hidden++;
    }
  }
  return hidden / total;
}

function assignViews(model: Model) {
  const base = model.heroView ?? DEFAULT_VIEW;
  const boxes = model.bricks.map(brickAABB);
  const placedMain: AABB[] = [];
  const placedSub = new Map<string, AABB[]>();
  let view = base;
  let prevSubView = base;
  for (const s of model.steps) {
    const newBoxes = s.bricks.map((i) => boxes[i]);
    const ctx = s.sub ? (placedSub.get(s.sub) ?? []) : placedMain;
    const all = [...ctx, ...newBoxes];
    let current = s.sub ? prevSubView : view;
    // Sub-assemblies are small and seen whole; keep them in the default view.
    if (s.bricks.length && !s.sub) {
      const candidates = [base, base + 180, base - 90, base + 90];
      const occCur = occlusion(newBoxes, all, current);
      if (occCur > 0.5) {
        let best = current;
        let bestOcc = occCur;
        for (const c of candidates) {
          const o = occlusion(newBoxes, all, c);
          if (o < bestOcc - 0.3) {
            best = c;
            bestOcc = o;
          }
        }
        current = best;
      } else if (current !== base && occlusion(newBoxes, all, base) <= occCur) {
        current = base; // drift back to the default view whenever it works
      }
    }
    const prev = s.sub ? prevSubView : view;
    s.view = ((current % 360) + 360) % 360;
    s.rotated = s.index > 0 && Math.abs(((s.view - (((prev % 360) + 360) % 360)) + 540) % 360 - 180) > 1;
    if (s.sub) {
      prevSubView = current;
      placedSub.set(s.sub, all);
    } else {
      view = current;
      placedMain.push(...newBoxes);
      if (s.attaches) placedMain.push(...model.bricks.filter((b) => b.sub === s.attaches).map((b) => boxes[b.id]));
    }
  }
}

function assignBags(model: Model) {
  const n = model.bricks.length;
  if (n < 160) {
    for (const s of model.steps) s.bag = 0;
    return;
  }
  const bags = Math.min(8, Math.ceil(n / 180));
  const per = n / bags;
  let count = 0;
  let bag = 1;
  for (const s of model.steps) {
    // Never start a new bag inside a sub-assembly.
    if (!s.sub && count >= per * bag && bag < bags) bag++;
    s.bag = bag;
    count += s.bricks.length;
  }
}

/**
 * Display numbers like a manual: main-model steps count 1..N, while
 * sub-assembly steps restart at 1 inside their own frame.
 */
export function stepLabels(model: Model): { num: number; sub?: string }[] {
  let main = 0;
  const subCount = new Map<string, number>();
  return model.steps.map((s) => {
    if (s.sub) {
      const n = (subCount.get(s.sub) ?? 0) + 1;
      subCount.set(s.sub, n);
      return { num: n, sub: s.sub };
    }
    return { num: ++main };
  });
}
