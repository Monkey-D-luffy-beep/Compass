import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ClipboardList, Link2, Plus, Target, Timer } from 'lucide-react';
import { hasKey } from '@/lib/ai';
import { bucketOf, dayLabel, hourNow, todayStr, weekEnd } from '@/lib/dates';
import { doneStreak, weekDays } from '@/lib/overview';
import { getDb } from '@/lib/runtime';
import { focusList, getSetting, listTasks, listZones } from '@/lib/store';
import { FocusAdvisor } from '@/components/FocusAdvisor';
import { TaskRow } from '@/components/TaskRow';
import { Empty, Panel, ProgressRing, StatusBadge, StreakBadge, WeekBars } from '@/components/ds';
import { CaptureBar, FocusTimer } from '@/components/ds-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today' };

function Counter({ n, status }: { n: number; status: 'todo' | 'overdue' | 'done' }) {
  return <div className="text-center"><p className="font-pixel text-[44px] font-bold leading-none tabular-nums">{n}</p><div className="mt-2"><StatusBadge status={status} label={status === 'todo' ? 'To do' : undefined} /></div></div>;
}

export default async function Today() {
  const db = await getDb();
  const today = todayStr();
  const [zones, all, keyed, name] = await Promise.all([listZones(db), listTasks(db), hasKey(db), getSetting(db, 'display_name')]);
  const open = all.filter((t) => t.status !== 'done');
  const focus = focusList(open, today, 3);
  const overdue = open.filter((t) => bucketOf(t.dueOn, today) === 'overdue');
  const dueToday = open.filter((t) => bucketOf(t.dueOn, today) === 'today');
  const doneToday = all.filter((t) => t.status === 'done' && t.doneAt && todayStr(new Date(t.doneAt)) === today).length;
  const planned = overdue.length + dueToday.length + doneToday;
  const weekTasks = open.filter((t) => bucketOf(t.dueOn, today) === 'week');
  const week = weekDays(all, today);
  const hour = hourNow();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-lg border-2 border-outline shadow-[0_3px_0_var(--shadow)]" aria-label="Welcome">
        <h1 className="sr-only">{greet}, {name || 'Saurav'}</h1>
        {/* The banner is the supplied pixel-art image; its greeting is part of the picture. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banner-hero.png" alt="" className="block h-auto min-h-[116px] w-full object-cover object-left" />
        <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-md border-2 border-outline bg-surface px-2.5 py-1 text-[13px] font-semibold text-ink shadow-[0_2px_0_var(--shadow)]">{dayLabel(today)}</span>
          <StreakBadge days={doneStreak(all, today)} />
        </div>
      </section>
      <CaptureBar zones={zones.map((z) => ({ id: z.id, name: z.name }))} />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Today and overdue" icon={<ClipboardList className="h-5 w-5 text-accent-ink" />} action={<Link href="/plan" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">Open the board<ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3">
            <div className="grid flex-1 grid-cols-3 gap-2"><Counter n={dueToday.length} status="todo" /><Counter n={overdue.length} status="overdue" /><Counter n={doneToday} status="done" /></div>
            <ProgressRing value={planned ? doneToday / planned : 0} size={104} />
          </div>
          <div className="-mx-1.5 border-t-2 border-line pt-2">
            {overdue.length + dueToday.length === 0 && <Empty sprite="star">Nothing due today. Capture something above, or pull a task from this week.</Empty>}
            {[...overdue, ...dueToday].map((t) => <TaskRow key={t.id} task={t} today={today} />)}
          </div>
        </Panel>

        <Panel title="Do these first" icon={<Target className="h-5 w-5 text-accent-ink" />}>
          {focus.length === 0 ? <Empty>Nothing open. Capture a task above.</Empty> : (
            <ol className="space-y-3">
              {focus.map((t, i) => (
                <li key={t.id} className="flex items-start gap-3">
                  <span className="font-pixel grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-outline bg-accent text-[18px] font-bold text-on-accent">{i + 1}</span>
                  <div className="min-w-0"><p className="leading-snug">{t.title}</p><p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted"><span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: t.zoneColor }} />{t.zoneName}</span>{t.dueOn && <span>{dayLabel(t.dueOn)}</span>}</p></div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 border-t-2 border-line pt-4"><FocusAdvisor hasKey={keyed} /></div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr]">
        <Panel title="This week" icon={<CalendarDays className="h-5 w-5 text-accent-ink" />} action={<span className="text-[13px] text-muted">until {dayLabel(weekEnd(today))}</span>}><WeekBars days={week} /></Panel>
        <Panel title="Focus zone" icon={<Timer className="h-5 w-5 text-accent-ink" />}><FocusTimer /></Panel>
        <Panel title="Quick links" icon={<Link2 className="h-5 w-5 text-accent-ink" />}>
          <div className="grid grid-cols-2 gap-2.5">
            {zones.slice(0, 3).map((z) => (
              <Link key={z.id} href={`/zones/${z.id}`} className="card-hover flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-outline bg-surface2 px-1.5 py-2 text-center text-[12.5px] font-semibold shadow-[0_2px_0_var(--shadow)] hover:bg-accent/30">
                <span className="font-pixel grid h-7 w-7 place-items-center rounded-md border-2 border-outline text-[18px] text-white" style={{ background: z.color }}>{z.name.charAt(0).toUpperCase()}</span><span className="line-clamp-2 leading-tight">{z.name}</span>
              </Link>
            ))}
            <Link href="/zones" className="flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-outline/60 px-1.5 py-2 text-[12.5px] font-semibold text-muted hover:bg-surface2"><Plus className="h-5 w-5" />Add</Link>
          </div>
        </Panel>
      </div>

      <Panel title="Rest of this week" icon={<CalendarDays className="h-5 w-5 text-accent-ink" />}>
        <div className="-mx-1.5">
          {weekTasks.length === 0 && <p className="px-3 py-2 text-muted">Nothing else scheduled this week.</p>}
          {weekTasks.slice(0, 8).map((t) => <TaskRow key={t.id} task={t} today={today} />)}
          {weekTasks.length > 8 && <Link href="/plan" className="block px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink">+{weekTasks.length - 8} more on the board</Link>}
        </div>
      </Panel>
    </div>
  );
}
