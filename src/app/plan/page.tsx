import { getDb } from '@/lib/runtime';
import { archiveOldDone, listTasks, listZones } from '@/lib/store';
import { KanbanBoard } from '@/components/KanbanBoard';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plan' };

export default async function Plan() {
  const db = await getDb();
  await archiveOldDone(db, 7);   // done work older than a week tucks itself away
  const [zones, tasks, archived] = await Promise.all([listZones(db), listTasks(db, { archived: false }), listTasks(db, { status: 'done', archived: true })]);
  return (
    <>
      <PageHead title="Plan" sub="Planned, in progress, done. Every task belongs to a project. Done work older than a week is archived for you." />
      <KanbanBoard zones={zones} tasks={tasks} archived={archived} />
    </>
  );
}
