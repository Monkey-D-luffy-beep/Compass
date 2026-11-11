"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { call } from '@/lib/client';
import { BUCKET_LABEL, type Bucket } from '@/lib/dates';
import type { Message } from '@/lib/store';

const LABEL: Record<string, string> = { today: BUCKET_LABEL.today, week: BUCKET_LABEL.week, next: BUCKET_LABEL.next, month: BUCKET_LABEL.month, later: BUCKET_LABEL.later };

/** Tasks the assistant suggested. Nothing is added until you press the button. */
export function Proposals({ items }: { items: Message['proposals'] }) {
  const router = useRouter();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  if (!items.length) return null;

  async function add(i: number) {
    setError(null);
    try { await call('/api/tasks', 'POST', items[i]); setAdded((s) => new Set(s).add(i)); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add it.'); }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-bg p-3">
      <p className="label mb-2">Suggested tasks</p>
      <ul className="space-y-1.5">
        {items.map((p, i) => (
          <li key={i} className="flex items-center gap-3">
            <button type="button" onClick={() => add(i)} disabled={added.has(i)} className="btn !px-2 !py-1 shrink-0" aria-label={`Add: ${p.title}`}>{added.has(i) ? <Check className="h-4 w-4 text-good" /> : <Plus className="h-4 w-4" />}</button>
            <span className="min-w-0 flex-1">{p.title}</span>
            <span className="shrink-0 text-[12.5px] text-muted">{p.zone} · {LABEL[p.when as Bucket] ?? p.when}</span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
