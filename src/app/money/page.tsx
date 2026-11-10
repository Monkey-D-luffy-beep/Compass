import { monthLabel, monthOf, todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { listRevenue, listTasks, monthTotals, revenueGoal } from '@/lib/store';
import { Bar, PageHead, Spark, fmtUsd } from '@/components/ui';
import { RevenueForm, RevenueTable } from '@/components/MoneyForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Money' };

export default async function Money() {
  const db = await getDb(); const month = monthOf(todayStr());
  const rows = await listRevenue(db); const totals = monthTotals(rows); const goal = await revenueGoal(db);
  const latest = totals[totals.length - 1]; const prev = totals[totals.length - 2];
  const sources = [...new Set(rows.map((r) => r.source))];
  const latestRows = latest ? rows.filter((r) => r.month === latest.month).sort((a, b) => b.amount - a.amount) : [];
  const moneyTasks = (await listTasks(db, { status: 'open' })).filter((t) => t.money >= 2).slice(0, 5);
  const change = latest && prev ? latest.total - prev.total : null;

  return (
    <>
      <PageHead title="Money" sub={`The goal is ${fmtUsd(goal)} a month. Log what each product earned so you can see what is working.`} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <p className="label">{latest ? monthLabel(latest.month) : 'This month'}</p>
          <p className="mt-2 text-[40px] font-semibold leading-none tabular-nums">{fmtUsd(latest?.total ?? 0)}</p>
          <div className="mt-4"><Bar value={latest?.total ?? 0} max={goal} /></div>
          <p className="mt-3 text-muted">
            {(latest?.total ?? 0) >= goal ? 'Goal reached.' : `${fmtUsd(goal - (latest?.total ?? 0))} short of the goal.`}
            {change !== null && <> {change >= 0 ? 'Up' : 'Down'} {fmtUsd(Math.abs(change))} on {monthLabel(prev.month)}.</>}
          </p>
          <div className="mt-5 flex items-center gap-4"><Spark values={totals.slice(-8).map((t) => t.total)} width={220} height={46} /><span className="text-[12.5px] text-faint">last {Math.min(8, totals.length)} months</span></div>
        </section>
        <section className="card card-pad">
          <p className="label">What is working</p>
          {latestRows.length === 0 ? <p className="mt-3 text-faint">Log a month to see it.</p> : (
            <ul className="mt-3 space-y-3">
              {latestRows.map((r) => (
                <li key={r.id}><div className="flex justify-between"><span>{r.source}</span><span className="tabular-nums text-muted">{fmtUsd(r.amount)}</span></div><div className="mt-1"><Bar value={r.amount} max={latestRows[0].amount} color="var(--accent)" /></div></li>
              ))}
            </ul>
          )}
          {latestRows.length === 1 && latestRows[0].source.toLowerCase().includes('all') && <p className="mt-3 text-[12.5px] text-warn">One lump sum hides what works. Split it by product.</p>}
        </section>
      </div>

      <section className="card card-pad mt-5"><h2 className="mb-3 font-semibold">Log a month</h2><RevenueForm month={month} sources={sources} /></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card card-pad"><h2 className="mb-2 font-semibold">History</h2><RevenueTable rows={rows} /></section>
        <section className="card card-pad">
          <h2 className="mb-2 font-semibold">Tasks that earn money</h2>
          {moneyTasks.length === 0 ? <p className="text-faint">No open task is marked as bringing revenue. That is a finding.</p> : <ul className="space-y-2">{moneyTasks.map((t) => <li key={t.id} className="flex gap-2"><span className="text-good">{'$'.repeat(t.money)}</span><span className="leading-snug">{t.title}</span></li>)}</ul>}
        </section>
      </div>
    </>
  );
}
