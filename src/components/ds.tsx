/**
 * The Compass design system (Pixel Quest). Small, server-safe building blocks used by every page.
 * Colours come only from the CSS tokens in globals.css, so both themes work everywhere.
 * Interactive pieces (modal, toast, timer, capture bar) live in ds-client.tsx.
 */
import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { monthLabel } from '@/lib/dates';

/* ----------------------------------------------------------------------------------------------- avatars */
// A 12x12 sprite: H hair, S skin, T shirt, E eye, C cap. Six variants to pick from.
const SPRITES: Record<'short' | 'long' | 'cap', string[]> = {
  short: ['...HHHHHH...', '..HHHHHHHH..', '..HSSSSSSH..', '..HSESSESH..', '..SSSSSSSS..', '...SSSSSS...', '....SSSS....', '..TTTTTTTT..', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.'],
  long: ['...HHHHHH...', '..HHHHHHHH..', '.HHSSSSSSHH.', '.HHSESSESHH.', '.HHSSSSSSHH.', '.HH.SSSS.HH.', '.HH..SS..HH.', '..TTTTTTTT..', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.'],
  cap: ['..CCCCCCCC..', '.CCCCCCCCCC.', '..HHHHHHHH..', '..HSESSESH..', '..SSSSSSSS..', '...SSSSSS...', '....SSSS....', '..TTTTTTTT..', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.', '.TTTTTTTTTT.'],
};
export const AVATARS: { name: string; style: keyof typeof SPRITES; hair: string; skin: string; shirt: string }[] = [
  { name: 'Explorer', style: 'short', hair: '#4a3022', skin: '#e8b890', shirt: '#f6c12e' },
  { name: 'Ranger', style: 'cap', hair: '#2d2a32', skin: '#c68b5e', shirt: '#2e8f55' },
  { name: 'Mage', style: 'long', hair: '#7a3b8f', skin: '#f2cfae', shirt: '#4b5bd6' },
  { name: 'Scout', style: 'short', hair: '#b4572b', skin: '#f2cfae', shirt: '#c8453f' },
  { name: 'Pilot', style: 'cap', hair: '#1d1b25', skin: '#8d5a3a', shirt: '#3aa7b8' },
  { name: 'Sage', style: 'long', hair: '#d8d2c4', skin: '#e8b890', shirt: '#7c5cc4' },
];

export function PixelAvatar({ index = 0, size = 40, label }: { index?: number; size?: number; label?: string }) {
  const a = AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length];
  const color: Record<string, string> = { H: a.hair, S: a.skin, T: a.shirt, E: '#221e3a', C: '#f6c12e' };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" role="img" aria-label={label ?? `${a.name} avatar`} style={{ imageRendering: 'pixelated', borderRadius: 6, background: 'var(--navy2)', border: '2px solid var(--outline)' }}>
      {SPRITES[a.style].flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color[c]} />)))}
    </svg>
  );
}

/* ------------------------------------------------------------------------------------- badges and signals */
const STATUS = {
  todo: { label: 'Planned', cls: 'bg-[#f8dc7a] text-[#4a3500]' },
  doing: { label: 'In progress', cls: 'bg-[#b9c8f5] text-[#1f2a66]' },
  done: { label: 'Done', cls: 'bg-[#b6e3bf] text-[#0f4a24]' },
  overdue: { label: 'Overdue', cls: 'bg-[#f5b5b1] text-[#6b1511]' },
} as const;
export type StatusKey = keyof typeof STATUS;
export function StatusBadge({ status, label }: { status: StatusKey; label?: string }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center rounded-md border-2 border-outline/60 px-2.5 py-0.5 text-[12.5px] font-semibold ${s.cls}`}>{label ?? s.label}</span>;
}

const PRIORITY = { 1: { label: 'High priority', color: 'var(--bad)', bars: 3 }, 2: { label: 'Normal priority', color: 'var(--warn)', bars: 2 }, 3: { label: 'Low priority', color: 'var(--faint)', bars: 1 } } as const;
/** Three small bars: how many are filled says how urgent. Always has a text alternative. */
export function PriorityDot({ priority }: { priority: 1 | 2 | 3 | number }) {
  const p = PRIORITY[(priority as 1 | 2 | 3)] ?? PRIORITY[2];
  return (
    <span className="tip inline-flex items-end gap-[2px]" data-tip={p.label} role="img" aria-label={p.label}>
      {[1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 4 + i * 3, background: i <= p.bars ? p.color : 'var(--line)', borderRadius: 1 }} />)}
    </span>
  );
}

export function StreakBadge({ days, label = 'day streak' }: { days: number; label?: string }) {
  const on = days > 0;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-[13px] font-semibold ${on ? 'border-outline bg-accent text-on-accent' : 'border-line bg-surface2 text-muted'}`} title="Days in a row with at least one task finished">
      <Flame className="h-4 w-4" aria-hidden />{days} {label}
    </span>
  );
}

