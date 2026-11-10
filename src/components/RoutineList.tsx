"use client";
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import type { RoutineItem, Zone } from '@/lib/store';
import { Money } from './ui';

export function RoutineList({ items, manage = false, zones = [] }: { items: (RoutineItem & { runsToday: boolean })[]; manage?: boolean; zones?: Zone[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(items.map((i) => [i.id, i.doneToday])));
  const [title, setTitle] = useState(''); const [zone, setZone] = useState(zones[0]?.id ?? ''); const [minutes, setMinutes] = useState(''); const [money, setMoney] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => { setOn((s) => ({ ...s, [id]: !s[id] })); start(async () => { try { await call(`/api/routines/${id}`, 'POST'); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setOn((s) => ({ ...s, [id]: !s[id] })); } }); };
  const remove = (id: string) => start(async () => { await call(`/api/routines/${id}`, 'DELETE'); router.refresh(); });
  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await call('/api/routines', 'POST', { title, zone, minutes: minutes ? Number(minutes) : undefined, money }); setTitle(''); setMinutes(''); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
  }

  return (
    <div>
      <ul className="space-y-0.5">
        {items.length === 0 && <li className="text-faint">No routine yet.</li>}
        {items.map((r) => (
          <li key={r.id} className={`group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface2 ${!r.runsToday && !manage ? 'opacity-50' : ''}`}>
            <button type="button" className="check" data-on={!!on[r.id]} onClick={() => toggle(r.id)} aria-label={on[r.id] ? `Untick ${r.title}` : `Tick ${r.title}`}>{on[r.id] && <Check className="h-3 w-3" strokeWidth={3} />}</button>
            <span className={`flex-1 ${on[r.id] ? 'text-faint line-through' : ''}`}>{r.title}</span>
            <span className="flex items-center gap-3 text-[12.5px] text-muted">
              {r.zoneName && <span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: r.zoneColor ?? undefined }} />{r.zoneName}</span>}
              {r.minutes && <span>{r.minutes} min</span>}<Money n={r.money} />
              {manage && <button type="button" className="rounded-lg p-1.5 text-faint opacity-0 hover:text-bad group-hover:opacity-100" aria-label={`Remove ${r.title}`} onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>}
            </span>
          </li>
        ))}
      </ul>
      {manage && (
        <form onSubmit={add} className="mt-5 grid gap-2 sm:grid-cols-[1fr_150px_90px_150px_auto]">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a daily routine" aria-label="Routine" />
          <select className="select" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          <input className="input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="min" aria-label="Minutes" />
          <select className="select" value={money} onChange={(e) => setMoney(Number(e.target.value))} aria-label="Money link"><option value={0}>No money link</option><option value={1}>$</option><option value={2}>$$</option><option value={3}>$$$</option></select>
          <button className="btn btn-primary" disabled={!title.trim()}><Plus className="h-4 w-4" />Add</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-bad">{error}</p>}
    </div>
  );
}
