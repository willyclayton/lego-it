import { useEffect, useMemo, useState } from 'react';
import { color } from '../lego/colors';
import { loadElements, onlyElements, orderList, orderXML, pickABrickCSV, toBrickLinkXML, toCSV, toLDraw, type OrderList } from '../lego/export';
import { inArtifact, saveFile } from '../host';
import { colorsUsed, inventory, sortParts, type InvItem } from '../lego/inventory';
import { part } from '../lego/parts';
import type { Model } from '../lego/types';
import { partImage } from '../render/pageRenderer';

type GroupBy = 'color' | 'type';
type Shop = 'lego' | 'bricklink' | 'brickowl';

const SHOPS: Record<Shop, { name: string; blurb: string; url: string; steps: (copied: boolean, files: number, o?: OrderList | null) => string[] }> = {
  lego: {
    name: 'LEGO Pick a Brick',
    blurb: 'New parts straight from LEGO',
    url: 'https://www.lego.com/pick-and-build/pick-a-brick',
    steps: (_c, files, o) => [
      files > 1
        ? `The list was saved as ${files} files: Pick a Brick takes at most 999 pieces per upload.`
        : 'The list was saved as a .csv file.',
      'On the Pick a Brick page that opened, choose <b>Upload List</b> and pick the file. Everything LEGO sells right now goes into your bag.',
      `Pick a Brick then lists any pieces it can’t sell${
        o && o.old.lines ? ` (expect about ${o.old.lines} of ${o.lines.length} lines here: those elements haven’t been in a LEGO set since 2023)` : ''
      }. Use its <b>Download</b> button and load that file below to order just those from BrickLink or Brick Owl.`,
    ],
  },
  bricklink: {
    name: 'BrickLink',
    blurb: 'Marketplace, new and used',
    url: 'https://www.bricklink.com/v2/wanted/upload.page',
    steps: (copied) => [
      `${copied ? 'The list is copied.' : 'The list was saved as an .xml file.'} Sign in to BrickLink in the tab that opened.`,
      `${copied ? 'Paste it into the box (Ctrl/⌘ + V)' : 'Open the saved file and paste its text into the box'}, then press <b>Proceed to verify items</b> and <b>Add to Wanted List</b>.`,
      'Open the Wanted List and press <b>Buy All</b>; <b>Easy Buy</b> picks the fewest shops that have everything.',
    ],
  },
  brickowl: {
    name: 'Brick Owl',
    blurb: 'Marketplace, new and used',
    url: 'https://www.brickowl.com/wishlist',
    steps: (copied) => [
      `${copied ? 'The list is copied.' : 'The list was saved as an .xml file.'} Sign in to Brick Owl in the tab that opened.`,
      `In <b>Wishlist</b>, choose <b>Import</b>, pick the <b>BrickLink XML</b> format and ${copied ? 'paste the list' : 'paste the file’s text'}.`,
      'Set the condition to <b>New</b> if you want new parts (imports start as “any”), then use <b>Buy</b> on the wishlist to find stores.',
    ],
  },
};

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

  const [order, setOrder] = useState<OrderList | null>(null);
  useEffect(() => {
    let alive = true;
    void loadElements().then((t) => alive && setOrder(orderList(model, t)));
    return () => {
      alive = false;
    };
  }, [model]);
  const [step, setStep] = useState<null | { shop: Shop; copied: boolean }>(null);
  const pieces = model.bricks.length;

  /** Open the shop's import page inside the click (so pop-up blockers allow it), then hand over the list. */
  const go = async (shop: Shop) => {
    if (!order) return;
    window.open(SHOPS[shop].url, '_blank', 'noopener');
    if (shop === 'lego') {
      const files = pickABrickCSV(order);
      for (let i = 0; i < files.length; i++) await saveFile(files.length > 1 ? `${slug}-pick-a-brick-${i + 1}.csv` : `${slug}-pick-a-brick.csv`, files[i]);
      setStep({ shop, copied: false });
      return;
    }
    const xml = orderXML(order);
    try {
      await navigator.clipboard.writeText(xml);
      setStep({ shop, copied: true });
    } catch {
      await saveFile(`${slug}-wanted-list.xml`, xml);
      setStep({ shop, copied: false });
    }
  };
  const [rest, setRest] = useState<OrderList | null>(null);
  const [restMsg, setRestMsg] = useState<string | null>(null);
  const loadRest = (text: string) => {
    if (!order) return;
    const r = onlyElements(order, text);
    setRest(r.lines.length ? r : null);
    setRestMsg(
      r.lines.length
        ? `${r.lines.length} ${r.lines.length === 1 ? 'line' : 'lines'}, ${r.lines.reduce((n, l) => n + l.count, 0)} pieces from this model. Send them to:`
        : 'None of those element IDs are in this model’s list.',
    );
  };
  const sendRest = async (shop: 'bricklink' | 'brickowl') => {
    if (!rest) return;
    window.open(SHOPS[shop].url, '_blank', 'noopener');
    const xml = orderXML(rest);
    try {
      await navigator.clipboard.writeText(xml);
      setRestMsg(`Copied. In the ${SHOPS[shop].name} tab: ${shop === 'bricklink' ? 'paste into the upload box and verify' : 'Wishlist → Import → BrickLink XML, paste'}.`);
    } catch {
      await saveFile(`${slug}-not-on-pick-a-brick.xml`, xml);
      setRestMsg(`Saved as an .xml file. In the ${SHOPS[shop].name} tab, paste its text into the import box.`);
    }
  };
  const swappedCount = order ? order.swapped.reduce((n, x) => n + x.count, 0) : 0;
  const pabFiles = order ? pickABrickCSV(order).length : 1;

  return (
    <div className="parts">
      <section className="order" aria-label="Order the parts">
        <h3>Order the parts</h3>
        <p className="order-lead">
          Every one of the {pieces} pieces ({items.length} elements), matched to real LEGO part and element numbers. Pick a shop: the list is handed
          over and its import page opens in a new tab.
        </p>
        <div className="order-shops">
          {(Object.keys(SHOPS) as Shop[]).map((k) => (
            <button key={k} className={`order-shop ${step?.shop === k ? 'on' : ''}`} onClick={() => void go(k)} disabled={!order}>
              <b>{SHOPS[k].name} ›</b>
              <span>{SHOPS[k].blurb}</span>
            </button>
          ))}
        </div>
        {step && (
          <ol className="order-steps">
            {SHOPS[step.shop].steps(step.copied, pabFiles, order).map((t, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t }} />
            ))}
          </ol>
        )}
        {step?.shop === 'lego' && (
          <div className="order-rest">
            <b>Pieces Pick a Brick couldn’t add?</b> Load the file from its <b>Download</b> button, or paste the element IDs, to order just those
            elsewhere.
            <div className="order-rest-row">
              <label className="chip">
                Load file
                <input
                  type="file"
                  accept=".csv,.xml,.txt,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void f.text().then(loadRest);
                    e.target.value = '';
                  }}
                />
              </label>
              <input className="order-paste" placeholder="or paste IDs, e.g. 6228588 4218987" onChange={(e) => e.target.value.trim() && loadRest(e.target.value)} />
            </div>
            {restMsg && (
              <p className="order-rest-msg">
                {restMsg}
                {rest && (
                  <>
                    {' '}
                    <button className="chip" onClick={() => void sendRest('bricklink')}>
                      BrickLink ›
                    </button>{' '}
                    <button className="chip" onClick={() => void sendRest('brickowl')}>
                      Brick Owl ›
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        )}
        {order && swappedCount > 0 && (
          <details className="order-swaps">
            <summary>
              {swappedCount} {swappedCount === 1 ? 'piece isn’t' : 'pieces aren’t'} made by LEGO in the model’s colour, so the order uses the closest colour
              that exists
            </summary>
            <ul>
              {order.swapped.map((x) => (
                <li key={`${x.part}|${x.from}`}>
                  {x.count}× {part(x.part).name}: <i className="swatch" style={{ background: color(x.from).hex }} /> {color(x.from).name} →{' '}
                  <i className="swatch" style={{ background: color(x.to).hex }} /> {color(x.to).name}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="order-note">
          Matched with the Rebrickable catalog. Availability and prices are up to each shop; Pick a Brick doesn’t stock every element, and the
          marketplaces can fill the rest.
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
          <button className="chip" onClick={() => save(`${slug}-bricklink.xml`, order ? orderXML(order) : toBrickLinkXML(model))} title="Upload as a BrickLink Wanted List">
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
