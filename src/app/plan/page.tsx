import { todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { listTasks, listZones } from '@/lib/store';
import { TaskBoard } from '@/components/TaskBoard';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plan' };

export default async function Plan() {
  const db = await getDb();
  return (
    <>
      <PageHead title="Plan" sub="Everything you have to do, in time order. Add straight into a column, tick things off, or move them with the menu on each row." />
      <TaskBoard tasks={await listTasks(db, { status: 'open' })} zones={await listZones(db)} today={todayStr()} />
    </>
  );
}
