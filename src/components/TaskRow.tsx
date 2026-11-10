"use client";
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import { BUCKET_LABEL, bucketOf, dayLabel, type Bucket, type When } from '@/lib/dates';
import type { Task } from '@/lib/store';
import { Money } from './ui';
import { TaskEditor } from './TaskEditor';

const MOVES: { when: When; label: string }[] = [
  { when: 'today', label: 'Today' }, { when: 'week', label: 'This week' }, { when: 'next', label: 'Next week' }, { when: 'month', label: 'This month' }, { when: 'later', label: 'Later' },
];

/** One task: tick it, move it to another part of the timeline, or remove it. */
export function TaskRow({ task, today, showZone = true }: { task: Task; today: string; showZone?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [done, setDone] = useState(task.status === 'done');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const bucket: Bucket = bucketOf(task.dueOn, today);

  const run = (fn: () => Promise<unknown>) => start(async () => {
    setError(null);
    try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); setDone(task.status === 'done'); }
  });

  return (
    <div className={`group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface2 ${busy ? 'opacity-60' : ''}`}>
      <button type="button" className="check mt-0.5" data-on={done} aria-label={done ? 'Mark as not done' : 'Mark as done'}
        onClick={() => { setDone(!done); run(() => call(`/api/tasks/${task.id}`, 'PATCH', { status: done ? 'todo' : 'done' })); }}>
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} aria-label={`Edit: ${task.title}`}
        onClick={() => setEditing(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }}>
        <p className={`leading-snug ${done ? 'text-faint line-through' : ''}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          {showZone && <span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: task.zoneColor }} />{task.zoneName}</span>}
          {task.dueOn && <span className={bucket === 'overdue' ? 'text-bad' : ''}>{bucket === 'overdue' ? 'Overdue · ' : ''}{dayLabel(task.dueOn)}</span>}
          {!task.dueOn && <span>{BUCKET_LABEL.later}</span>}
          <Money n={task.money} />
          {task.effort && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{task.effort >= 60 ? `${Math.round((task.effort / 60) * 10) / 10} h` : `${task.effort} min`}</span>}
          {task.kind !== 'build' && <span className="pill !py-0">{task.kind}</span>}
        </div>
        {error && <p role="alert" className="mt-1 text-[12.5px] text-bad">{error}</p>}
      </div>
      <div className="absolute right-2 top-1.5 flex items-center gap-1 rounded-xl border border-line bg-surface2 p-1 pointer-events-none opacity-0 shadow-lg shadow-black/30 transition group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <select aria-label="Move to" className="select !w-[104px] !py-1 text-[12.5px]" value="" onChange={(e) => e.target.value && run(() => call(`/api/tasks/${task.id}`, 'PATCH', { when: e.target.value }))}>
          <option value="">Move…</option>
          {MOVES.map((m) => <option key={m.when} value={m.when}>{m.label}</option>)}
        </select>
        <button type="button" className="rounded-lg p-1.5 text-faint hover:bg-bg hover:text-bad" aria-label="Delete task" onClick={() => run(() => call(`/api/tasks/${task.id}`, 'DELETE'))}><Trash2 className="h-4 w-4" /></button>
      </div>
      {editing && <TaskEditor task={task} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />}
    </div>
  );
}
