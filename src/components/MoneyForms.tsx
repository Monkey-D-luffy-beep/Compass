"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import { monthLabel } from '@/lib/dates';
import type { Goal, RevenueRow } from '@/lib/store';
import { fmtUsd } from './ui';

/** Log what each product earned in a month. Saving the same product and month again replaces the number. */
export function RevenueForm({ month, sources }: { month: string; sources: string[] }) {
  const router = useRouter();
  const [m, setM] = useState(month); const [source, setSource] = useState(sources[0] ?? ''); const [amount, setAmount] = useState(''); const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await call('/api/revenue', 'POST', { month: m, source, amount: Number(amount) }); setAmount(''); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  return (
    <form onSubmit={save} className="grid gap-2 sm:grid-cols-[140px_1fr_130px_auto]">
      <input className="input" type="month" value={m} onChange={(e) => setM(e.target.value)} aria-label="Month" />
      <input className="input" list="rev-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Product (e.g. ListLift)" aria-label="Product" />
      <datalist id="rev-sources">{sources.map((s) => <option key={s} value={s} />)}</datalist>
      <input className="input" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in $" aria-label="Amount in dollars" />
      <button className="btn btn-primary" disabled={!source.trim() || amount === ''}><Plus className="h-4 w-4" />Save</button>
      {error && <p role="alert" className="text-bad sm:col-span-4">{error}</p>}
    </form>
  );
}

export function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  const router = useRouter();
  if (!rows.length) return <p className="text-faint">Nothing logged yet.</p>;
  return (
    <table className="w-full text-left">
      <thead><tr className="label"><th className="py-2 font-semibold">Month</th><th className="font-semibold">Product</th><th className="text-right font-semibold">Amount</th><th /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="group border-t border-line">
            <td className="py-2.5 text-muted">{monthLabel(r.month)}</td><td>{r.source}</td><td className="text-right tabular-nums">{fmtUsd(r.amount)}</td>
            <td className="w-8 text-right"><button className="rounded-lg p-1.5 text-faint opacity-0 hover:text-bad group-hover:opacity-100" aria-label={`Delete ${r.source} ${r.month}`} onClick={async () => { await call(`/api/revenue/${r.id}`, 'DELETE'); router.refresh(); }}><Trash2 className="h-4 w-4" /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A goal with a number you update by hand. */
export function GoalProgress({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [value, setValue] = useState(String(goal.current)); const [saved, setSaved] = useState(false);
  async function save() { await call(`/api/goals/${goal.id}`, 'PATCH', { current: Number(value) }); setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
  return (
    <div className="flex items-center gap-2">
      <input className="input !w-24 !py-1" type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Current value for ${goal.title}`} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <span className="text-muted">of {goal.target} {goal.unit}</span>{saved && <span className="text-good text-[12.5px]">Saved</span>}
    </div>
  );
}

export function GoalForm({ zones }: { zones: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(''); const [target, setTarget] = useState(''); const [unit, setUnit] = useState(''); const [zone, setZone] = useState(zones[0]?.id ?? ''); const [error, setError] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await call('/api/goals', 'POST', { title, target: Number(target), unit, zone }); setTitle(''); setTarget(''); setUnit(''); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
  }
  return (
    <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_110px_90px_150px_auto]">
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A goal, e.g. Publish 4 blog posts" aria-label="Goal" />
      <input className="input" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" aria-label="Target" />
      <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" aria-label="Unit" />
      <select className="select" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <button className="btn btn-primary" disabled={!title.trim() || !target}><Plus className="h-4 w-4" />Add</button>
      {error && <p role="alert" className="text-bad sm:col-span-5">{error}</p>}
    </form>
  );
}

export function DeleteGoal({ id }: { id: string }) {
  const router = useRouter();
  return <button className="rounded-lg p-1.5 text-faint hover:text-bad" aria-label="Delete goal" onClick={async () => { await call(`/api/goals/${id}`, 'DELETE'); router.refresh(); }}><Trash2 className="h-4 w-4" /></button>;
}
