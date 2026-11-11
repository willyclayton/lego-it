import { useEffect, useMemo, useRef, useState } from 'react';
import { CHICAGO } from '../chicago';
import { RiverScene, type Selection } from '../river/scene';
import { buildSights, buildStops, ft, type Sight } from '../river/sights';
import { buildingInfo, legAt, loadWorld, routeAt, routeNearest, type World } from '../river/world';

const BASE_SPEED = 2.5; // cells per second at 1× = 10 m/s, about a real tour boat at full speed
const SPEEDS = [1, 2, 4, 8, 16];
/** where the boat was when the tour was last left, so "back" returns to the same spot */
let resume = { s: 0, speed: 4 };

const MINI_COLORS = ['#8f9aa0', '#4fb4c6', '#2f8f8c', '#c9ced2', '#8a8d8a', '#63b25f', '#e6d5a8', '#a39a85', '#efdfb0', '#8a8a8a', '#b4bbbd'];

function Minimap({ world, s, onSeek }: { world: World; s: number; onSeek: (s: number) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const K = 8;
  const mw = Math.floor(world.w / K), mh = Math.floor(world.h / K);
  useEffect(() => {
    const ctx = cv.current!.getContext('2d')!;
    const img = ctx.createImageData(mw, mh);
    const rgb = MINI_COLORS.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) {
        // water wins inside a block so the river stays visible at this size
        let cls = world.ground[(y * K + 4) * world.w + x * K + 4];
        for (let dy = 0; dy < K && cls !== 2; dy += 2) for (let dx = 0; dx < K; dx += 2) if (world.ground[(y * K + dy) * world.w + x * K + dx] === 2) cls = 2;
        const c = rgb[cls];
        const i = (y * mw + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#d01012';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    world.route.forEach(([x, y], i) => (i ? ctx.lineTo(x / K, y / K) : ctx.moveTo(x / K, y / K)));
    ctx.stroke();
  }, [world, mw, mh]);
  const [bx, by] = routeAt(world, s);
  return (
    <div
      className="rv-map"
      title="Map: click to jump"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * world.w, y = ((e.clientY - r.top) / r.height) * world.h;
        // the route passes some stretches twice: prefer the pass closest to where the boat is now
        const a = routeNearest(world, x, y), b = routeNearest(world, x, y, s);
        onSeek(b.d <= a.d + 6 ? b.s : a.s);
      }}
    >
      <canvas ref={cv} width={mw} height={mh} />
      <i style={{ left: `${(bx / world.w) * 100}%`, top: `${(by / world.h) * 100}%` }} />
    </div>
  );
}

function Details({ world, sel, onClose }: { world: World; sel: Selection; onClose: () => void }) {
  let title = '', eyebrow = '', fact: string | undefined;
  const rows: [string, string][] = [];
  let actions: React.ReactNode = null;
  if (sel.kind === 'building') {
    const b = buildingInfo(world, sel.id);
    const m = b.meta;
    title = b.name;
    eyebrow = 'Building';
    fact = m.f;
    const est = b.heightSrc === 1 ? ` (estimated from ${m.lv} floors)` : b.heightSrc === 2 ? ' (estimate: no height on the map)' : '';
    rows.push(['Height', `${Math.round(b.heightM)} m · ${ft(b.heightM)} ft${est}`]);
    if (m.lv) rows.push(['Floors', String(m.lv)]);
    if (m.y) rows.push(['Completed', String(m.y)]);
    if (m.a) rows.push(['Architect', m.a]);
    if (m.ad && m.ad !== title) rows.push(['Address', m.ad]);
    if (m.nm && m.n && m.n !== m.nm && !m.nm.includes(m.n)) rows.push(['Also called', m.n]);
    const cat = m.cat && CHICAGO.find((c) => c.id === m.cat);
    actions = (
      <>
        <a className="primary rv-go" href={`#river/${sel.id}`}>
          Build it ›
        </a>
        {cat && (
          <a className="chip rv-go" href={`#chicago/${cat.id}`}>
            Detailed model in the catalog ›
          </a>
        )}
      </>
    );
  } else if (sel.kind === 'bridge') {
    const b = world.bridges[sel.index];
    title = b.name;
    eyebrow = 'Bridge';
    fact = b.fact;
    if (b.year) rows.push([b.kind === 'beam' ? 'Built' : 'Opened', String(b.year)]);
    if (b.type) rows.push(['Type', b.type]);
    const [w0, w1] = b.span;
    rows.push(['Water crossing', `about ${Math.round(((w1 - w0) * world.cell) / 5) * 5} m`]);
    if (b.top === 'L') rows.push(['Upper deck', 'CTA ‘L’ trains']);
    if (b.status === 'construction') rows.push(['Status', 'Under reconstruction']);
  } else {
    const p = world.pois[sel.index];
    title = p.name;
    eyebrow = 'On the route';
    fact = p.f;
  }
  return (
    <aside className="rv-card" aria-live="polite">
      <button className="icon rv-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {rows.length > 0 && (
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {fact && <p className="rv-fact">{fact}</p>}
      {actions && <div className="rv-actions">{actions}</div>}
    </aside>
  );
}

