"use client";
import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import type { Message } from '@/lib/store';
import { Markdown } from './Markdown';
import { Proposals } from './Proposals';

const QUICK = [
  'What should I work on today?',
  'Where will I earn the most money this week?',
  'Review my week and tell me what I am avoiding.',
  'Give me 5 extension ideas that use what I am good at. Say how to test each one cheaply.',
  'My revenue is stuck at $300. What are the three things that would move it fastest?',
];

/** The conversation with the assistant. */
export function AskPanel({ initial, hasKey }: { initial: Message[]; hasKey: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true); setError(null);
    setMessages((m) => [...m, { id: 'pending', role: 'user', content: q, proposals: [], createdAt: '' }]);
    setText('');
    try {
      const fresh = await call<Message[]>('/api/assistant', 'POST', { question: q });
      setMessages((m) => [...m.filter((x) => x.id !== 'pending'), ...fresh]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== 'pending'));
      setText(q);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setBusy(false); }
  }

  async function clear() {
    if (!confirm('Clear the whole conversation?')) return;
    await call('/api/assistant', 'DELETE'); setMessages([]);
  }

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[420px] flex-col">
      {!hasKey && <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-warn">Add your Anthropic API key on the <a className="underline" href="/settings">Settings</a> page and the assistant will answer.</p>}
      <div className="flex-1 space-y-5 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <div>
            <p className="text-muted">It reads your brain file and your live plan before every answer. Try one:</p>
            <div className="mt-3 flex flex-wrap gap-2">{QUICK.map((q) => <button key={q} className="pill !px-3.5 !py-1.5 text-left hover:!text-ink" onClick={() => send(q)} disabled={busy || !hasKey}>{q}</button>)}</div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={m.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-md bg-surface2 px-4 py-2.5' : 'max-w-[760px]'}>
              {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.content}</p> : <><Markdown text={m.content} /><Proposals items={m.proposals} /></>}
            </div>
          </div>
        ))}
        {busy && <p className="inline-flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" />Thinking about your week…</p>}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-bad">{error}</p>}
      <form className="mt-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <textarea className="textarea !min-h-[48px]" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask what to work on, or tell it what happened…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} aria-label="Your message" />
        <button className="btn btn-primary !h-[48px]" disabled={busy || !text.trim() || !hasKey} aria-label="Send"><Send className="h-4 w-4" /></button>
        {messages.length > 0 && <button type="button" className="btn !h-[48px]" onClick={clear} aria-label="Clear the conversation"><Trash2 className="h-4 w-4" /></button>}
      </form>
    </div>
  );
}
