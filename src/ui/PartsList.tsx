import { useMemo, useState } from 'react';
import { color } from '../lego/colors';
import { download, toBrickLinkXML, toCSV, toLDraw } from '../lego/export';
import { colorsUsed, inventory, sortParts, type InvItem } from '../lego/inventory';
import { part } from '../lego/parts';
import type { Model } from '../lego/types';
import { partImage } from '../render/pageRenderer';

type GroupBy = 'color' | 'type';

export function PartsList({ model }: { model: Model }) {
  const [groupBy, setGroupBy] = useState<GroupBy>('color');
  const items = useMemo(() => inventory(model), [model]);
  const groups = useMemo(() => {
    const m = new Map<string, InvItem[]>();
    for (const it of items) {
      const k = groupBy === 'color' ? color(it.color).name : part(it.part).category;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    for (const list of m.values()) list.sort(groupBy === 'type' ? sortParts : (a, b) => sortParts(a, b));
    return [...m.entries()];
  }, [items, groupBy]);
  const colors = useMemo(() => colorsUsed(model), [model]);
  const slug = model.name.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="parts">
      <div className="parts-head">
        <div>
          <h2>
            {model.bricks.length} pieces <span className="muted">· {items.length} different elements · {colors.length} colors</span>
          </h2>
          <div className="color-bar" aria-label="Color mix">
            {colors.map((c) => (
              <i key={c.color.key} title={`${c.color.name}: ${c.count}`} style={{ flex: c.count, background: c.color.hex }} />
            ))}
          </div>
        </div>
        <div className="parts-actions">
          <div className="seg">
            <button className={groupBy === 'color' ? 'on' : ''} onClick={() => setGroupBy('color')}>
              By color
            </button>
            <button className={groupBy === 'type' ? 'on' : ''} onClick={() => setGroupBy('type')}>
              By type
            </button>
          </div>
          <button className="chip" onClick={() => download(`${slug}.ldr`, toLDraw(model))} title="LDraw model with build steps (opens in BrickLink Studio, LeoCAD, LDView…)">
            ⬇ LDraw .ldr
          </button>
          <button className="chip" onClick={() => download(`${slug}-bricklink.xml`, toBrickLinkXML(model), 'text/xml')} title="Upload as a BrickLink Wanted List">
            ⬇ BrickLink XML
          </button>
          <button className="chip" onClick={() => download(`${slug}-parts.csv`, toCSV(model), 'text/csv')}>
            ⬇ CSV
          </button>
        </div>
      </div>
      {groups.map(([name, list]) => (
        <section key={name} className="parts-group">
          <h3>
            {groupBy === 'color' && <i className="swatch" style={{ background: color(list[0].color).hex }} />}
            {name} <span className="muted">{list.reduce((s, x) => s + x.count, 0)}</span>
          </h3>
          <div className="parts-grid">
            {list.map((it) => {
              const img = partImage(it.part, it.color, 18);
              const k = Math.min(1, 150 / img.w, 96 / img.h);
              const c = color(it.color);
              return (
                <div className="part-card" key={`${it.part}|${it.color}`}>
                  <div className="part-img">
                    <img src={img.url} width={img.w * k} height={img.h * k} alt="" />
                  </div>
                  <div className="part-qty">{it.count}x</div>
                  <div className="part-name">{part(it.part).name}</div>
                  <div className="part-meta">
                    <i className="swatch" style={{ background: c.hex }} /> {c.name} · #{it.part}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
