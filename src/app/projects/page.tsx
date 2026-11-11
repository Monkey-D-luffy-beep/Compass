import { getDb } from '@/lib/runtime';
import { listTasks, listZones } from '@/lib/store';
import { PageHead } from '@/components/ui';
import { ProjectBoard } from '@/components/ProjectBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projects' };

export default async function Projects() {
  const db = await getDb();
  const [zones, tasks, archived] = await Promise.all([listZones(db), listTasks(db, { archived: false }), listTasks(db, { status: 'done', archived: true })]);
  return (
    <>
      <PageHead title="Projects" sub="One block per project. Add tasks inside it, tick them off, and archive what is finished to keep it clean." />
      <ProjectBoard zones={zones} tasks={tasks} archived={archived} />
    </>
  );
}
