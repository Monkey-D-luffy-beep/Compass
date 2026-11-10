"use client";
import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { call } from '@/lib/client';
import type { Task } from '@/lib/store';
import type { When } from '@/lib/dates';

const KINDS = ['build', 'growth', 'maintenance', 'study', 'admin'];
const WHENS: { when: When; label: string }[] = [
  { when: 'today', label: 'Today' }, { when: 'week', label: 'This week' }, { when: 'next', label: 'Next week' }, { when: 'month', label: 'This month' }, { when: 'later', label: 'Later' },
];

/** Edit every part of one task. Opens over the page; works with a thumb. */
export function TaskEditor({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [zone, setZone] = useState(task.zoneId);
  const [dueOn, setDueOn] = useState(task.dueOn ?? '');
  const [money, setMoney] = useState(task.money);
  const [kind, setKind] = useState<string>(task.kind);
  const [effort, setEffort] = useState(task.effort ? String(task.effort) : '');
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState<Task['status']>(task.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { call<{ id: string; name: string }[]>('/api/zones', 'GET').then(setZones).catch(() => setZones([{ id: task.zoneId, name: task.zoneName }])); }, [task.zoneId, task.zoneName]);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      await call(`/api/tasks/${task.id}`, 'PATCH', { title, notes: notes.trim() || null, zone, dueOn: dueOn || null, money, kind, effort: effort ? Number(effort) : null, priority, status });
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this task?')) return;
    setBusy(true);
    try { await call(`/api/tasks/${task.id}`, 'DELETE'); onSaved(); onClose(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete.'); setBusy(false); }
  }
  // Pressing a quick button fills the exact date, so the person can still adjust it by hand.
  async function quick(w: When) {
    try { const t = await call<Task>(`/api/tasks/${task.id}`, 'PATCH', { when: w }); setDueOn(t.dueOn ?? ''); setError(null); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not move it.'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Edit task" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={save} className="card flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-xl sm:rounded-b-[var(--radius,16px)]">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Edit task</h2>
          <button type="button" className="rounded-lg p-2 text-muted hover:text-ink" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <textarea ref={first} className="textarea !text-[16px]" rows={2} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task" />
          <textarea className="textarea !text-[16px]" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" />

          <div>
            <p className="label mb-1.5">When</p>
            <div className="flex flex-wrap gap-1.5">{WHENS.map((w) => <button key={w.when} type="button" className="pill !px-3 !py-1.5 hover:text-ink" onClick={() => quick(w.when)}>{w.label}</button>)}</div>
            <div className="mt-2 flex items-center gap-2">
              <input type="date" className="input !w-auto !text-[16px]" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Exact date" />
              {dueOn && <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => setDueOn('')}>No date</button>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label mb-1.5 block">Zone</span>
              <select className="select !text-[16px]" value={zone} onChange={(e) => setZone(e.target.value)}>{(zones.length ? zones : [{ id: task.zoneId, name: task.zoneName }]).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
            <label className="block"><span className="label mb-1.5 block">Status</span>
              <select className="select !text-[16px]" value={status} onChange={(e) => setStatus(e.target.value as Task['status'])}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select></label>
            <label className="block"><span className="label mb-1.5 block">Brings money</span>
              <select className="select !text-[16px]" value={money} onChange={(e) => setMoney(Number(e.target.value))}><option value={0}>No</option><option value={1}>Indirectly</option><option value={2}>Likely</option><option value={3}>Directly</option></select></label>
            <label className="block"><span className="label mb-1.5 block">Priority</span>
              <select className="select !text-[16px]" value={priority} onChange={(e) => setPriority(Number(e.target.value))}><option value={1}>High</option><option value={2}>Normal</option><option value={3}>Low</option></select></label>
            <label className="block"><span className="label mb-1.5 block">Kind</span>
              <select className="select !text-[16px] capitalize" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="block"><span className="label mb-1.5 block">Minutes it takes</span>
              <input className="input !text-[16px]" inputMode="numeric" value={effort} onChange={(e) => setEffort(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="30" /></label>
          </div>
          {error && <p role="alert" className="text-bad">{error}</p>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[14px] text-faint hover:text-bad" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" />Delete</button>
          <div className="flex gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !title.trim()}>Save</button></div>
        </footer>
      </form>
    </div>
  );
}
