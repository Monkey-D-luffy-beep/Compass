"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArrowLeft, ArrowRight, Check, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { call } from '@/lib/client';
import { dayLabel } from '@/lib/dates';
import type { Task, Zone } from '@/lib/store';
import { TaskEditor } from './TaskEditor';
import { Empty, PriorityDot } from './ds';
import { InlineTitle, useToast } from './ds-client';

type Status = Task['status'];
const COLUMNS: { status: Status; label: string; hint: string }[] = [
  { status: 'todo', label: 'Planned', hint: 'Not started' },
  { status: 'doing', label: 'In progress', hint: 'Working on it now' },
  { status: 'done', label: 'Done', hint: 'Finished this week' },
];

function Card({ task, onMove, onArchive, onEdit, onRename }: { task: Task; onMove: (t: Task, s: Status) => void; onArchive: (t: Task) => void; onEdit: (t: Task) => void; onRename: (t: Task, title: string) => Promise<void> }) {
  const done = task.status === 'done';
  const [typing, setTyping] = useState(false);   // a draggable parent would stop you selecting text while typing
  const prev: Status | null = task.status === 'doing' ? 'todo' : task.status === 'done' ? 'doing' : null;
  const next: Status | null = task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : null;
  return (
    <li draggable={!typing} onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}
      className="task-in group cursor-grab rounded-xl border border-line bg-surface2 p-3 active:cursor-grabbing">
      <div className="flex items-start gap-2.5">
        <button type="button" className="check mt-0.5" data-on={done} aria-label={done ? 'Mark as not done' : 'Mark as done'} onClick={() => onMove(task, done ? 'todo' : 'done')}>
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1"><InlineTitle value={task.title} done={done} onSave={(v) => onRename(task, v)} onEditing={setTyping} /></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted"><span className="dot shrink-0" style={{ background: task.zoneColor }} /><span className="truncate">{task.zoneName}</span>{task.priority !== 2 && <PriorityDot priority={task.priority} />}{task.dueOn && <span className="text-faint">· {dayLabel(task.dueOn)}</span>}</span>
        <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button type="button" className="tip rounded-md p-1 text-faint hover:text-ink" data-tip="Details" aria-label="Open task details" onClick={() => onEdit(task)}><SlidersHorizontal className="h-4 w-4" /></button>
          {prev && <button type="button" className="tip rounded-md p-1 text-faint hover:text-ink" data-tip="Move back" aria-label={`Move back to ${prev === 'todo' ? 'planned' : 'in progress'}`} onClick={() => onMove(task, prev)}><ArrowLeft className="h-4 w-4" /></button>}
          {next && <button type="button" className="tip rounded-md p-1 text-faint hover:text-ink" data-tip={next === 'doing' ? 'Start' : 'Mark done'} aria-label={`Move to ${next === 'doing' ? 'in progress' : 'done'}`} onClick={() => onMove(task, next)}><ArrowRight className="h-4 w-4" /></button>}
          {done && <button type="button" className="tip rounded-md p-1 text-faint hover:text-ink" data-tip="Archive" aria-label="Archive this task" onClick={() => onArchive(task)}><Archive className="h-4 w-4" /></button>}
        </span>
      </div>
    </li>
  );
}

