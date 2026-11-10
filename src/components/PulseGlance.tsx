"use client";
import Link from 'next/link';
import { usePulse } from '@/lib/usePulse';

const cash = (c: string, n: number) => `${c === 'USD' ? '$' : c === 'EUR' ? '€' : c + ' '}${String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d)(?=\.|$))/g, ',')}`;
function Delta({ a, b }: { a: number; b: number }) {
  if (a === b) return <span className="text-faint">same as last week</span>;
  return <span className={a > b ? 'text-good' : 'text-bad'}>{a > b ? '▲' : '▼'} {b === 0 ? 'from 0' : `${Math.abs(Math.round(((a - b) / b) * 100))}%`} vs {b}</span>;
}
function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return <div className="card card-pad"><p className="label">{label}</p><p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">{value}</p><p className="mt-2 text-[12.5px]">{children}</p></div>;
}

/** The business in four tiles, for the Overview. Quiet when a source is not connected: the Pulse page explains why. */
export function PulseGlance() {
  const { pulse, error } = usePulse();
  if (error && !pulse) return <p className="text-muted">Business numbers unavailable: {error}</p>;
  if (!pulse) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="card card-pad h-[104px] animate-pulse" />)}</div>;
  const d = pulse.dodo.state === 'ready' ? pulse.dodo.data : null;
  const n = pulse.nexora.state === 'ready' ? pulse.nexora.data : null;
  if (!d && !n) return <p className="text-muted">Business numbers are not connected yet. <Link href="/pulse" className="underline">See why</Link>.</p>;
  const usd = d?.settled.find((s) => s.currency === 'USD');
  return (
    <section aria-label="Business, last 7 days">
      <div className="mb-2 flex items-baseline justify-between"><p className="label">Business, last 7 days</p><Link href="/pulse" className="text-[13px] text-muted hover:text-ink">Details</Link></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d && <Tile label="Revenue (USD, net of tax)" value={usd ? cash('USD', usd.thisWeek) : '$0'}><Delta a={usd?.thisWeek ?? 0} b={usd?.lastWeek ?? 0} /></Tile>}
        {d && <Tile label="New paying customers" value={String(d.newCustomersThisWeek)}><Delta a={d.newCustomersThisWeek} b={d.newCustomersLastWeek} /></Tile>}
        {n && <Tile label="Signups (Google)" value={String(n.signups.thisWeek)}><Delta a={n.signups.thisWeek} b={n.signups.lastWeek} /></Tile>}
        {n && <Tile label="Paying now" value={String(n.entitledNow.total)}><span className="text-faint">{n.entitledNow.expiringIn7Days} run out within 7 days</span></Tile>}
      </div>
    </section>
  );
}
