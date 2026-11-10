"use client";
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { call } from '@/lib/client';
import type { When } from '@/lib/dates';
import { KINDS, type Zone } from '@/lib/store';

/** Add a task in one line. Everything after the title is optional. */
export function QuickAdd({ zones, when, defaultZone, compact = false }: { zones: Zone[]; when?: When; defaultZone?: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState(defaultZone ?? zones[0]?.id ?? '');
  const [pick, setPick] = useState<When>(when ?? 'week');
  const [money, setMoney] = useState(0);
  const [kind, setKind] = useState('build');
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    start(async () => {
      setError(null);
      try {
        await call('/api/tasks', 'POST', { title, zone: defaultZone ?? zone, when: when ?? pick, money, kind });
        setTitle(''); setMoney(0); router.refresh();
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={compact ? 'Add a task' : 'What needs doing?'} aria-label="New task" maxLength={300} />
        <button className="btn btn-primary shrink-0" disabled={busy || !title.trim()} aria-label="Add task"><Plus className="h-4 w-4" />{compact ? '' : 'Add'}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {!defaultZone && (
          <select className="select !w-auto" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        )}
        {!when && (
          <select className="select !w-auto" value={pick} onChange={(e) => setPick(e.target.value as When)} aria-label="When">
            <option value="today">Today</option><option value="week">This week</option><option value="next">Next week</option><option value="month">This month</option><option value="later">Later</option>
          </select>
        )}
        <select className="select !w-auto" value={money} onChange={(e) => setMoney(Number(e.target.value))} aria-label="How directly it earns money">
          <option value={0}>No money link</option><option value={1}>$ supports revenue</option><option value={2}>$$ likely revenue</option><option value={3}>$$$ direct revenue</option>
        </select>
        {!compact && <button type="button" className="text-muted hover:text-ink" onClick={() => setMore(!more)}>{more ? 'Less' : 'More'}</button>}
        {more && (
          <select className="select !w-auto" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of work">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
    </form>
  );
}