/** A stepped (not smooth) progress ring: a number in the middle, a caption under it. value is 0 to 1. */
export function ProgressRing({ value, size = 112, caption = 'Progress' }: { value: number; size?: number; caption?: string }) {
  const v = Math.max(0, Math.min(1, value)); const r = 44; const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)} percent ${caption.toLowerCase()}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="11" strokeDasharray="4 3" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="11" strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <div className="absolute text-center leading-tight"><p className="font-pixel text-[29px] font-bold">{Math.round(v * 100)}%</p><p className="text-[12px] text-muted">{caption}</p></div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : '';
  const bar = tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  return <div className="card card-pad relative overflow-hidden"><span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: bar }} /><p className="label mt-1">{label}</p><p className={`font-pixel mt-2 text-[28px] font-bold leading-none tabular-nums ${color}`}>{value}</p>{hint && <p className="mt-2 text-[12.5px] text-muted">{hint}</p>}</div>;
}

/** A card with a pixel-font title and an optional action on the right. */
export function Panel({ title, icon, action, children, className = '' }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card card-pad ${className}`} aria-label={title}>
      <header className="mb-3 flex items-center justify-between gap-3"><h2 className="h-card flex items-center gap-2.5">{icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 border-outline bg-accent/40">{icon}</span>}{title}</h2>{action}</header>
      {children}
    </section>
  );
}

/** One week as bars: how many tasks fall on each day, with the finished part filled in. Today is highlighted. */
export function WeekBars({ days }: { days: { key: string; label: string; date: number; total: number; done: number; today: boolean }[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="This week">
      {days.map((d) => (
        <li key={d.key} className={`rounded-md border-2 px-1 pb-1.5 pt-2 text-center ${d.today ? 'border-outline bg-accent/25' : 'border-transparent'}`}>
          <div className="mx-auto flex h-[84px] w-full max-w-[34px] flex-col justify-end overflow-hidden rounded-sm bg-line/60" role="img" aria-label={`${d.label} ${d.date}: ${d.total} task${d.total === 1 ? '' : 's'}, ${d.done} done`}>
            <div className="w-full bg-accent/60" style={{ height: `${((d.total - d.done) / max) * 100}%`, minHeight: d.total - d.done > 0 ? 6 : 0 }} />
            <div className="w-full bg-good" style={{ height: `${(d.done / max) * 100}%`, minHeight: d.done > 0 ? 6 : 0 }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">{d.label}</p>
          <p className="font-pixel text-[20px] font-bold tabular-nums">{d.total}</p>
        </li>
      ))}
    </ol>
  );
}

/** A month grid, Monday first. A dot under a day means tasks are due that day; today is filled gold. */
export function MiniCalendar({ today, counts }: { today: string; counts: Record<string, number> }) {
  const [y, m] = today.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; const total = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const key = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <div aria-label={`Calendar, ${monthLabel(today.slice(0, 7))}`}>
      <p className="h-card mb-2">{monthLabel(today.slice(0, 7))}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="text-[12px] font-semibold text-faint">{d}</span>)}
        {cells.map((d, i) => d === null ? <span key={`b${i}`} /> : (
          <span key={d} className={`flex h-9 flex-col items-center justify-center rounded-md border-2 text-[13px] ${key(d) === today ? 'border-outline bg-accent font-bold text-on-accent' : 'border-transparent'}`} aria-label={`${key(d)}: ${counts[key(d)] ?? 0} tasks due`}>
            {d}
            <span className="mt-0.5 flex h-1 gap-[2px]">{Array.from({ length: Math.min(3, counts[key(d)] ?? 0) }, (_, k) => <span key={k} className="h-1 w-1 rounded-[1px]" style={{ background: key(d) === today ? 'var(--on-accent)' : 'var(--accent-ink)' }} />)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ empty states */
const SPRITES_EMPTY: Record<'sprout' | 'star', { rows: string[]; colors: Record<string, string> }> = {
  sprout: { rows: ['..LL..LL..', '.LLLL.LLL.', '.LLLL.LLL.', '..LL.LL...', '...LLL....', '....S.....', '....S.....', '..DDDDDD..', '.DDDDDDDD.'], colors: { L: '#4fbf6b', S: '#2e8f55', D: '#8a5a2b' } },
  star: { rows: ['....Y....', '....Y....', '...YYY...', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '.YYY.YYY.', '.YY...YY.'], colors: { Y: '#f6c12e' } },
};
/** A small pixel sprite and a line of text, for a list or column with nothing in it yet. */
export function Empty({ children, sprite = 'sprout' }: { children: ReactNode; sprite?: 'sprout' | 'star' }) {
  const d = SPRITES_EMPTY[sprite]; const w = d.rows[0].length;
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-5 text-center text-muted">
      <svg width={w * 4} height={d.rows.length * 4} viewBox={`0 0 ${w} ${d.rows.length}`} shapeRendering="crispEdges" aria-hidden>
        {d.rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={d.colors[c]} />)))}
      </svg>
      <p>{children}</p>
    </div>
  );
}
