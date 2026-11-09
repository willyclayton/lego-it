import { CHICAGO } from '../src/chicago';
import { buildModel } from '../src/lego/steps';
for (const id of process.argv.slice(2)) {
  const m = buildModel(CHICAGO.find((c) => c.id === id)!);
  const c = new Map<string, number>();
  for (const b of m.bricks) c.set(`${b.part}/${b.color}`, (c.get(`${b.part}/${b.color}`) ?? 0) + 1);
  console.log(id, m.bricks.length, [...c].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' '));
}
