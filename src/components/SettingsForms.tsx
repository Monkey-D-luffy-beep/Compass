"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { call } from '@/lib/client';

export function BrainEditor({ initial, file }: { initial: string; file: string }) {
  const [text, setText] = useState(initial); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try { await call('/api/brain', 'PUT', { text }); setSaved(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  }
  return (
    <div>
      <textarea className="textarea font-mono text-[13px]" rows={28} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} aria-label="Brain" spellCheck={false} />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button className="btn btn-primary" onClick={save} disabled={busy || text === initial && !saved}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save brain</button>
        <span className="text-faint">{String(text.length).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} characters · stored in <code>{file}</code></span>
        {saved && <span role="status" className="inline-flex items-center gap-1.5 text-good"><CheckCircle2 className="h-4 w-4" />Saved</span>}
        {error && <span role="alert" className="text-bad">{error}</span>}
      </div>
    </div>
  );
}

export function SettingsForm({ hasKey, fromEnv, model, models, goal }: { hasKey: boolean; fromEnv: boolean; model: string; models: string[]; goal: number }) {
  const router = useRouter();
  const [key, setKey] = useState(''); const [m, setM] = useState(model); const [g, setG] = useState(String(goal));
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label); setError(null); setMsg(null);
    try { const r = await fn(); setMsg(r || 'Saved.'); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      <section className="card card-pad space-y-3">
        <h2 className="font-semibold">Anthropic API key</h2>
        <p className="text-muted">{fromEnv ? 'Using ANTHROPIC_API_KEY from the environment.' : hasKey ? 'A key is saved (encrypted on this computer). Paste a new one to replace it.' : 'Paste your key. It is stored encrypted in the local database and only ever sent to Anthropic.'}</p>
        <div className="flex gap-2">
          <input className="input" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" />
          <button className="btn btn-primary shrink-0" disabled={!key.trim() || !!busy} onClick={() => run('key', async () => { await call('/api/settings', 'PUT', { apiKey: key }); setKey(''); })}>{busy === 'key' && <Loader2 className="h-4 w-4 animate-spin" />}Save key</button>
          {hasKey && !fromEnv && <button className="btn shrink-0" disabled={!!busy} onClick={() => run('rm', async () => { await call('/api/settings', 'PUT', { apiKey: '' }); })}>Remove</button>}
        </div>
      </section>

      <section className="card card-pad space-y-3">
        <h2 className="font-semibold">Model</h2>
        <div className="flex gap-2">
          <select className="select" value={m} onChange={(e) => setM(e.target.value)} aria-label="Model">{models.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <button className="btn shrink-0" disabled={!!busy} onClick={() => run('model', async () => { await call('/api/settings', 'PUT', { model: m }); })}>Save</button>
          <button className="btn shrink-0" disabled={!hasKey || !!busy} onClick={() => run('test', async () => { const r = await call<{ reply: string }>('/api/settings/test'); return `Claude answered: ${r.reply}`; })}>{busy === 'test' && <Loader2 className="h-4 w-4 animate-spin" />}Test</button>
        </div>
        <p className="text-faint">Sonnet is the everyday choice. Opus thinks harder and costs more per question.</p>
      </section>

      <section className="card card-pad space-y-3">
        <h2 className="font-semibold">Monthly revenue goal</h2>
        <div className="flex gap-2">
          <input className="input !w-40" type="number" min={1} value={g} onChange={(e) => setG(e.target.value)} aria-label="Monthly revenue goal in dollars" />
          <button className="btn shrink-0" disabled={!!busy} onClick={() => run('goal', async () => { await call('/api/settings', 'PUT', { revenueGoal: Number(g) }); })}>Save</button>
        </div>
      </section>
      {msg && <p role="status" className="inline-flex items-center gap-1.5 text-good"><CheckCircle2 className="h-4 w-4" />{msg}</p>}
      {error && <p role="alert" className="text-bad">{error}</p>}
    </div>
  );
}
