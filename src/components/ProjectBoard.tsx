"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { call } from '@/lib/client';
import { dayLabel } from '@/lib/dates';
import type { Task, Zone } from '@/lib/store';
import { TaskEditor } from './TaskEditor';

const COLORS = ['#7aa2ff', '#4ade80', '#f5a524', '#b794f6', '#4fd1c5', '#f87171', '#f472b6', '#a3e635'];
const ORDER = { doing: 0, todo: 1, done: 2 } as const;

/** One task line: tick it (the line draws across), start it, open it to edit, archive it once done. */
function TaskLine({ task, onChange, onArchive, onEdit }: { task: Task; onChange: (t: Task) => void; onArchive: (t: Task) => void; onEdit: (t: Task) => void }) {
  const done = task.status === 'done';
  const [error, setError] = useState<string | null>(null);

  async function set(status: Task['status']) {
    const before = task; setError(null);
    onChange({ ...task, status, doneAt: status === 'done' ? new Date().toISOString() : null });   // instant; the server confirms behind it
    try { await call(`/api/tasks/${task.id}`, 'PATCH', { status }); }
    catch (e) { onChange(before); setError(e instanceof Error ? e.message : 'Could not save.'); }
  }

  return (
    <li className="task-in group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface2">
      <button type="button" className="check mt-0.5" data-on={done} aria-label={done ? 'Mark as not done' : 'Mark as done'} onClick={() => set(done ? 'todo' : 'done')}>
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" className="w-full text-left leading-snug" onClick={() => onEdit(task)} aria-label={`Edit: ${task.title}`}>
          <span className="strike" data-done={done}>{task.title}</span>
        </button>
        {(task.dueOn || task.notes) && <p className="mt-0.5 truncate text-[12.5px] text-faint">{task.dueOn ? dayLabel(task.dueOn) : ''}{task.dueOn && task.notes ? ' · ' : ''}{task.notes ?? ''}</p>}
        {error && <p role="alert" className="text-[12.5px] text-bad">{error}</p>}
      </div>
      {!done && (
        <button type="button" onClick={() => set(task.status === 'doing' ? 'todo' : 'doing')}
          className={`pill shrink-0 cursor-pointer !py-0 ${task.status === 'doing' ? '!border-transparent !bg-accent/20 !text-accent' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100'}`}
          aria-label={task.status === 'doing' ? 'Move back to planned' : 'Start this task'}>{task.status === 'doing' ? 'In progress' : 'Planned'}</button>
      )}
      {done && <button type="button" className="shrink-0 rounded-md p-1 text-faint hover:text-ink" aria-label="Archive this task" title="Archive" onClick={() => onArchive(task)}><Archive className="h-4 w-4" /></button>}
    </li>
  );
}