/** Planned | In progress | Done. Drag a card, or use the arrows, or tick it. Every task carries its project. */
export function KanbanBoard({ zones, tasks: initial, archived }: { zones: Zone[]; tasks: Task[]; archived: Task[] }) {
  const router = useRouter(); const toast = useToast();
  const [tasks, setTasks] = useState(initial);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [newZone, setNewZone] = useState(zones[0]?.id ?? '');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => setTasks(initial), [initial]);
  useEffect(() => { if (!zones.some((z) => z.id === newZone)) setNewZone(zones[0]?.id ?? ''); }, [zones, newZone]);

  const shown = useMemo(() => tasks.filter((t) => !zoneId || t.zoneId === zoneId), [tasks, zoneId]);
  const col = (s: Status) => shown.filter((t) => t.status === s).sort((a, b) => (s === 'done' ? (b.doneAt ?? '').localeCompare(a.doneAt ?? '') : a.createdAt.localeCompare(b.createdAt)));
  const shownArchived = archived.filter((t) => !gone.includes(t.id) && (!zoneId || t.zoneId === zoneId));

  async function move(t: Task, status: Status) {
    if (t.status === status) return;
    const before = t; setError(null);
    setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, status, doneAt: status === 'done' ? new Date().toISOString() : null } : x)));
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { status }); }
    catch (e) { setTasks((all) => all.map((x) => (x.id === t.id ? before : x))); setError(e instanceof Error ? e.message : 'Could not move it.'); }
  }
  async function rename(t: Task, title: string) {
    const before = t.title;
    setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, title } : x)));
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { title }); }
    catch (e) { setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, title: before } : x))); throw e; }
  }
  async function archiveOne(t: Task) {
    setTasks((all) => all.filter((x) => x.id !== t.id));
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { archived: true }); router.refresh(); }
    catch (e) { setTasks((all) => [...all, t]); setError(e instanceof Error ? e.message : 'Could not archive.'); }
  }
  async function archiveAllDone() {
    const gone2 = tasks.filter((t) => t.status === 'done' && (!zoneId || t.zoneId === zoneId));
    setTasks((all) => all.filter((t) => !gone2.some((g) => g.id === t.id)));
    try { for (const g of gone2) await call(`/api/tasks/${g.id}`, 'PATCH', { archived: true }); toast(`Archived ${gone2.length} task${gone2.length === 1 ? '' : 's'}`); router.refresh(); }
    catch (e) { setTasks((all) => [...all, ...gone2]); setError(e instanceof Error ? e.message : 'Could not archive.'); }
  }
  async function restore(t: Task) {
    setGone((g) => [...g, t.id]);
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { archived: false }); router.refresh(); } catch { setGone((g) => g.filter((x) => x !== t.id)); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); const text = title.trim(); if (!text || !newZone || adding) return;
    setAdding(true); setError(null);
    try { const t = await call<Task>('/api/tasks', 'POST', { title: text, zone: newZone }); setTasks((all) => [...all, t]); setTitle(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
    finally { setAdding(false); }
  }
  function drop(e: React.DragEvent, status: Status) {
    e.preventDefault(); setOver(null);
    const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (t) void move(t, status);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by project">
        <button className={`pill !px-3.5 !py-1.5 ${!zoneId ? '!bg-surface2 !text-ink !border-line2' : ''}`} onClick={() => setZoneId(null)}>All projects</button>
        {zones.map((z) => <button key={z.id} className={`pill !px-3.5 !py-1.5 ${zoneId === z.id ? '!bg-surface2 !text-ink !border-line2' : ''}`} onClick={() => setZoneId(zoneId === z.id ? null : z.id)}><span className="dot" style={{ background: z.color }} />{z.name}</button>)}
      </div>
      {error && <p role="alert" className="text-bad">{error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {COLUMNS.map((c) => {
          const list = col(c.status);
          return (
            <section key={c.status} aria-label={c.label} onDragOver={(e) => { e.preventDefault(); setOver(c.status); }} onDragLeave={() => setOver((o) => (o === c.status ? null : o))} onDrop={(e) => drop(e, c.status)}
              className={`card flex min-h-[220px] flex-col transition ${over === c.status ? '!border-accent' : ''}`}>
              <header className="flex items-center justify-between gap-2 px-4 pt-4">
                <div><h2 className="font-semibold">{c.label} <span className="ml-1 text-[13px] font-normal text-faint tabular-nums">{list.length}</span></h2><p className="text-[12.5px] text-faint">{c.hint}</p></div>
                {c.status === 'done' && list.length > 0 && <button type="button" className="btn !px-2.5 !py-1 text-[12.5px]" onClick={archiveAllDone}><Archive className="h-3.5 w-3.5" />Archive all</button>}
              </header>
              <ul className="flex-1 space-y-2 p-3">
                {list.length === 0 && <li><Empty sprite={c.status === 'done' ? 'star' : 'sprout'}>{c.status === 'done' ? 'Nothing finished yet.' : c.status === 'doing' ? 'Nothing in progress. Pull a card here.' : 'Nothing planned.'}</Empty></li>}
                {list.map((t) => <Card key={t.id} task={t} onMove={move} onArchive={archiveOne} onEdit={setEditing} onRename={rename} />)}
              </ul>
              {c.status === 'todo' && (
                <form onSubmit={add} className="space-y-2 border-t border-line p-3">
                  <div className="flex items-center gap-2">
                    <input className="input !text-[16px] sm:!text-[14.5px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" aria-label="Add a task" maxLength={300} />
                    <button className="btn btn-primary !px-3" disabled={adding || !title.trim() || !newZone} aria-label="Add task"><Plus className="h-4 w-4" /></button>
                  </div>
                  <select className="select !text-[16px] sm:!text-[13.5px]" value={newZone} onChange={(e) => setNewZone(e.target.value)} aria-label="Project for the new task">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
                </form>
              )}
            </section>
          );
        })}
      </div>

      {shownArchived.length > 0 && (
        <details className="card card-pad">
          <summary className="cursor-pointer select-none text-muted">Archived work ({shownArchived.length})</summary>
          <ul className="mt-3 space-y-1">
            {shownArchived.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface2">
                <span className="min-w-0 truncate text-muted"><span className="dot mr-2 inline-block" style={{ background: t.zoneColor }} />{t.title} <span className="text-faint">· {t.zoneName}</span></span>
                <button className="btn !px-2.5 !py-1 text-[12.5px]" onClick={() => restore(t)}><RotateCcw className="h-3.5 w-3.5" />Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />}
    </div>
  );
}
