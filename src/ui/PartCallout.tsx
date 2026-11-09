import { useMemo } from 'react';
import type { InvItem } from '../lego/inventory';
import { partImage } from '../render/pageRenderer';

/** The rounded "parts needed for this step" box from LEGO manuals: part renders with "2x" counts. */
export function PartCallout({ items, scale = 16, className = '' }: { items: InvItem[]; scale?: number; className?: string }) {
  const imgs = useMemo(() => items.map((it) => ({ it, img: partImage(it.part, it.color, scale) })), [items, scale]);
  if (!items.length) return null;
  return (
    <div className={`callout ${className}`}>
      {imgs.map(({ it, img }) => (
        <div className="callout-part" key={`${it.part}|${it.color}`}>
          <img src={img.url} width={img.w} height={img.h} alt="" draggable={false} />
          <span className="qty">{it.count}x</span>
        </div>
      ))}
    </div>
  );
}

export function RotateIcon({ size = 44 }: { size?: number }) {
  return (
    <svg className="rotate-icon" width={size} height={size} viewBox="0 0 48 48" aria-label="Turn the model around">
      <rect x="1" y="1" width="46" height="46" rx="9" fill="#F4F8FB" stroke="#9FB6C9" strokeWidth="1.5" />
      <path d="M12 26a12 12 0 0 1 21-8" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 11v8h-8" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 22a12 12 0 0 1-21 8" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 37v-8h8" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BagIcon({ n, size = 64 }: { n: number; size?: number }) {
  return (
    <svg className="bag-icon" width={size} height={size * 1.15} viewBox="0 0 64 74" aria-label={`Bag ${n}`}>
      <path d="M8 10 L56 10 L58 66 Q32 72 6 66 Z" fill="#ffffff" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 10 Q32 4 56 10" fill="none" stroke="#1A1A1A" strokeWidth="2.5" />
      <path d="M10 18 L54 18" stroke="#9FB6C9" strokeWidth="2" strokeDasharray="3 3" />
      <text x="32" y="52" textAnchor="middle" fontFamily="Outfit, Inter, sans-serif" fontWeight="800" fontSize="28" fill="#1A1A1A">
        {n}
      </text>
    </svg>
  );
}

export function Studs({ n, of = 5 }: { n: number; of?: number }) {
  return (
    <span className="studs" aria-label={`Difficulty ${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}