function Block({ zone, initial }: { zone: Zone; initial: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(zone.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setTasks(initial), [initial]);

  const sorted = useMemo(() => [...tasks].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === 'done' ? (b.doneAt ?? '').localeCompare(a.doneAt ?? '') : a.createdAt.localeCompare(b.createdAt))), [tasks]);
  const done = tasks.filter((t) => t.status === 'done').length;
  const replace = (t: Task) => setTasks((all) => all.map((x) => (x.id === t.id ? t : x)));

  async function add(e: React.FormEvent) {
    e.preventDefault(); const text = title.trim(); if (!text || adding) return;
    setAdding(true); setError(null);
    try { const t = await call<Task>('/api/tasks', 'POST', { title: text, zone: zone.id }); setTasks((all) => [...all, t]); setTitle(''); inputRef.current?.focus(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
    finally { setAdding(false); }
  }
  async function archiveOne(t: Task) {
    setTasks((all) => all.filter((x) => x.id !== t.id));
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { archived: true }); router.refresh(); }
    catch (e) { setTasks((all) => [...all, t]); setError(e instanceof Error ? e.message : 'Could not archive.'); }
  }
  async function archiveAllDone() {
    const gone = tasks.filter((t) => t.status === 'done');
    setTasks((all) => all.filter((t) => t.status !== 'done'));
    try { await call('/api/tasks/archive-done', 'POST', { zone: zone.id }); router.refresh(); }
    catch (e) { setTasks((all) => [...all, ...gone]); setError(e instanceof Error ? e.message : 'Could not archive.'); }
  }
  async function saveName() {
    const name = newName.trim(); setRenaming(false);
    if (!name || name === zone.name) { setNewName(zone.name); return; }
    try { await call(`/api/zones/${zone.id}`, 'PATCH', { name }); router.refresh(); } catch (e) { setNewName(zone.name); setError(e instanceof Error ? e.message : 'Could not rename.'); }
  }
  async function archiveProject() {
    setMenu(false); if (!window.confirm(`Archive the project "${zone.name}"? Its tasks stay saved.`)) return;
    try { await call(`/api/zones/${zone.id}`, 'PATCH', { archived: true }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not archive.'); }
  }

  return (
    <section className="card flex flex-col" aria-label={zone.name} style={{ borderTop: `3px solid ${zone.color}` }}>
      <header className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          {renaming ? (
            <input autoFocus className="input !py-1 !text-[16px] font-semibold" value={newName} maxLength={40} aria-label="Project name"
              onChange={(e) => setNewName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNewName(zone.name); setRenaming(false); } }} />
          ) : (
            <h2 className="truncate text-[16px] font-semibold"><button type="button" className="max-w-full truncate rounded px-1 -mx-1 text-left hover:bg-surface2" title="Click to rename" onClick={() => { setNewName(zone.name); setRenaming(true); }}>{zone.name}</button></h2>
          )}
          <p className="text-[12.5px] text-faint">{tasks.length === 0 ? 'No tasks yet' : `${done} of ${tasks.length} done`}{done > 0 && <> · <button type="button" className="text-muted underline-offset-2 hover:text-ink hover:underline" onClick={archiveAllDone}>Archive {done} done</button></>}</p>
        </div>
        <div className="relative flex items-center gap-1">

          <button type="button" className="rounded-md p-1.5 text-muted hover:text-ink" aria-label="Project options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal className="h-5 w-5" /></button>
          {menu && (
            <div className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-line2 bg-surface2 p-1 shadow-xl shadow-black/40" role="menu">
              <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-surface" onClick={() => { setMenu(false); setNewName(zone.name); setRenaming(true); }}>Rename</button>
              <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-bad hover:bg-surface" onClick={archiveProject}>Archive project</button>
            </div>
          )}
        </div>
      </header>

      {tasks.length > 0 && <div className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(done / tasks.length) * 100}%`, background: zone.color }} /></div>}

      <ul className="mt-2 flex-1 space-y-0.5 px-2">{sorted.map((t) => <TaskLine key={t.id} task={t} onChange={replace} onArchive={archiveOne} onEdit={setEditing} />)}</ul>

      <form onSubmit={add} className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <Plus className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input ref={inputRef} className="min-w-0 flex-1 bg-transparent py-1 text-[16px] outline-none placeholder:text-faint sm:text-[14.5px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" aria-label={`Add a task to ${zone.name}`} maxLength={300} />
      </form>
      {error && <p role="alert" className="px-4 pb-3 text-[12.5px] text-bad">{error}</p>}
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />}
    </section>
  );
}

export function ProjectBoard({ zones, tasks, archived }: { zones: Zone[]; tasks: Task[]; archived: Task[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string[]>([]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); const n = name.trim(); if (!n || busy) return;
    setBusy(true); setError(null);
    try { await call('/api/zones', 'POST', { name: n, kind: 'project', color: COLORS[zones.length % COLORS.length] }); setName(''); setOpen(false); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create it.'); }
    finally { setBusy(false); }
  }
  async function restore(t: Task) {
    setGone((g) => [...g, t.id]);
    try { await call(`/api/tasks/${t.id}`, 'PATCH', { archived: false }); router.refresh(); } catch { setGone((g) => g.filter((x) => x !== t.id)); }
  }
  const byZone = (id: string) => tasks.filter((t) => t.zoneId === id);
  const shownArchived = archived.filter((t) => !gone.includes(t.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {open ? (
          <form onSubmit={create} className="flex w-full max-w-md items-center gap-2">
            <input autoFocus className="input !text-[16px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" aria-label="Project name" maxLength={40} />
            <button className="btn btn-primary" disabled={busy || !name.trim()}>Create</button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setName(''); }}>Cancel</button>
          </form>
        ) : <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</button>}
        {error && <p role="alert" className="text-bad">{error}</p>}
      </div>

      {zones.length === 0 ? <p className="text-muted">No projects yet. Create one, then add tasks inside it.</p> : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{zones.map((z) => <Block key={z.id} zone={z} initial={byZone(z.id)} />)}</div>
      )}

      {shownArchived.length > 0 && (
        <details className="card card-pad">
          <summary className="cursor-pointer select-none text-muted">Archived tasks ({shownArchived.length})</summary>
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
    </div>
  );
}
