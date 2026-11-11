import Link from 'next/link';
import { buildOverview } from '@/lib/overview';
import { dayLabel, todayStr } from '@/lib/dates';
import { getDb } from '@/lib/runtime';
import { listTasks, listZones } from '@/lib/store';
import { Bar, PageHead } from '@/components/ui';
import { PulseGlance } from '@/components/PulseGlance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

function Stat({ label, value, hint, bad }: { label: string; value: number; hint?: string; bad?: boolean }) {
  return <div className="card card-pad"><p className="label">{label}</p><p className={`mt-2 text-[30px] font-semibold leading-none tabular-nums ${bad && value > 0 ? 'text-bad' : ''}`}>{value}</p>{hint && <p className="mt-2 text-[12.5px] text-faint">{hint}</p>}</div>;
}

export default async function Overview() {
  const db = await getDb(); const today = todayStr();
  const [zones, tasks] = await Promise.all([listZones(db), listTasks(db)]);
  const o = buildOverview(zones, tasks, today);

  return (
    <div className="space-y-7">
      <PageHead title="Overview" sub="Everything at a glance: how the business is doing, where each project stands, and what actually got done." />

      <PulseGlance />

      <section aria-label="Work">
        <p className="label mb-2">Work, last 7 days</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Done this week" value={o.totals.doneWeek} hint={`${o.totals.doneToday} today`} />
          <Stat label="Added this week" value={o.totals.addedWeek} />
          <Stat label="Open now" value={o.totals.open} />
          <Stat label="Overdue" value={o.totals.overdue} bad hint={o.totals.overdue ? 'Move it or drop it' : 'Nothing late'} />
        </div>
      </section>

      {o.stalled.length > 0 && (
        <section className="card card-pad" aria-label="Stalled">
          <p className="label text-warn">Nothing finished in 14 days</p>
          <p className="mt-1 text-muted">{o.stalled.map((s) => s.zone.name).join(', ')}: open work is sitting there. Do one small thing in each, or archive the zone.</p>
        </section>
      )}

      <section aria-label="Projects">
        <p className="label mb-2">Projects</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {o.zones.map((s) => (
            <Link key={s.zone.id} href={`/zones/${s.zone.id}`} className="card card-pad block transition hover:bg-surface2">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-medium"><span className="dot" style={{ background: s.zone.color }} />{s.zone.name}</p>
                <span className="text-[12.5px] text-muted">{s.open} open{s.overdue ? <span className="text-bad"> · {s.overdue} late</span> : ''}</span>
              </div>
              <div className="mt-3"><Bar value={s.doneWeek} max={Math.max(1, s.doneWeek + s.open)} color={s.zone.color} /></div>
              <p className="mt-2 text-[12.5px] text-muted">{s.doneWeek} done this week{s.addedWeek ? ` · ${s.addedWeek} added` : ''}</p>
              {s.next.length > 0 && <ul className="mt-3 space-y-1 text-[13.5px]">{s.next.map((t) => <li key={t.id} className="truncate text-muted">{t.title}</li>)}</ul>}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad" aria-label="Done">
          <p className="label">What got done</p>
          {o.wins.length === 0 ? <p className="mt-3 text-muted">Nothing finished in the last 7 days.</p> : (
            <div className="mt-3 space-y-4">
              {o.wins.map((w) => (
                <div key={w.day}>
                  <p className="text-[12.5px] text-faint">{dayLabel(w.day)} · {w.tasks.length}</p>
                  <ul className="mt-1 space-y-1">{w.tasks.map((t) => <li key={t.id} className="flex items-start gap-2"><span className="dot mt-2 shrink-0" style={{ background: t.zoneColor }} /><span className="leading-snug">{t.title}</span></li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card card-pad" aria-label="Coming up">
          <p className="label">Coming up (late, today, this week)</p>
          {o.comingUp.length === 0 ? <p className="mt-3 text-muted">Nothing due this week.</p> : (
            <ul className="mt-3 space-y-2">{o.comingUp.map((t) => <li key={t.id} className="flex items-start justify-between gap-3"><span className="flex items-start gap-2"><span className="dot mt-2 shrink-0" style={{ background: t.zoneColor }} /><span className="leading-snug">{t.title}</span></span><span className="shrink-0 text-[12.5px] text-muted">{t.dueOn ? dayLabel(t.dueOn) : ''}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
