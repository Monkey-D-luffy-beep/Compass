/**
 * Month-by-month money: what Dodo paid out to the bank, plus other income you type in (salary...), minus your expenses
 * (and Dodo's own payout fees). Everything is reported in USD; INR entries are converted at the rate the person sets.
 * Pure, so it is tested without a database or a network.
 */
import type { Entry } from './store';

export interface Payout { id: string; date: string; amount: number; fee: number; currency: string; status: string }   // amount and fee in the currency's minor unit (cents)

export interface MonthRow {
  month: string;            // YYYY-MM
  payouts: number;          // Dodo payouts that reached the bank, USD
  payoutFees: number;       // Dodo's fee per payout, USD (charged on top of the amount)
  otherIncome: number;      // salary and anything else typed in, USD
  expenses: number;         // typed-in expenses, USD
  profit: number;           // payouts + other income - expenses - payout fees
  byCategory: { category: string; usd: number }[];   // expense categories, biggest first
}
export interface Finance { rows: MonthRow[]; totals: Omit<MonthRow, 'month' | 'byCategory'>; skippedPayouts: number }

const r2 = (n: number) => Math.round(n * 100) / 100;
export const monthOf = (date: string) => date.slice(0, 7);

/** Dollars for an entry or payout in USD/INR. Anything else cannot be converted, so the caller counts it as skipped. */
const toUsd = (amount: number, currency: string, rate: number): number | null => (currency === 'USD' ? amount : currency === 'INR' && rate > 0 ? amount / rate : null);

export function monthlyFinance(payouts: Payout[], entries: Entry[], rate: number, nowMonth: string): Finance {
  const rows = new Map<string, MonthRow & { cats: Map<string, number> }>();
  const get = (m: string) => { let r = rows.get(m); if (!r) { r = { month: m, payouts: 0, payoutFees: 0, otherIncome: 0, expenses: 0, profit: 0, byCategory: [], cats: new Map() }; rows.set(m, r); } return r; };
  let skippedPayouts = 0;

  for (const p of payouts) {
    if (p.status !== 'success') continue;
    const amt = toUsd(p.amount / 100, p.currency, rate), fee = toUsd(p.fee / 100, p.currency, rate);
    if (amt === null || fee === null) { skippedPayouts++; continue; }
    const r = get(monthOf(p.date)); r.payouts += amt; r.payoutFees += fee;
  }
  for (const e of entries) {
    const usd = toUsd(e.amount, e.currency, rate); if (usd === null) continue;
    const r = get(monthOf(e.onDate));
    if (e.type === 'income') r.otherIncome += usd;
    else { r.expenses += usd; r.cats.set(e.category, (r.cats.get(e.category) ?? 0) + usd); }
  }
  get(nowMonth);   // the current month always shows, even when empty

  const list = [...rows.values()].sort((a, b) => b.month.localeCompare(a.month)).map((r) => {
    const out: MonthRow = { month: r.month, payouts: r2(r.payouts), payoutFees: r2(r.payoutFees), otherIncome: r2(r.otherIncome), expenses: r2(r.expenses), profit: 0, byCategory: [...r.cats.entries()].map(([category, usd]) => ({ category, usd: r2(usd) })).sort((a, b) => b.usd - a.usd) };
    out.profit = r2(out.payouts + out.otherIncome - out.expenses - out.payoutFees);
    return out;
  });
  const sum = (k: 'payouts' | 'payoutFees' | 'otherIncome' | 'expenses' | 'profit') => r2(list.reduce((s, r) => s + r[k], 0));
  return { rows: list, totals: { payouts: sum('payouts'), payoutFees: sum('payoutFees'), otherIncome: sum('otherIncome'), expenses: sum('expenses'), profit: sum('profit') }, skippedPayouts };
}