export function RiverTour() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RiverScene | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState(resume.s);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(resume.speed);
  const [sel, setSel] = useState<Selection | null>(null);
  const [near, setNear] = useState<Sight[]>([]);
  const [now, setNow] = useState<Sight | null>(null);
  const tagEls = useRef(new Map<string, HTMLButtonElement>());
  const scrub = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (w) => alive && setWorld(w),
      (e) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, []);

  const sights = useMemo(() => (world ? buildSights(world) : []), [world]);
  const stops = useMemo(() => (world ? buildStops(world) : []), [world]);

  useEffect(() => {
    if (!world || !host.current) return;
    let sc: RiverScene;
    try {
      sc = new RiverScene(host.current, world);
    } catch (e) {
      setError('This device could not start the 3D view.');
      console.error(e);
      return;
    }
    scene.current = sc;
    sc.speed = BASE_SPEED * resume.speed;
    sc.seek(resume.s >= world.length - 1 ? 0 : resume.s);
    let lastUi = 0;
    sc.onTick = (v) => {
      resume.s = v;
      if (scrub.current && document.activeElement !== scrub.current) scrub.current.value = String(v);
      const t = performance.now();
      if (t - lastUi > 200) {
        lastUi = t;
        setS(v);
      }
    };
    sc.onEnd = () => setPlaying(false);
    sc.onPick = (p) => setSel(p);
    sc.playing = true;
    setPlaying(true);
    return () => {
      sc.dispose();
      scene.current = null;
    };
  }, [world]);

  // which sights are close: name tags in the view and the "now passing" line
  useEffect(() => {
    const sc = scene.current;
    if (!sc || !world) return;
    const [bx, bz] = sc.boatXZ;
    const [fx, fz] = sc.forward;
    const scored = sights
      .map((g) => {
        const dx = g.x - bx, dz = g.z - bz;
        const along = dx * fx + dz * fz;
        return { g, d: Math.hypot(dx, dz), along };
      })
      .filter((q) => q.d < 150 + q.g.y * 2.2 && q.along > -40 - q.g.y);
    scored.sort((a, b) => a.d - b.d);
    setNear(scored.slice(0, 7).map((q) => q.g));
    const pass = scored.filter((q) => q.g.off < 60 && q.d < 75 && q.along > -22).sort((a, b) => Math.abs(a.along) - Math.abs(b.along))[0];
    setNow(pass?.g ?? null);
  }, [s, sights, world]);

  // keep the name tags glued to their buildings every frame
  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    sc.onFrame = () => {
      const wd = host.current?.clientWidth ?? 0;
      for (const g of near) {
        const el = tagEls.current.get(g.key);
        if (!el) continue;
        const p = sc.project(g.x, g.y + 1.5, g.z);
        const show = p && p.x > 40 && p.x < wd - 40 && p.y > 54;
        el.style.display = show ? '' : 'none';
        if (show) el.style.transform = `translate(-50%, -100%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      }
    };
    return () => {
      sc.onFrame = null;
    };
  }, [near, world]);

  useEffect(() => {
    if (scene.current) scene.current.speed = BASE_SPEED * speed;
    resume.speed = speed;
  }, [speed, world]);
  useEffect(() => {
    scene.current?.setSelected(sel);
  }, [sel, world]);

  const toggle = () => {
    const sc = scene.current;
    if (!sc || !world) return;
    if (!sc.playing && sc.s >= world.length - 1) sc.seek(0);
    sc.playing = !sc.playing;
    setPlaying(sc.playing);
  };
  const seek = (v: number) => {
    scene.current?.seek(v);
    setS(v);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight') seek((scene.current?.s ?? 0) + 40);
      else if (e.key === 'ArrowLeft') seek((scene.current?.s ?? 0) - 40);
      else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  if (error)
    return (
      <div className="rv rv-msg">
        <p>{error}</p>
      </div>
    );

  const leg = world ? legAt(world, s) : null;
  const km = world ? (s * world.cell) / 1000 : 0;
  const total = world ? (world.length * world.cell) / 1000 : 0;
  const ended = !!world && s >= world.length - 1;
  const stopNow = stops.reduce((k, st, i) => (s >= st.s - 1 ? i : k), 0);

  return (
    <div className="rv">
      <div className="rv-stage" ref={host}>
        {!world && <div className="rv-loading">Loading the river…</div>}
        {world && (
          <>
            <div className="rv-tags">
              {near.map((g) => (
                <button
                  key={g.key}
                  ref={(el) => {
                    if (el) tagEls.current.set(g.key, el);
                    else tagEls.current.delete(g.key);
                  }}
                  className={`rv-tag ${g.sel.kind}`}
                  style={{ display: 'none' }}
                  onClick={() => setSel(g.sel)}
                >
                  {g.name.replace(/ \(.*\)$/, '')}
                </button>
              ))}
            </div>
            <div className="rv-top">
              <div className="rv-now">
                <p className="eyebrow">{leg?.title}</p>
                {ended ? (
                  <b>End of the tour: Ping Tom Memorial Park, Chinatown</b>
                ) : now ? (
                  <button className="rv-now-btn" onClick={() => setSel(now.sel)}>
                    <b>{now.name}</b>
                    <span>{now.sub} · tap for the story ›</span>
                  </button>
                ) : (
                  <span className="rv-hint">Tap any building or bridge for details · drag to look around</span>
                )}
              </div>
              <Minimap world={world} s={s} onSeek={seek} />
            </div>
            <div className="rv-tools">
              <button className="icon" onClick={() => scene.current?.zoom(0.75)} aria-label="Zoom in">
                +
              </button>
              <button className="icon" onClick={() => scene.current?.zoom(1.33)} aria-label="Zoom out">
                −
              </button>
              <button className="icon" onClick={() => scene.current?.resetView()} aria-label="Reset the view" title="Reset the view">
                ⟲
              </button>
            </div>
            {sel && <Details world={world} sel={sel} onClose={() => setSel(null)} />}
            <p className="rv-credit">
              Map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{' '}
              contributors
            </p>
          </>
        )}
      </div>
      {world && (
        <div className="rv-bar">
          <div className="rv-stops" role="group" aria-label="Jump to a stop">
            {stops.map((st, i) => (
              <button key={st.label} className={`chip ${i === stopNow ? 'on' : ''}`} onClick={() => seek(Math.max(0, st.s))}>
                {st.label}
              </button>
            ))}
          </div>
          <div className="transport rv-transport">
            <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
              {playing ? (
                <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg>
              )}
            </button>
            <div className="scrubber">
              <div className="ticks">
                {stops.map((st) => (
                  <i key={st.label} style={{ left: `${(Math.max(0, st.s) / world.length) * 100}%` }} />
                ))}
              </div>
              <input
                ref={scrub}
                type="range"
                min={0}
                max={world.length}
                step={1}
                defaultValue={resume.s}
                aria-label="Position along the route"
                onInput={(e) => seek(Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <span className="time">
              {km.toFixed(1)} / {total.toFixed(1)} km
            </span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
              {SPEEDS.map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
