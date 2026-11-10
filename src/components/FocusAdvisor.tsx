"use client";
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { call } from '@/lib/client';
import type { Message } from '@/lib/store';
import { Markdown } from './Markdown';
import { Proposals } from './Proposals';

/** One button on the Today page: ask the assistant what to do first, using your real plan and money. */
export function FocusAdvisor({ hasKey }: { hasKey: boolean }) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null);
    try {
      const fresh = await call<Message[]>('/api/assistant', 'POST', { question: 'What should I work on today? Give the top three in order, say what to drop, and keep it short.' });
      setAnswer(fresh[fresh.length - 1] ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={go} disabled={busy || !hasKey}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? 'Thinking…' : 'Ask what to work on'}
      </button>
      {!hasKey && <span className="ml-3 text-muted">Add your API key in <a className="underline" href="/settings">Settings</a>.</span>}
      {error && <p role="alert" className="mt-3 text-bad">{error}</p>}
      {answer && (
        <div className="mt-4 rounded-xl border border-line bg-bg p-4">
          <Markdown text={answer.content} />
          <Proposals items={answer.proposals} />
          <p className="mt-3 text-[12.5px] text-faint">Saved in <a className="underline" href="/assistant">Assistant</a>, where you can keep the conversation going.</p>
        </div>
      )}
    </div>
  );
}
