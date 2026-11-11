"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { call } from '@/lib/client';
import { useToast } from './ds-client';
import type { Entry } from '@/lib/store';

const DEFAULT_CATEGORIES = ['Salary', 'Software', 'Hosting', 'Domain', 'Ads', 'Tools', 'Tax', 'Study', 'Rent', 'Food', 'Travel', 'Other'];
const fmt = (n: number, c: string) => `${c === 'INR' ? '₹' : '$'}${String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d)(?=\.|$))/g, ',')}`;

/** Add an income or an expense, see the latest ones, and set the dollar-to-rupee rate used to add them together. */
export function FinanceForms({ entries, rate, today }: { entries: Entry[]; rate: number; today: string }) {
  const router = useRouter(); const toast = useToast();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('INR');
  const [onDate, setOnDate] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateText, setRateText] = useState(String(rate));
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...entries.map((e) => e.category)])];

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await call('/api/entries', 'POST', { type, category, amount: Number(amount), currency, onDate, note }); setAmount(''); setNote(''); toast(type === 'income' ? 'Income added' : 'Expense added'); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setGone((g) => [...g, id]);
    try { await call(`/api/entries/${id}`, 'DELETE'); router.refresh(); } catch { setGone((g) => g.filter((x) => x !== id)); }
  }
  async function saveRate() {
    setRateMsg(null);
    try { await call('/api/settings', 'PUT', { inrPerUsd: Number(rateText) }); setRateMsg('Saved.'); router.refresh(); } catch (err) { setRateMsg(err instanceof Error ? err.message : 'Could not save.'); }
  }
  const shown = entries.filter((e) => !gone.includes(e.id)).slice(0, 40);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="card card-pad">
        <h2 className="font-semibold">Add income or an expense</h2>
        <form onSubmit={add} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type">
            {(['expense', 'income'] as const).map((t) => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`btn ${type === t ? '!border-transparent !bg-accent !text-bg' : ''}`}>{t === 'expense' ? 'Expense' : 'Income (salary, other)'}</button>)}
          </div>
          <input className="input !text-[16px]" list="finance-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={type === 'income' ? 'Category, e.g. Salary' : 'Category, e.g. Hosting'} aria-label="Category" maxLength={40} />
          <datalist id="finance-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input className="input !text-[16px]" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 12))} placeholder="Amount" aria-label="Amount" />
            <select className="select !w-auto !text-[16px]" value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'INR')} aria-label="Currency"><option value="INR">₹ INR</option><option value="USD">$ USD</option></select>
          </div>
          <input type="date" className="input !text-[16px]" value={onDate} onChange={(e) => setOnDate(e.target.value)} aria-label="Date" />
          <input className="input !text-[16px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" maxLength={200} />
          {error && <p role="alert" className="text-bad">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !category.trim() || !amount}>{busy ? 'Saving…' : `Add ${type}`}</button>
        </form>
        <div className="mt-5 border-t border-line pt-4">
          <p className="label mb-2">Rupees per dollar</p>
          <div className="flex items-center gap-2">
            <input className="input !w-28 !text-[16px]" inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} aria-label="Rupees per dollar" />
            <button type="button" className="btn" onClick={saveRate}>Save rate</button>
            {rateMsg && <span className="text-[12.5px] text-muted">{rateMsg}</span>}
          </div>
          <p className="mt-2 text-[12.5px] text-faint">Rupee entries are turned into dollars with this number so everything adds up. It is not a live rate; set it to what you actually get.</p>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold">Latest entries</h2>
        {shown.length === 0 ? <p className="mt-3 text-muted">Nothing yet. Add your salary and your first expense on the left.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">{e.category}{e.note ? <span className="text-faint"> · {e.note}</span> : ''}</p>
                  <p className="text-[12.5px] text-faint">{e.onDate}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`tabular-nums ${e.type === 'income' ? 'text-good' : ''}`}>{e.type === 'income' ? '+' : '−'}{fmt(e.amount, e.currency)}</span>
                  <button type="button" className="rounded-md p-1.5 text-faint hover:text-bad" aria-label={`Delete ${e.category} ${e.onDate}`} onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
