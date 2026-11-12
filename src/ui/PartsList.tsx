import { useMemo, useState } from 'react';
import { color } from '../lego/colors';
import { toBrickLinkXML, toCSV, toLDraw } from '../lego/export';
import { inArtifact, saveFile } from '../host';
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
  const [status, setStatus] = useState<string | null>(null);
  const save = async (name: string, data: string) => {
    const r = await saveFile(name, data);
    setStatus(r === 'unavailable' ? 'Saving files isn’t available here.' : r === 'declined' ? null : inArtifact && /\.(ldr|xml)$/.test(name) ? `Saved ${name} inside a .zip.` : null);
  };

  const [order, setOrder] = useState<null | 'copied' | 'saved'>(null);
  /** Copy the Wanted List to the clipboard and open BrickLink's upload page next to it. */
  const orderOnBrickLink = async () => {
    const xml = toBrickLinkXML(model);
    // open the tab inside the click so pop-up blockers allow it
    window.open('https://www.bricklink.com/v2/wanted/upload.page', '_blank', 'noopener');
    try {
      await navigator.clipboard.writeText(xml);
      setOrder('copied');
    } catch {
      await saveFile(`${slug}-bricklink.xml`, xml);
      setOrder('saved');
    }
  };
  const pieces = model.bricks.length;

  return (
    <div className="parts">
      <section className="order" aria-label="Order the parts">
        <div className="order-main">
          <h3>Order the parts</h3>
          <p>
            Buy all {pieces} pieces ({items.length} elements) from BrickLink sellers. One click copies the parts list and opens BrickLink’s Wanted List
            upload; paste it there and BrickLink finds shops that have everything.
          </p>
          <button className="primary order-btn" onClick={orderOnBrickLink}>
            Order on BrickLink ›
          </button>
        </div>
        {order && (
          <ol className="order-steps">
            <li>{order === 'copied' ? 'The list is copied.' : 'The list was saved as an .xml file (copying wasn’t allowed here).'} Sign in to BrickLink in the tab that opened.</li>
            <li>{order === 'copied' ? 'Paste into the box (Ctrl/⌘ + V)' : 'Choose the saved .xml file, or open it and paste its text into the box'}, then press <b>Proceed to verify items</b> and <b>Add to Wanted List</b>.</li>
            <li>
              Open the new Wanted List and press <b>Buy All</b>. <b>Easy Buy</b> picks the fewest shops that can fill the whole order.
            </li>
          </ol>
        )}
        <p className="order-note">
          LEGO’s own Pick a Brick can’t import a list, so its parts have to be added there one at a time; the CSV below has every part number and
          color to search for. A few rare elements may only be available used.
        </p>
      </section>
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
          <button className="chip" onClick={() => save(`${slug}.ldr`, toLDraw(model))} title="LDraw model with build steps (opens in BrickLink Studio, LeoCAD, LDView…)">
            ⬇ LDraw .ldr
          </button>
          <button className="chip" onClick={() => save(`${slug}-bricklink.xml`, toBrickLinkXML(model))} title="Upload as a BrickLink Wanted List">
            ⬇ BrickLink XML
          </button>
          <button className="chip" onClick={() => save(`${slug}-parts.csv`, toCSV(model))}>
            ⬇ CSV
          </button>
          {status && <span className="muted save-status">{status}</span>}
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
              const img = partImage(it.part, it.color, 26);
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
