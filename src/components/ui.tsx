import type { ReactNode } from 'react';

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-page flex items-center gap-3"><span aria-hidden className="inline-block h-7 w-2.5 border-2 border-outline bg-accent" />{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/** Three small coins: how directly a task earns money. */
export function Money({ n }: { n: number }) {
  if (!n) return null;
  return <span className="inline-flex items-center gap-0.5 text-good" title={['', 'Supports revenue', 'Likely brings revenue', 'Brings revenue directly'][n]} aria-label={`money ${n} of 3`}>{'$'.repeat(n)}</span>;
}

export function Bar({ value, max, color = 'var(--good)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** A tiny line of the last few values. */
export function Spark({ values, width = 120, height = 34, color = 'var(--good)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <span className="text-faint text-xs">not enough months yet</span>;
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / (max - min || 1)) * (height - 6)}`).join(' ');
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export const fmtUsd = (n: number) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
