import { todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { listRoutines, listZones, runsOn } from '@/lib/store';
import { RoutineList } from '@/components/RoutineList';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Routine' };

export default async function Routine() {
  const db = await getDb(); const today = todayStr();
  const items = (await listRoutines(db, today)).map((r) => ({ ...r, runsToday: runsOn(r.days, today) }));
  const minutes = items.filter((r) => r.runsToday).reduce((s, r) => s + (r.minutes ?? 0), 0);
  const money = items.filter((r) => r.runsToday && r.money >= 2).reduce((s, r) => s + (r.minutes ?? 0), 0);
  return (
    <>
      <PageHead title="Routine" sub="What you do every day, in the order that earns money first." />
      <p className="mb-5 text-muted">Today adds up to <span className="text-ink">{Math.round((minutes / 60) * 10) / 10} h</span>, of which <span className="text-good">{Math.round((money / 60) * 10) / 10} h</span> is work that directly earns money.</p>
      <section className="card card-pad"><RoutineList items={items} manage zones={await listZones(db)} /></section>
    </>
  );
}
