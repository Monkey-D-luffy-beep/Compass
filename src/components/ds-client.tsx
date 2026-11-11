"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Info, Pause, Play, Plus, RotateCcw, X, Zap } from 'lucide-react';
import { call } from '@/lib/client';

/* ------------------------------------------------------------------------------------------- notifications */
type Kind = 'ok' | 'error' | 'info';
const ToastCtx = createContext<(message: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** Small messages that fade on their own. Wrap the app once; call useToast() anywhere below. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string; kind: Kind }[]>([]);
  const next = useRef(1);
  const push = useCallback((message: string, kind: Kind = 'ok') => {
    const id = next.current++;
    setItems((l) => [...l.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`task-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border-2 border-outline px-3.5 py-2.5 text-[13.5px] font-semibold shadow-[0_3px_0_var(--shadow)] ${t.kind === 'error' ? 'bg-[#f5b5b1] text-[#6b1511]' : t.kind === 'info' ? 'bg-surface text-ink' : 'bg-accent text-on-accent'}`}>
            {t.kind === 'error' ? <X className="h-4 w-4 shrink-0" /> : t.kind === 'info' ? <Info className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}{t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------------------------------------- modal */
/** A dialog over the page: Escape or a click outside closes it, the page behind does not scroll, focus starts inside. */
export function Modal({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1226]/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={`card flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-lg ${wide ? 'sm:max-w-2xl' : 'sm:max-w-xl'}`}>
        <header className="flex items-center justify-between border-b-2 border-line px-4 py-3"><h2 className="h-card">{title}</h2><button type="button" className="tip rounded-md p-1.5 text-muted hover:text-ink" data-tip="Close" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button></header>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-between gap-3 border-t-2 border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ focus timer */
const KEY = 'compass-focus-timer';
const PRESETS = [15, 25, 50];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** A countdown that survives a page refresh (it keeps the finish time, not a ticking number). */
export function FocusTimer() {
  const toast = useToast();
  const [minutes, setMinutes] = useState(25);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(25 * 60);   // seconds, when paused
  const [now, setNow] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { minutes: number; endAt: number | null; left: number } | null; if (s) { setMinutes(s.minutes); setEndAt(s.endAt); setLeft(s.left); } } catch { /* start fresh */ }
    setNow(Date.now());
  }, []);
  const save = (m: number, e: number | null, l: number) => { try { localStorage.setItem(KEY, JSON.stringify({ minutes: m, endAt: e, left: l })); } catch { /* not remembered */ } };

  useEffect(() => {
    if (endAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [endAt]);

  const remaining = endAt === null ? left : Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (endAt !== null && now > 0 && remaining === 0 && !finished.current) {
      finished.current = true; setEndAt(null); setLeft(0); save(minutes, null, 0); toast(`Focus block done: ${minutes} minutes. Take a break.`);
    }
  }, [remaining, endAt, now, minutes, toast]);

  function toggle() {
    finished.current = false; const t = Date.now(); setNow(t);
    if (endAt !== null) { setLeft(remaining); setEndAt(null); save(minutes, null, remaining); return; }
    const secs = remaining > 0 ? remaining : minutes * 60;
    setEndAt(t + secs * 1000); save(minutes, t + secs * 1000, secs);
  }
  function reset(m = minutes) { finished.current = false; setMinutes(m); setEndAt(null); setLeft(m * 60); save(m, null, m * 60); }
  const running = endAt !== null;

  return (
    <div className="text-center">
      <p className="font-pixel text-[57px] font-bold leading-none tabular-nums" aria-live="off">{mmss(remaining)}</p>
      <div className="mt-4 flex items-center justify-center gap-2.5">
        <button type="button" className="btn btn-primary !h-11 !w-11 !p-0 tip" data-tip={running ? 'Pause' : 'Start'} aria-label={running ? 'Pause timer' : 'Start timer'} onClick={toggle}>{running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
        <button type="button" className="btn !h-11 !w-11 !p-0 tip" data-tip="Reset" aria-label="Reset timer" onClick={() => reset()}><RotateCcw className="h-4.5 w-4.5" /></button>
      </div>
      <div className="mt-3 flex justify-center gap-1.5" role="group" aria-label="Length">
        {PRESETS.map((m) => <button key={m} type="button" aria-pressed={minutes === m} disabled={running} onClick={() => reset(m)} className={`pill cursor-pointer !px-2.5 ${minutes === m ? '!border-outline !bg-accent !text-on-accent' : ''}`}>{m} min</button>)}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- capture bar */
/** One line to capture anything: a task into a project, or an idea if you start with "idea:". Ctrl or Cmd + K jumps here. */
export function CaptureBar({ zones }: { zones: { id: string; name: string }[] }) {
  const router = useRouter(); const toast = useToast();
  const [text, setText] = useState('');
  const [zone, setZone] = useState(zones[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!zones.some((z) => z.id === zone)) setZone(zones[0]?.id ?? ''); }, [zones, zone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    try {
      const idea = /^idea\s*:/i.test(t);
      if (idea) { await call('/api/ideas', 'POST', { title: t.replace(/^idea\s*:\s*/i, '') }); toast('Idea saved'); }
      else { await call('/api/tasks', 'POST', { title: t, zone }); toast(`Added to Planned in ${zones.find((z) => z.id === zone)?.name ?? 'your project'}`); }
      setText(''); router.refresh();
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not add that.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-center gap-2 p-2.5 sm:flex-nowrap" role="search" aria-label="Capture">
      <Zap className="ml-1.5 hidden h-5 w-5 shrink-0 text-accent-ink sm:block" aria-hidden />
      <input ref={ref} className="min-w-0 flex-1 basis-full bg-transparent px-1 py-1.5 text-[16px] outline-none placeholder:text-faint sm:basis-auto sm:text-[15px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture a task, idea, or reminder…  (start with “idea:” to save an idea)" aria-label="Capture a task or idea" maxLength={300} />
      <kbd className="hidden rounded-md border-2 border-line px-2 py-0.5 text-[12px] text-muted md:block">Ctrl K</kbd>
      <select className="select !w-auto max-w-[44%] !py-1.5 !text-[16px] sm:!text-[13.5px]" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Project">{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      <button className="btn btn-primary" disabled={busy || !text.trim() || !zone}><Plus className="h-4 w-4" />Add</button>
    </form>
  );
}
