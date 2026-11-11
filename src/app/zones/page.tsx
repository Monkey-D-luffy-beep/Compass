import { bucketOf, todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { listGoals, listTasks, listZones } from '@/lib/store';
import { PageHead } from '@/components/ui';
import { ZonesBoard } from '@/components/ZonesBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zones' };

export default async function Zones() {
  const db = await getDb(); const today = todayStr();
  const [zones, open, goals] = await Promise.all([listZones(db), listTasks(db, { status: 'open', archived: false }), listGoals(db)]);
  const data = zones.map((z) => {
    const mine = open.filter((t) => t.zoneId === z.id);
    return { id: z.id, name: z.name, kind: z.kind, color: z.color, note: z.note, open: mine.length, overdue: mine.filter((t) => bucketOf(t.dueOn, today) === 'overdue').length, goals: goals.filter((g) => g.zoneId === z.id).length };
  });
  return (
    <>
      <PageHead title="Zones" sub="Each part of your work gets its own space. Click a name or description to edit it, or add a new zone." />
      <ZonesBoard zones={data} />
    </>
  );
}
