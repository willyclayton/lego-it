import { useEffect, useMemo, useRef, useState } from 'react';
import { CHICAGO, loadChicago } from '../chicago';
import type { ChicagoSource } from '../chicago/kit';
import { Studs } from './PartCallout';
import { useThumb } from './thumbs';

type Sort = 'tallest' | 'oldest' | 'newest' | 'az';

const yearOf = (s: ChicagoSource) => parseInt(s.info.year, 10);

function SkylineItem({ src, onOpen, scale }: { src: ChicagoSource; onOpen: (id: string) => void; scale: number }) {
  const img = useThumb(src.id, () => loadChicago(src.id)!);
  const h = Math.max(34, src.info.heightM * scale);
  return (
    <button className="sky-item" onClick={() => onOpen(src.id)} title={`${src.name} · ${src.info.height}`}>
      {img ? <img src={img.url} alt={src.name} style={{ height: h, width: (img.w / img.h) * h }} /> : <span className="sky-ph" style={{ height: h }} />}
      <span className="sky-label">{src.name}</span>
    </button>
  );
}

function Card({ src, onOpen }: { src: ChicagoSource; onOpen: (id: string) => void }) {
  const img = useThumb(src.id, () => loadChicago(src.id)!);
  const pieces = img ? loadChicago(src.id)?.bricks.length : null;
  return (
    <article className="cat-card">
      <button className="cat-img" onClick={() => onOpen(src.id)} aria-label={`Open ${src.name}`}>
        {img ? <img src={img.url} width={img.w} height={img.h} alt="" /> : <span className="cat-ph">Rendering…</span>}
      </button>
      <div className="cat-body">
        <h3>{src.name}</h3>
        <div className="cat-meta">
          <span>{src.info.year}</span>
          <span>{src.info.height.split(' (')[0]}</span>
          {src.info.floors ? <span>{src.info.floors} floors</span> : null}
        </div>
        <p className="cat-arch">{src.info.architect}</p>
        <p className="cat-fact">{src.info.fact}</p>
        <div className="cat-foot">
          <span className="tagpill">{src.info.style}</span>
          <span className="cat-pcs">
            <Studs n={src.difficulty} /> {pieces ? `${pieces} pcs` : ''}
          </span>
        </div>
        <button className="primary cat-open" onClick={() => onOpen(src.id)}>
          Build it
        </button>
      </div>
    </article>
  );
}

export function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<Sort>('tallest');
  const list = useMemo(() => {
    const l = [...CHICAGO];
    if (sort === 'tallest') l.sort((a, b) => b.info.heightM - a.info.heightM);
    if (sort === 'oldest') l.sort((a, b) => yearOf(a) - yearOf(b));
    if (sort === 'newest') l.sort((a, b) => yearOf(b) - yearOf(a));
    if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [sort]);
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
        <label className="cat-sort">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="tallest">Tallest first</option>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </header>
      <section className="skyline" ref={sky} aria-label="Skyline, drawn to real height">
        <div className="sky-row">
          {skyline.map((s) => (
            <SkylineItem key={s.id} src={s} onOpen={onOpen} scale={230 / maxH} />
          ))}
        </div>
        <p className="sky-note">Skyline drawn to real height. Each model has its own scale, shown on its page.</p>
      </section>
      <section className="cat-grid">
        {list.map((s) => (
          <Card key={s.id} src={s} onOpen={onOpen} />
        ))}
      </section>
    </div>
  );
}
