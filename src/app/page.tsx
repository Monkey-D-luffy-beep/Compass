import Link from 'next/link';
import { hasKey } from '@/lib/ai';
import { bucketOf, dayLabel, hourNow, todayStr, weekEnd } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { focusList, listTasks, listZones } from '@/lib/store';
import { FocusAdvisor } from '@/components/FocusAdvisor';
import { QuickAdd } from '@/components/QuickAdd';
import { TaskRow } from '@/components/TaskRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today' };

export default async function Today() {
  const db = await getDb();
  const today = todayStr();
  const [zones, open, keyed] = await Promise.all([
    listZones(db), listTasks(db, { status: 'open' }), hasKey(db),
  ]);
  const focus = focusList(open, today, 3);
  const dueNow = open.filter((t) => ['overdue', 'today'].includes(bucketOf(t.dueOn, today)));
  const weekTasks = open.filter((t) => bucketOf(t.dueOn, today) === 'week');
  const hour = hourNow();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">{dayLabel(today)}</p>
          <h1 className="h-page mt-1">{greet}, Saurav</h1>
        </div>
      </header>

      <div className="grid gap-5">
        <section className="card card-pad" aria-label="Focus">
          <p className="label">Do these first</p>
          {focus.length === 0 ? <p className="mt-3 text-muted">Nothing open. Add a task below.</p> : (
            <ol className="mt-3 space-y-2.5">
              {focus.map((t, i) => (
                <li key={t.id} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface2 text-[13px] font-semibold">{i + 1}</span>
                  <div className="min-w-0"><p className="leading-snug">{t.title}</p><p className="mt-0.5 flex items-center gap-3 text-[12.5px] text-muted"><span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: t.zoneColor }} />{t.zoneName}</span>{t.dueOn && <span>{dayLabel(t.dueOn)}</span>}</p></div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 border-t border-line pt-4"><FocusAdvisor hasKey={keyed} /></div>
        </section>
      </div>

      <div className="grid gap-5">
        <section className="card" aria-label="Today's tasks">
          <header className="flex items-baseline justify-between px-4 pt-4"><h2 className="font-semibold">Today and overdue</h2><Link href="/plan" className="text-[13px] text-muted hover:text-ink">Open the timeline</Link></header>
          <div className="px-1.5 py-2">
            {dueNow.length === 0 && <p className="px-3 py-3 text-faint">Nothing due. Pull something from this week below, or add a task.</p>}
            {dueNow.map((t) => <TaskRow key={t.id} task={t} today={today} />)}
          </div>
          <div className="border-t border-line px-4 py-3"><QuickAdd zones={zones} when="today" compact /></div>
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
