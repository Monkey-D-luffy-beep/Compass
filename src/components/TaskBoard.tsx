"use client";
import { useMemo, useState } from 'react';
import { BUCKET_LABEL, bucketOf, type Bucket, type When } from '@/lib/dates';
import type { Task, Zone } from '@/lib/store';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';

const ORDER: Bucket[] = ['overdue', 'today', 'week', 'next', 'month', 'later'];
const WHEN: Partial<Record<Bucket, When>> = { today: 'today', week: 'week', next: 'next', month: 'month', later: 'later' };

const hours = (mins: number) => (mins >= 60 ? `${Math.round((mins / 60) * 10) / 10} h` : `${mins} min`);

/** The timeline: overdue, today, this week, next week, this month, later. Filter by zone, add straight into a column. */
export function TaskBoard({ tasks, zones, today }: { tasks: Task[]; zones: Zone[]; today: string }) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const shown = useMemo(() => tasks.filter((t) => t.status !== 'done' && (!zoneId || t.zoneId === zoneId)), [tasks, zoneId]);
  const by = useMemo(() => {
    const m = new Map<Bucket, Task[]>(ORDER.map((b) => [b, []]));
    for (const t of shown) m.get(bucketOf(t.dueOn, today))!.push(t);
    return m;
  }, [shown, today]);
  const cols = ORDER.filter((b) => b !== 'overdue' || (by.get('overdue')?.length ?? 0) > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by zone">
        <button className={`pill !px-3.5 !py-1.5 ${!zoneId ? '!bg-surface2 !text-ink !border-line2' : ''}`} onClick={() => setZoneId(null)}>All zones</button>
        {zones.map((z) => (
          <button key={z.id} className={`pill !px-3.5 !py-1.5 ${zoneId === z.id ? '!bg-surface2 !text-ink !border-line2' : ''}`} onClick={() => setZoneId(zoneId === z.id ? null : z.id)}>
            <span className="dot" style={{ background: z.color }} />{z.name}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
        {cols.map((b) => {
          const list = by.get(b) ?? [];
          const mins = list.reduce((s, t) => s + (t.effort ?? 0), 0);
          return (
            <section key={b} className="card flex flex-col" aria-label={BUCKET_LABEL[b]}>
              <header className="flex items-baseline justify-between px-4 pt-4">
                <h2 className={`font-semibold ${b === 'overdue' ? 'text-bad' : ''}`}>{BUCKET_LABEL[b]}</h2>
                <span className="text-[12.5px] text-faint">{list.length} task{list.length === 1 ? '' : 's'}{mins ? ` · ${hours(mins)}` : ''}</span>
              </header>
              <div className="flex-1 px-1.5 py-2">
                {list.length === 0 && <p className="px-3 py-3 text-faint">Nothing here.</p>}
                {list.map((t) => <TaskRow key={t.id} task={t} today={today} />)}
              </div>
              {WHEN[b] && <div className="border-t border-line px-4 py-3"><QuickAdd zones={zones} when={WHEN[b]} defaultZone={zoneId ?? undefined} compact /></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
