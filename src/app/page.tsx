import Link from 'next/link';
import { Flame } from 'lucide-react';
import { hasKey } from '@/lib/ai';
import { bucketOf, dayLabel, hourNow, monthLabel, todayStr, weekEnd } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { focusList, listRevenue, listRoutines, listTasks, listZones, monthTotals, revenueGoal, runsOn, streak } from '@/lib/store';
import { FocusAdvisor } from '@/components/FocusAdvisor';
import { QuickAdd } from '@/components/QuickAdd';
import { RoutineList } from '@/components/RoutineList';
import { TaskRow } from '@/components/TaskRow';
import { Bar, Money, Spark, fmtUsd } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today' };

export default async function Today() {
  const db = await getDb();
  const today = todayStr();
  const [zones, open, revRows, goal, routineRows, days, keyed] = await Promise.all([
    listZones(db), listTasks(db, { status: 'open' }), listRevenue(db), revenueGoal(db), listRoutines(db, today), streak(db, today), hasKey(db),
  ]);
  const focus = focusList(open, today, 3);
  const dueNow = open.filter((t) => ['overdue', 'today'].includes(bucketOf(t.dueOn, today)));
  const weekTasks = open.filter((t) => bucketOf(t.dueOn, today) === 'week');
  const totals = monthTotals(revRows);
  const latest = totals[totals.length - 1];
  const routine = routineRows.map((r) => ({ ...r, runsToday: runsOn(r.days, today) })).filter((r) => r.runsToday);
  const doneCount = routine.filter((r) => r.doneToday).length;
  const hour = hourNow();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">{dayLabel(today)}</p>
          <h1 className="h-page mt-1">{greet}, Saurav</h1>
        </div>
        {days > 0 && <span className="pill !px-3 !py-1.5 text-warn"><Flame className="h-4 w-4" />{days}-day routine streak</span>}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <section className="card card-pad" aria-label="Money">
          <div className="flex items-start justify-between">
            <p className="label">Monthly revenue</p>
            <Link href="/money" className="text-[13px] text-muted hover:text-ink">Log numbers</Link>
          </div>
          <p className="mt-2 text-[34px] font-semibold leading-none tabular-nums">{fmtUsd(latest?.total ?? 0)}<span className="ml-2 text-[15px] font-normal text-muted">of {fmtUsd(goal)}</span></p>
          <div className="mt-4"><Bar value={latest?.total ?? 0} max={goal} /></div>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-muted">{latest ? `${monthLabel(latest.month)}. ` : ''}{(latest?.total ?? 0) >= goal ? 'Goal reached.' : `${fmtUsd(goal - (latest?.total ?? 0))} to go.`}</p>
            <Spark values={totals.slice(-6).map((t) => t.total)} />
          </div>
        </section>

        <section className="card card-pad" aria-label="Focus">
          <p className="label">Do these first</p>
          {focus.length === 0 ? <p className="mt-3 text-muted">Nothing open. Add a task below.</p> : (
            <ol className="mt-3 space-y-2.5">
              {focus.map((t, i) => (
                <li key={t.id} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface2 text-[13px] font-semibold">{i + 1}</span>
                  <div className="min-w-0"><p className="leading-snug">{t.title}</p><p className="mt-0.5 flex items-center gap-3 text-[12.5px] text-muted"><span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: t.zoneColor }} />{t.zoneName}</span><Money n={t.money} />{t.dueOn && <span>{dayLabel(t.dueOn)}</span>}</p></div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 border-t border-line pt-4"><FocusAdvisor hasKey={keyed} /></div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="card" aria-label="Today's tasks">
          <header className="flex items-baseline justify-between px-4 pt-4"><h2 className="font-semibold">Today and overdue</h2><Link href="/plan" className="text-[13px] text-muted hover:text-ink">Open the timeline</Link></header>
          <div className="px-1.5 py-2">
            {dueNow.length === 0 && <p className="px-3 py-3 text-faint">Nothing due. Pull something from this week below, or add a task.</p>}
            {dueNow.map((t) => <TaskRow key={t.id} task={t} today={today} />)}
          </div>
          <div className="border-t border-line px-4 py-3"><QuickAdd zones={zones} when="today" compact /></div>
        </section>

        <section className="card card-pad" aria-label="Routine">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="font-semibold">Today&apos;s routine</h2><span className="text-[13px] text-muted">{doneCount} of {routine.length}</span></div>
          <RoutineList items={routine} />
          <Link href="/routine" className="mt-3 inline-block text-[13px] text-muted hover:text-ink">Edit routine</Link>
        </section>
      </div>

      <section className="card" aria-label="This week">
        <header className="flex items-baseline justify-between px-4 pt-4"><h2 className="font-semibold">Rest of this week</h2><span className="text-[13px] text-faint">until {dayLabel(weekEnd(today))}</span></header>
        <div className="px-1.5 py-2">
          {weekTasks.length === 0 && <p className="px-3 py-3 text-faint">Nothing else scheduled this week.</p>}
          {weekTasks.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} today={today} />)}
          {weekTasks.length > 8 && <Link href="/plan" className="block px-3 py-2 text-[13px] text-muted hover:text-ink">+{weekTasks.length - 8} more in the timeline</Link>}
        </div>
      </section>
    </div>
  );
}
