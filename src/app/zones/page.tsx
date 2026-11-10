import Link from 'next/link';
import { bucketOf, todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { focusList, listGoals, listTasks, listZones } from '@/lib/store';
import { PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zones' };

const KIND: Record<string, string> = { project: 'Project', growth: 'Growth', study: 'Study', goal: 'Goals' };

export default async function Zones() {
  const db = await getDb(); const today = todayStr();
  const zones = await listZones(db); const open = await listTasks(db, { status: 'open' });
  const goalCount = new Map<string, number>();
  for (const g of await listGoals(db)) if (g.zoneId) goalCount.set(g.zoneId, (goalCount.get(g.zoneId) ?? 0) + 1);
  return (
    <>
      <PageHead title="Zones" sub="Each part of your life and work gets its own space. Open one to see its tasks and goals." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => {
          const mine = open.filter((t) => t.zoneId === z.id);
          const overdue = mine.filter((t) => bucketOf(t.dueOn, today) === 'overdue').length;
          const top = focusList(mine, today, 2);
          return (
            <Link key={z.id} href={`/zones/${z.id}`} className="card card-pad block transition hover:border-line2">
              <div className="flex items-center gap-2.5"><span className="dot" style={{ background: z.color }} /><span className="label">{KIND[z.kind]}</span></div>
              <h2 className="mt-2 text-[18px] font-semibold">{z.name}</h2>
              {z.note && <p className="mt-1 line-clamp-2 text-muted">{z.note}</p>}
              <p className="mt-4 text-muted"><span className="text-ink tabular-nums">{mine.length}</span> open{overdue > 0 && <span className="text-bad"> · {overdue} overdue</span>} · {goalCount.get(z.id) ?? 0} goal{(goalCount.get(z.id) ?? 0) === 1 ? '' : 's'}</p>
              {top.length > 0 && <ul className="mt-3 space-y-1 text-[13px] text-muted">{top.map((t) => <li key={t.id} className="truncate">→ {t.title}</li>)}</ul>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
