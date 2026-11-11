import type { Selection } from './scene';
import { buildingInfo, LAND_Y, routeNearest, type World } from './world';

export interface Sight {
  key: string;
  sel: Selection;
  name: string;
  sub: string;
  fact?: string;
  x: number;
  z: number;
  y: number;
  /** distance from the route in cells */
  off: number;
}

export const ft = (m: number) => Math.round(m / 0.3048).toLocaleString('en-US');

/** Everything the tour points out: bridges, places, and the buildings we have a story for. */
export function buildSights(world: World): Sight[] {
  const out: Sight[] = [];
  world.bridges.forEach((b, index) => {
    if (!b.year) return;
    out.push({
      key: `br${index}`,
      sel: { kind: 'bridge', index },
      name: b.name,
      sub: `Bridge · ${b.year}`,
      fact: b.fact,
      x: b.c[0],
      z: b.c[1],
      y: b.kind === 'lift' ? 17 : b.kind === 'raised' ? 12 : 4.2,
      off: routeNearest(world, b.c[0], b.c[1]).d,
    });
  });
  world.pois.forEach((p, index) =>
    out.push({ key: `poi${index}`, sel: { kind: 'poi', index }, name: p.name, sub: 'On the route', fact: p.f, x: p.x, z: p.y, y: LAND_Y + 3, off: routeNearest(world, p.x, p.y).d }),
  );
  for (const [k, m] of Object.entries(world.b.m)) {
    if (!m.f && !m.cat) continue;
    const info = buildingInfo(world, Number(k));
    out.push({
      key: `b${k}`,
      sel: { kind: 'building', id: info.id },
      name: info.name,
      sub: [m.y, `${Math.round(info.heightM)} m`].filter(Boolean).join(' · '),
      fact: m.f,
      x: info.cx,
      z: info.cy,
      y: LAND_Y + info.heightM / world.cell,
      off: routeNearest(world, info.cx, info.cy).d,
    });
  }
  return out;
}

export interface Stop {
  label: string;
  s: number;
}
export function buildStops(world: World): Stop[] {
  const leg = (key: string) => world.cum[world.legs.find((l) => l.key === key)!.start];
  const poi = (name: string) => {
    const p = world.pois.find((q) => q.name === name)!;
    return routeNearest(world, p.x, p.y).s;
  };
  const bridge = (name: string) => {
    const b = world.bridges.find((q) => q.name.startsWith(name))!;
    return routeNearest(world, b.c[0], b.c[1]).s;
  };
  const willis = Object.entries(world.b.m).find(([, m]) => m.n === 'Willis Tower');
  const wi = willis ? buildingInfo(world, Number(willis[0])) : null;
  return [
    { label: 'Lake Michigan', s: 0 },
    { label: 'Navy Pier', s: poi('Navy Pier') - 30 },
    { label: 'Harbor Lock', s: poi('Chicago Harbor Lock') - 25 },
    { label: 'Michigan Ave', s: bridge('DuSable Bridge') - 45 },
    { label: 'Marina City', s: bridge('State Street') - 30 },
    { label: 'Wolf Point', s: leg('north') - 40 },
    { label: 'Goose Island', s: leg('canal') - 90 },
    { label: 'Canal', s: leg('canal') + 20 },
    { label: 'Opera House', s: leg('south') + 60 },
    { label: 'Willis Tower', s: wi ? routeNearest(world, wi.cx, wi.cy, leg('south')).s - 45 : leg('south') + 200 },
    { label: 'Chinatown', s: world.length - 70 },
  ];
}
