"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import { IDEA_KINDS, IDEA_STATUS, type Idea } from '@/lib/store';

interface Draft { title: string; kind: string; pitch: string; moneyLogic: string; validateStep: string }

const KIND_LABEL: Record<string, string> = { extension: 'New extension', saas: 'SaaS', game: 'Game', lever: 'Revenue lever', content: 'Content', other: 'Other' };
const labelOf = (k: string) => KIND_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

export function IdeasBoard({ ideas }: { ideas: Idea[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(''); const [kind, setKind] = useState('extension'); const [customKind, setCustomKind] = useState(''); const [pitch, setPitch] = useState(''); const [money, setMoney] = useState(''); const [test, setTest] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(''); const [drafts, setDrafts] = useState<Draft[]>([]); const [thinking, setThinking] = useState(false); const [genError, setGenError] = useState<string | null>(null);

  async function generate() {
    setThinking(true); setGenError(null);
    try { setDrafts(await call<Draft[]>('/api/ideas/generate', 'POST', { focus })); }
    catch (err) { setGenError(err instanceof Error ? err.message : 'Could not get ideas.'); }
    finally { setThinking(false); }
  }
  async function keep(d: Draft) {
    try { await call('/api/ideas', 'POST', d); setDrafts((x) => x.filter((y) => y !== d)); router.refresh(); }
    catch (err) { setGenError(err instanceof Error ? err.message : 'Could not keep it.'); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await call('/api/ideas', 'POST', { title, kind: kind === '__custom' ? customKind : kind, pitch, moneyLogic: money, validateStep: test }); setTitle(''); setPitch(''); setMoney(''); setTest(''); setCustomKind(''); setKind('extension'); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add it.'); }
  }
  const patch = async (id: string, p: object) => { await call(`/api/ideas/${id}`, 'PATCH', p); router.refresh(); };

  return (
    <div className="space-y-6">
      <section className="card card-pad space-y-3" aria-label="Get new ideas">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Get new ideas</p><span className="text-[12.5px] text-faint">Claude suggests; every idea is unproven until you test it.</span></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input !text-[16px]" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Optional focus, e.g. tools for freight forwarders" aria-label="Focus" onKeyDown={(e) => { if (e.key === 'Enter' && !thinking) generate(); }} />
          <button type="button" className="btn btn-primary shrink-0" onClick={generate} disabled={thinking}><Sparkles className="h-4 w-4" />{thinking ? 'Thinking…' : drafts.length ? 'Get 5 more' : 'Get 5 ideas'}</button>
        </div>
        {genError && <p role="alert" className="text-bad">{genError}</p>}
        {drafts.length > 0 && (
          <div className="grid gap-3 pt-1 lg:grid-cols-2">
            {drafts.map((d) => (
              <article key={d.title} className="rounded-xl border border-dashed border-line2 p-4">
                <span className="pill mb-2">{labelOf(d.kind)}</span>
                <h3 className="font-semibold leading-snug">{d.title}</h3>
                {d.pitch && <p className="mt-1.5 text-muted">{d.pitch}</p>}
                {d.moneyLogic && <p className="mt-2"><span className="label block">Why it could earn</span>{d.moneyLogic}</p>}
                {d.validateStep && <p className="mt-2"><span className="label block">Cheapest test first</span>{d.validateStep}</p>}
                <div className="mt-3 flex gap-2"><button type="button" className="btn btn-primary" onClick={() => keep(d)}>Keep</button><button type="button" className="btn" onClick={() => setDrafts((x) => x.filter((y) => y !== d))}>Dismiss</button></div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {ideas.map((i) => (
          <article key={i.id} className={`card card-pad flex flex-col ${i.status === 'dropped' || i.status === 'parked' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="pill mb-2">{labelOf(i.kind)}</span>
                <h2 className="text-[16px] font-semibold leading-snug">{i.title}</h2>
              </div>
              <button className="rounded-lg p-1.5 text-faint hover:text-bad" aria-label={`Delete ${i.title}`} onClick={async () => { await call(`/api/ideas/${i.id}`, 'DELETE'); router.refresh(); }}><Trash2 className="h-4 w-4" /></button>
            </div>
            {i.pitch && <p className="mt-2 text-muted">{i.pitch}</p>}
            {i.moneyLogic && <p className="mt-3"><span className="label block">Why it could earn</span>{i.moneyLogic}</p>}
            {i.validateStep && <p className="mt-3"><span className="label block">Cheapest test first</span>{i.validateStep}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <label className="flex items-center gap-2 text-[13px] text-muted">Status
                <select className="select !w-auto !py-1" value={i.status} onChange={(e) => patch(i.id, { status: e.target.value })}>{IDEA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted">Score
                <select className="select !w-auto !py-1" value={i.score} onChange={(e) => patch(i.id, { score: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select>
              </label>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={add} className="card card-pad space-y-3">
        <p className="font-semibold">Add an idea</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The idea in one line" aria-label="Idea" />
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">{IDEA_KINDS.map((k) => <option key={k} value={k}>{labelOf(k)}</option>)}<option value="__custom">Write my own…</option></select>
          {kind === '__custom' && <input className="input" value={customKind} onChange={(e) => setCustomKind(e.target.value)} placeholder="Your own kind, e.g. Mobile app" aria-label="Your own kind" maxLength={24} />}
        </div>
        <textarea className="textarea" rows={2} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="What is it?" aria-label="What is it" />
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea className="textarea" rows={2} value={money} onChange={(e) => setMoney(e.target.value)} placeholder="Why could it earn money?" aria-label="Why it could earn" />
          <textarea className="textarea" rows={2} value={test} onChange={(e) => setTest(e.target.value)} placeholder="Cheapest way to test it before building" aria-label="Cheapest test" />
        </div>
        <button className="btn btn-primary" disabled={!title.trim()}><Plus className="h-4 w-4" />Add idea</button>
        {error && <p role="alert" className="text-bad">{error}</p>}
      </form>
    </div>
  );
}
