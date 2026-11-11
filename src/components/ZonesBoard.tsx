"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import { call } from '@/lib/client';

export interface ZoneCardData { id: string; name: string; kind: string; color: string; note: string | null; open: number; overdue: number; goals: number }
const KIND: Record<string, string> = { project: 'Project', growth: 'Growth', study: 'Study', goal: 'Goals' };
const COLORS = ['#7aa2ff', '#4ade80', '#f5a524', '#b794f6', '#4fd1c5', '#f87171', '#f472b6', '#a3e635'];

/** A line of text that becomes a field when you click it, and saves when you leave it. */
function Editable({ value, placeholder, multiline, className, onSave }: { value: string; placeholder: string; multiline?: boolean; className?: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  async function commit() {
    setEditing(false); const v = text.trim();
    if (v === value.trim()) return;
    try { await onSave(v); setError(null); } catch (e) { setText(value); setError(e instanceof Error ? e.message : 'Could not save.'); }
  }
  if (editing) {
    const common = { autoFocus: true, value: text, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setText(e.target.value), onBlur: commit, 'aria-label': placeholder, className: 'input !text-[16px]' };
    return multiline
      ? <textarea {...common} rows={3} maxLength={300} onKeyDown={(e) => { if (e.key === 'Escape') { setText(value); setEditing(false); } }} />
      : <input {...common} maxLength={60} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(value); setEditing(false); } }} />;
  }
  return (
    <>
      <button type="button" onClick={() => { setText(value); setEditing(true); }} className={`group/edit flex w-full items-start gap-1.5 rounded text-left hover:bg-surface2 ${className ?? ''}`} title="Click to edit">
        <span className={value ? '' : 'text-faint'}>{value || placeholder}</span><Pencil className="mt-1 h-3 w-3 shrink-0 text-faint opacity-0 group-hover/edit:opacity-100 [@media(hover:none)]:opacity-60" aria-hidden />
      </button>
      {error && <span role="alert" className="text-[12.5px] text-bad">{error}</span>}
    </>
  );
}

export function ZonesBoard({ zones }: { zones: ZoneCardData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [kind, setKind] = useState('project'); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true); setError(null);
    try { await call('/api/zones', 'POST', { name, kind, note, color: COLORS[zones.length % COLORS.length] }); setName(''); setNote(''); setKind('project'); setOpen(false); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create it.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {open ? (
        <form onSubmit={create} className="card card-pad max-w-xl space-y-3">
          <h2 className="font-semibold">New zone</h2>
          <input autoFocus className="input !text-[16px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name, e.g. Telegram Group Exporter" aria-label="Zone name" maxLength={60} />
          <select className="select !text-[16px]" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of zone">{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <textarea className="textarea !text-[16px]" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it is (optional)" aria-label="Description" maxLength={300} />
          {error && <p role="alert" className="text-bad">{error}</p>}
          <div className="flex gap-2"><button className="btn btn-primary" disabled={busy || !name.trim()}>Create zone</button><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      ) : <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New zone</button>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => (
          <section key={z.id} className="card card-pad flex flex-col" style={{ borderTop: `3px solid ${z.color}` }}>
            <p className="label">{KIND[z.kind] ?? z.kind}</p>
            <div className="mt-1.5 text-[18px] font-semibold leading-snug"><Editable value={z.name} placeholder="Zone name" onSave={async (v) => { if (!v) throw new Error('A zone needs a name.'); await call(`/api/zones/${z.id}`, 'PATCH', { name: v }); router.refresh(); }} /></div>
            <div className="mt-1 text-muted"><Editable value={z.note ?? ''} placeholder="Add a description" multiline onSave={async (v) => { await call(`/api/zones/${z.id}`, 'PATCH', { note: v || null }); router.refresh(); }} /></div>
            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
              <p className="text-muted"><span className="text-ink tabular-nums">{z.open}</span> open{z.overdue > 0 && <span className="text-bad"> · {z.overdue} overdue</span>} · {z.goals} goal{z.goals === 1 ? '' : 's'}</p>
              <Link href={`/zones/${z.id}`} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">Open<ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
