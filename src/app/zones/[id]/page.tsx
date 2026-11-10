import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BUCKET_LABEL, bucketOf, todayStr, type Bucket } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { getZone, listGoals, listTasks, listZones } from '@/lib/store';
import { QuickAdd } from '@/components/QuickAdd';
import { TaskRow } from '@/components/TaskRow';
import { Bar, PageHead } from '@/components/ui';
import { DeleteGoal, GoalForm, GoalProgress } from '@/components/MoneyForms';

export const dynamic = 'force-dynamic';

const ORDER: Bucket[] = ['overdue', 'today', 'week', 'next', 'month', 'later'];

export default async function ZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb(); const today = todayStr();
  const zone = await getZone(db, id); if (!zone) notFound();
  const tasks = await listTasks(db, { zoneId: id, status: 'open' });
  const done = (await listTasks(db, { zoneId: id, status: 'done' })).slice(0, 5);
  const goals = await listGoals(db, id);
  const allZones = await listZones(db);

  return (
    <>
      <Link href="/zones" className="text-[13px] text-muted hover:text-ink">← All zones</Link>
      <PageHead title={zone.name} sub={zone.note ?? undefined} right={<span className="pill !px-3 !py-1.5"><span className="dot" style={{ background: zone.color }} />{tasks.length} open</span>} />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="card card-pad"><QuickAdd zones={allZones} defaultZone={id} /></section>
          {ORDER.map((b) => {
            const list = tasks.filter((t) => bucketOf(t.dueOn, today) === b);
            if (!list.length) return null;
            return (
              <section key={b} className="card" aria-label={BUCKET_LABEL[b]}>
                <h2 className={`px-4 pt-4 font-semibold ${b === 'overdue' ? 'text-bad' : ''}`}>{BUCKET_LABEL[b]}</h2>
                <div className="px-1.5 py-2">{list.map((t) => <TaskRow key={t.id} task={t} today={today} showZone={false} />)}</div>
              </section>
            );
          })}
          {tasks.length === 0 && <p className="text-faint">Nothing open in this zone.</p>}
        </div>

        <div className="space-y-5">
          <section className="card card-pad space-y-4">
            <h2 className="font-semibold">Goals</h2>
            {goals.length === 0 && <p className="text-faint">No goals here yet.</p>}
            {goals.map((g) => (
              <div key={g.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2"><p className="leading-snug">{g.title}</p><DeleteGoal id={g.id} /></div>
                <Bar value={g.current} max={g.target} color={zone.color} />
                <GoalProgress goal={g} />
              </div>
            ))}
            <div className="border-t border-line pt-4"><GoalForm zones={[{ id, name: zone.name }]} /></div>
          </section>
          {done.length > 0 && (
            <section className="card card-pad">
              <h2 className="mb-2 font-semibold">Recently done</h2>
              <ul className="space-y-1.5 text-muted">{done.map((t) => <li key={t.id} className="truncate line-through decoration-faint">{t.title}</li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
