import { CHICAGO } from '../src/chicago';
import { buildModel } from '../src/lego/steps';
import { footprint, part } from '../src/lego/parts';

let total = 0;
for (const src of CHICAGO) {
  const t0 = performance.now();
  const m = buildModel(src);
  const ms = Math.round(performance.now() - t0);
  const occ = new Map<string, number>();
  let overlaps = 0;
  for (const b of m.bricks) {
    const d = part(b.part);
    if (!Number.isInteger(b.x) || !Number.isInteger(b.z) || ['antenna', 'bar', 'wheel', 'tire'].includes(d.kind)) continue;
    const [sx, sz] = footprint(d, b.rot);
    for (let y = b.y; y < b.y + d.h; y++)
      for (let z = b.z; z < b.z + sz; z++)
        for (let x = b.x; x < b.x + sx; x++) {
          if (d.kind === 'round' && Math.hypot(x + 0.5 - (b.x + sx / 2), z + 0.5 - (b.z + sz / 2)) > (d.radius ?? 1)) continue;
          const k = `${x},${y},${z}`;
          if (occ.has(k)) { overlaps++; if (overlaps <= 2) console.log('   overlap', src.id, k, b.part, '<->', m.bricks[occ.get(k)!].part); }
          occ.set(k, b.id);
        }
  }
  total += m.bricks.length;
  console.log(`${src.id.padEnd(20)} ${String(m.bricks.length).padStart(5)} pcs ${String(m.steps.length).padStart(4)} steps  overlaps=${overlaps}  ${ms}ms`);
}
console.log('total pieces', total);
