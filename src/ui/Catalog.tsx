import { useEffect, useMemo, useRef, useState } from 'react';
import { CHICAGO, loadChicago } from '../chicago';
import type { ChicagoSource } from '../chicago/kit';
import { Studs } from './PartCallout';
import { useThumb } from './thumbs';

type Sort = 'tallest' | 'oldest' | 'newest' | 'az';
type Era = 'all' | 'early' | 'mid' | 'late';
const ERAS: [Era, string][] = [
  ['all', 'All'],
  ['early', 'Before 1930'],
  ['mid', '1930–1979'],
  ['late', '1980 and later'],
];

const yearOf = (s: ChicagoSource) => parseInt(s.info.year, 10);
const inEra = (s: ChicagoSource, e: Era) => {
  const y = yearOf(s);
  return e === 'all' || (e === 'early' && y < 1930) || (e === 'mid' && y >= 1930 && y < 1980) || (e === 'late' && y >= 1980);
};

/** Pre-rendered picture (public/thumbs, made by `npm run thumbs`), or a live render if the file is missing. */
function Thumb({ id, alt, style }: { id: string; alt: string; style?: React.CSSProperties }) {
  const [live, setLive] = useState(false);
  if (live) return <LiveThumb id={id} alt={alt} style={style} />;
  return <img src={`thumbs/${id}.webp`} alt={alt} style={style} decoding="async" onError={() => setLive(true)} />;
}
function LiveThumb({ id, alt, style }: { id: string; alt: string; style?: React.CSSProperties }) {
  const img = useThumb(id, () => loadChicago(id)!);
  return img ? <img src={img.url} alt={alt} style={style} /> : <span className="cat-ph">Rendering…</span>;
}

function SkylineItem({ src, onOpen, scale }: { src: ChicagoSource; onOpen: (id: string) => void; scale: number }) {
  const h = Math.max(34, src.info.heightM * scale);
  return (
    <button className="sky-item" onClick={() => onOpen(src.id)} title={`${src.name} · ${src.info.height}`}>
      <Thumb id={src.id} alt={src.name} style={{ height: h, width: 'auto' }} />
      <span className="sky-label">{src.name}</span>
    </button>
  );
}

function Card({ src, onOpen }: { src: ChicagoSource; onOpen: (id: string) => void }) {
  return (
    <button className="cat-card" onClick={() => onOpen(src.id)} aria-label={`Build ${src.name}`}>
      <span className="cat-img">
        <Thumb id={src.id} alt="" />
      </span>
      <span className="cat-body">
        <span className="cat-title">{src.name}</span>
        <span className="cat-meta">
          <span>{src.info.year}</span>
          <span>{src.info.height.split(' (')[0].split(' · ')[0]}</span>
          {src.info.floors ? <span>{src.info.floors} floors</span> : null}
        </span>
        <span className="cat-arch">{src.info.architect}</span>
        <span className="cat-fact">{src.info.fact}</span>
        <span className="cat-foot">
          <span className="tagpill">{src.info.style}</span>
          <Studs n={src.difficulty} />
        </span>
        <span className="cat-open">Build it ›</span>
      </span>
    </button>
  );
}

export function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<Sort>('tallest');
  const [era, setEra] = useState<Era>('all');
  const list = useMemo(() => {
    const l = CHICAGO.filter((s) => inEra(s, era));
    if (sort === 'tallest') l.sort((a, b) => b.info.heightM - a.info.heightM);
    if (sort === 'oldest') l.sort((a, b) => yearOf(a) - yearOf(b));
    if (sort === 'newest') l.sort((a, b) => yearOf(b) - yearOf(a));
    if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [sort, era]);
  // skyline: tallest in the middle, falling away to both sides, drawn to real height
  const skyline = useMemo(() => {
    const byH = [...CHICAGO].sort((a, b) => b.info.heightM - a.info.heightM);
    const out: ChicagoSource[] = [];
    byH.forEach((s, i) => (i % 2 ? out.push(s) : out.unshift(s)));
    return out;
  }, []);
  const maxH = Math.max(...CHICAGO.map((s) => s.info.heightM));
  const sky = useRef<HTMLElement>(null);
  useEffect(() => {
    // on narrow screens, start with the tallest towers (the middle of the skyline) in view
    const el = sky.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  const years = CHICAGO.map(yearOf);

  return (
    <div className="catalog">
      <header className="cat-head">
        <div>
          <p className="eyebrow">Architecture collection</p>
          <h1>Chicago Buildings</h1>
          <p className="cat-intro">
            {CHICAGO.length} landmarks in bricks, from the {Math.min(...years)} Water Tower to the {Math.max(...years)} St. Regis and the Bean in Millennium
            Park. Every model has a 3D build animation, a complete instruction booklet and a parts list, and sits on a display base like an architecture
            set.
          </p>
        </div>
      </header>
      <section className="skyline" ref={sky} aria-label="Skyline, drawn to real height">
        <div className="sky-row">
          {skyline.map((s) => (
            <SkylineItem key={s.id} src={s} onOpen={onOpen} scale={230 / maxH} />
          ))}
        </div>
        <p className="sky-note">Skyline drawn to real height. Each model has its own scale, shown on its page.</p>
      </section>
      <div className="cat-controls">
        <h2>Pick a building to build</h2>
        <div className="seg" role="group" aria-label="Era">
          {ERAS.map(([e, label]) => (
            <button key={e} className={era === e ? 'on' : ''} onClick={() => setEra(e)}>
              {label}
            </button>
          ))}
        </div>
        <label className="cat-sort">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="tallest">Tallest first</option>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>
      <section className="cat-grid">
        {list.map((s) => (
          <Card key={s.id} src={s} onOpen={onOpen} />
        ))}
      </section>
    </div>
  );
}
