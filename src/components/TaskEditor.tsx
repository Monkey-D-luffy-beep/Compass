"use client";
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import { Modal } from './ds-client';
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
  const [kind, setKind] = useState<string>(task.kind);
  const [effort, setEffort] = useState(task.effort ? String(task.effort) : '');
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState<Task['status']>(task.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { call<{ id: string; name: string }[]>('/api/zones', 'GET').then(setZones).catch(() => setZones([{ id: task.zoneId, name: task.zoneName }])); }, [task.zoneId, task.zoneName]);
  useEffect(() => { first.current?.focus(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      await call(`/api/tasks/${task.id}`, 'PATCH', { title, notes: notes.trim() || null, zone, dueOn: dueOn || null, kind, effort: effort ? Number(effort) : null, priority, status });
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
    <Modal title="Edit task" onClose={onClose}
      footer={<>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[14px] font-semibold text-muted hover:text-bad" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" />Delete</button>
        <div className="flex gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" form="task-edit-form" className="btn btn-primary" disabled={busy || !title.trim()}>Save</button></div>
      </>}>
      <form id="task-edit-form" onSubmit={save} className="space-y-4">
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
            <label className="block"><span className="label mb-1.5 block">Project</span>
              <select className="select !text-[16px]" value={zone} onChange={(e) => setZone(e.target.value)}>{(zones.length ? zones : [{ id: task.zoneId, name: task.zoneName }]).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
            <label className="block"><span className="label mb-1.5 block">Status</span>
              <select className="select !text-[16px]" value={status} onChange={(e) => setStatus(e.target.value as Task['status'])}><option value="todo">Planned</option><option value="doing">In progress</option><option value="done">Done</option></select></label>
            <label className="block"><span className="label mb-1.5 block">Priority</span>
              <select className="select !text-[16px]" value={priority} onChange={(e) => setPriority(Number(e.target.value))}><option value={1}>High</option><option value={2}>Normal</option><option value={3}>Low</option></select></label>
            <label className="block"><span className="label mb-1.5 block">Kind</span>
              <select className="select !text-[16px] capitalize" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="block"><span className="label mb-1.5 block">Minutes it takes</span>
              <input className="input !text-[16px]" inputMode="numeric" value={effort} onChange={(e) => setEffort(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="30" /></label>
          </div>
          {error && <p role="alert" className="text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
