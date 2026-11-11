import { monthLabel, monthOf, todayStr } from '@/lib/dates';
import { monthlyFinance } from '@/lib/finance';
import { fetchPayouts } from '@/lib/pulse';
import { getDb } from '@/lib/runtime';
import { inrPerUsd, listEntries } from '@/lib/store';
import { PageHead } from '@/components/ui';
import { FinanceForms } from '@/components/FinanceForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finance' };

const usd = (n: number) => `${n < 0 ? '−' : ''}$${String(Math.abs(Math.round(n * 100) / 100)).replace(/\B(?=(\d{3})+(?!\d)(?=\.|$))/g, ',')}`;
const inr = (n: number, rate: number) => `${n < 0 ? '−' : ''}₹${String(Math.abs(Math.round(n * rate))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export default async function Finance() {
  const db = await getDb(); const today = todayStr(); const nowMonth = monthOf(today);
  const [entries, rate, payouts] = await Promise.all([listEntries(db), inrPerUsd(db), fetchPayouts()]);
  const f = monthlyFinance(payouts.state === 'ready' ? payouts.data : [], entries, rate, nowMonth);
  const current = f.rows.find((r) => r.month === nowMonth)!;
  const prev = f.rows.find((r) => r.month < nowMonth);

  return (
    <div className="space-y-6">
      <PageHead title="Finance" sub="What Dodo paid out to your bank, plus your salary and other income, minus your expenses, month by month." />

      {payouts.state !== 'ready' && <p role="status" className="card card-pad text-muted">Dodo payouts are not available ({payouts.why}). Only the income and expenses you type in are counted below.</p>}
      {f.skippedPayouts > 0 && <p role="status" className="card card-pad text-warn">{f.skippedPayouts} payout(s) in another currency were left out.</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="This month">
        <div className="card card-pad"><p className="label">Profit, {monthLabel(nowMonth)}</p><p className={`mt-2 text-[30px] font-semibold leading-none tabular-nums ${current.profit < 0 ? 'text-bad' : ''}`}>{usd(current.profit)}</p><p className="mt-2 text-[12.5px] text-faint">{inr(current.profit, rate)}{prev ? ` · last month ${usd(prev.profit)}` : ''}</p></div>
        <div className="card card-pad"><p className="label">Paid out by Dodo</p><p className="mt-2 text-[30px] font-semibold leading-none tabular-nums">{usd(current.payouts)}</p><p className="mt-2 text-[12.5px] text-faint">this month</p></div>
        <div className="card card-pad"><p className="label">Expenses</p><p className="mt-2 text-[30px] font-semibold leading-none tabular-nums">{usd(current.expenses + current.payoutFees)}</p><p className="mt-2 text-[12.5px] text-faint">{current.payoutFees ? `includes ${usd(current.payoutFees)} Dodo payout fees` : 'this month'}</p></div>
        <div className="card card-pad"><p className="label">All-time profit</p><p className={`mt-2 text-[30px] font-semibold leading-none tabular-nums ${f.totals.profit < 0 ? 'text-bad' : ''}`}>{usd(f.totals.profit)}</p><p className="mt-2 text-[12.5px] text-faint">{inr(f.totals.profit, rate)}</p></div>
      </section>

      <section className="card overflow-x-auto" aria-label="Month by month">
        <table className="w-full min-w-[640px] text-left">
          <thead><tr className="border-b border-line text-[12px] uppercase tracking-wide text-faint">
            <th className="px-4 py-3 font-semibold">Month</th><th className="px-3 py-3 text-right font-semibold">Dodo payouts</th><th className="px-3 py-3 text-right font-semibold">Other income</th><th className="px-3 py-3 text-right font-semibold">Expenses</th><th className="px-4 py-3 text-right font-semibold">Profit</th>
          </tr></thead>
          <tbody>
            {f.rows.map((r) => (
              <tr key={r.month} className={`border-b border-line/60 align-top ${r.month === nowMonth ? 'bg-surface2/50' : ''}`}>
                <td className="px-4 py-3">{monthLabel(r.month)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{usd(r.payouts)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{usd(r.otherIncome)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{usd(r.expenses + r.payoutFees)}
                  {(r.byCategory.length > 0 || r.payoutFees > 0) && <span className="block text-[12px] text-faint">{[...r.byCategory.slice(0, 3).map((c) => `${c.category} ${usd(c.usd)}`), r.payoutFees > 0 ? `Dodo fees ${usd(r.payoutFees)}` : ''].filter(Boolean).join(' · ')}</span>}
                </td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.profit < 0 ? 'text-bad' : 'text-good'}`}>{usd(r.profit)}<span className="block text-[12px] font-normal text-faint">{inr(r.profit, rate)}</span></td>
              </tr>
            ))}
            <tr className="font-semibold"><td className="px-4 py-3">Total</td><td className="px-3 py-3 text-right tabular-nums">{usd(f.totals.payouts)}</td><td className="px-3 py-3 text-right tabular-nums">{usd(f.totals.otherIncome)}</td><td className="px-3 py-3 text-right tabular-nums">{usd(f.totals.expenses + f.totals.payoutFees)}</td><td className={`px-4 py-3 text-right tabular-nums ${f.totals.profit < 0 ? 'text-bad' : ''}`}>{usd(f.totals.profit)}</td></tr>
          </tbody>
        </table>
      </section>
      <p className="text-[12.5px] text-faint">Payouts are what Dodo actually sent to your bank, dated when it paid them, not when customers paid. Money Dodo is still holding is not counted until it is paid out.</p>

      <FinanceForms entries={entries} rate={rate} today={today} />
    </div>
  );
}
