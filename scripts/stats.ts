import { SAMPLES } from '../src/samples';
import { buildModel } from '../src/lego/steps';
import { footprint, part } from '../src/lego/parts';

for (const src of SAMPLES) {
  const t0 = performance.now();
  const m = buildModel(src);
  const ms = (performance.now() - t0).toFixed(0);
  // overlap check (integer-celled parts only)
  const occ = new Map<string, number>();
  let overlaps = 0;
  for (const b of m.bricks) {
    const d = part(b.part);
    if (d.kind === 'wheel' || d.kind === 'tire' || !Number.isInteger(b.x) || !Number.isInteger(b.z)) continue;
    const [sx, sz] = footprint(d, b.rot);
    for (let y = b.y; y < b.y + d.h; y++)
      for (let z = b.z; z < b.z + sz; z++)
        for (let x = b.x; x < b.x + sx; x++) {
          const k = `${x},${y},${z}`;
          if (occ.has(k)) { overlaps++; if (overlaps < 4) console.log('  overlap', src.id, k, b.part, '<->', m.bricks[occ.get(k)!].part); }
          occ.set(k, b.id);
        }
  }
  const kinds = new Map<string, number>();
  for (const b of m.bricks) kinds.set(part(b.part).kind, (kinds.get(part(b.part).kind) ?? 0) + 1);
  const subs = [...new Set(m.bricks.map((b) => b.sub).filter(Boolean))];
  const rotated = m.steps.filter((s) => s.rotated).length;
  const bags = Math.max(...m.steps.map((s) => s.bag));
  console.log(`${src.id.padEnd(11)} pieces=${String(m.bricks.length).padStart(4)} steps=${String(m.steps.length).padStart(3)} uniq=${new Set(m.bricks.map(b=>b.part+b.color)).size} rotated=${rotated} bags=${bags} subs=[${subs.join(', ')}] overlaps=${overlaps} ${ms}ms`);
  console.log('   ', [...kinds].map(([k, v]) => `${k}:${v}`).join(' '));
}
