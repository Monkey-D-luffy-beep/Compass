"use client";
import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { call } from '@/lib/client';
import { usePulse } from '@/lib/usePulse';
import { Markdown } from '@/components/Markdown';

const WEEKLY = 'Give me my weekly update from the business pulse: what is new this week against last week (revenue, new customers, signups, uninstalls, usage, who is about to expire), what it means for the $1,000 a month goal, and the top three things to do about it. Use only the numbers in the pulse; say plainly what is missing.';

const money = (c: string, n: number) => `${c === 'USD' ? '$' : c === 'INR' ? '₹' : c + ' '}${String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d)(?=\.|$))/g, ',')}`;
function Delta({ a, b }: { a: number; b: number }) {
  if (a === b) return <span className="text-faint">same as last week</span>;
  const up = a > b;
  return <span className={up ? 'text-good' : 'text-bad'}>{up ? '▲' : '▼'} {b === 0 ? 'from 0' : `${Math.abs(Math.round(((a - b) / b) * 100))}%`} vs {b}</span>;
}
function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return <div className="card card-pad"><p className="label">{label}</p><p className="mt-2 text-[28px] font-semibold leading-none tabular-nums">{value}</p><p className="mt-2 text-[13px]">{children}</p></div>;
}
function Missing({ title, why, error }: { title: string; why: string; error?: boolean }) {
  return <section className="card card-pad"><p className="label">{title}</p><p className={`mt-2 ${error ? 'text-bad' : 'text-muted'}`}>{why}</p></section>;
}

export function PulsePanel() {
  const { pulse, error, busy, reload } = usePulse();
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);

  async function writeBrief() {
    setBriefBusy(true); setBrief(null);
    try { const m = await call<{ role: string; content: string }[]>('/api/assistant', 'POST', { question: WEEKLY }); setBrief(m.filter((x) => x.role === 'assistant').pop()?.content ?? 'No answer.'); }
    catch (e) { setBrief(e instanceof Error ? e.message : 'Could not write it.'); }
    finally { setBriefBusy(false); }
  }

  if (error) return <p role="alert" className="text-bad">{error}</p>;
  if (!pulse) return <p className="text-muted">Loading…</p>;
  const d = pulse.dodo.state === 'ready' ? pulse.dodo.data : null;
  const n = pulse.nexora.state === 'ready' ? pulse.nexora.data : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={writeBrief} disabled={briefBusy}><Sparkles className="mr-1.5 inline h-4 w-4" />{briefBusy ? 'Writing…' : 'Write my weekly update'}</button>
        <button className="btn" onClick={reload} disabled={busy}><RefreshCw className={`mr-1.5 inline h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
        <span className="text-[12.5px] text-faint">Updated {new Date(pulse.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
      </div>
      {brief && <section className="card card-pad"><p className="label mb-2">Your week</p><Markdown text={brief} /></section>}

      {pulse.dodo.state === 'not-set-up' && <Missing title="Money (Dodo)" why={pulse.dodo.why} />}
      {pulse.dodo.state === 'error' && <Missing title="Money (Dodo)" why={pulse.dodo.why} error />}
      {d && (
        <section>
          <p className="label mb-2">Money, from Dodo</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.settled.length === 0 && <Tile label="Revenue, 7 days" value="0">No settled payments in 14 days.</Tile>}
            {d.settled.map((r) => <Tile key={'s' + r.currency} label={`Settled ${r.currency}, net of tax`} value={money(r.currency, r.thisWeek)}><Delta a={r.thisWeek} b={r.lastWeek} /></Tile>)}
            <Tile label="New paying customers" value={String(d.newCustomersThisWeek)}><Delta a={d.newCustomersThisWeek} b={d.newCustomersLastWeek} /></Tile>
            <Tile label="Failed payments" value={String(d.failedThisWeek)}><span className="text-faint">this week</span></Tile>
            {d.activeSubscriptions !== null && <Tile label="Active subscriptions" value={String(d.activeSubscriptions)}><span className="text-faint">{d.cancellingSubscriptions} set to end at next billing</span></Tile>}
          </div>
          <p className="mt-2 text-[12.5px] text-faint">“Settled” is what Dodo credits you after converting and removing tax, before Dodo’s own fees; “New” means a first payment inside the last {d.historyDays} days of history.{d.truncated && ' History was cut at the page limit, totals may be low.'}</p>
        </section>
      )}

      {pulse.nexora.state === 'not-set-up' && <Missing title="Nexora dashboard" why={pulse.nexora.why} />}
      {pulse.nexora.state === 'error' && <Missing title="Nexora dashboard" why={pulse.nexora.why} error />}
      {n && (
        <section>
          <p className="label mb-2">Users, from the Nexora dashboard</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Signups (Google)" value={String(n.signups.thisWeek)}><Delta a={n.signups.thisWeek} b={n.signups.lastWeek} /></Tile>
            <Tile label="Uninstall forms" value={String(n.uninstalls.thisWeek)}><Delta a={n.uninstalls.thisWeek} b={n.uninstalls.lastWeek} /></Tile>
            <Tile label="Paying and entitled now" value={String(n.entitledNow.total)}><span className="text-faint">{n.entitledNow.expiringIn7Days} run out within 7 days</span></Tile>
            {Object.keys({ ...n.usage.thisWeek, ...n.usage.lastWeek }).map((k) => (
              <Tile key={k} label={`Usage: ${k}`} value={String(n.usage.thisWeek[k]?.events ?? 0)}><Delta a={n.usage.thisWeek[k]?.events ?? 0} b={n.usage.lastWeek[k]?.events ?? 0} /> <span className="text-faint">· {n.usage.thisWeek[k]?.users ?? 0} users</span></Tile>
            ))}
          </div>
          {n.uninstalls.reasonsThisWeek.length > 0 && <details className="mt-3 text-muted"><summary className="cursor-pointer">Why people uninstalled this week</summary><ul className="mt-2 list-disc space-y-1 pl-5">{n.uninstalls.reasonsThisWeek.map((r, i) => <li key={i}>{r}</li>)}</ul></details>}
          <p className="mt-2 text-[12.5px] text-faint">Signups and uninstall forms count different people, so do not subtract one from the other.</p>
        </section>
      )}
    </div>
  );
}
