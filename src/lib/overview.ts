/** The bird's-eye view: every zone at a glance and what actually got done lately. Pure, so it is tested without a database. */
import { addDays, bucketOf, todayStr } from './dates';
import type { Task, Zone } from './store';

export interface ZoneStat { zone: Zone; open: number; overdue: number; doneWeek: number; addedWeek: number; moneyOpen: number; lastDoneDay: string | null; next: Task[] }
export interface Overview {
  today: string;
  totals: { open: number; overdue: number; doneWeek: number; doneToday: number; addedWeek: number };
  zones: ZoneStat[];
  wins: { day: string; tasks: Task[] }[];   // done in the last 7 days, newest day first
  stalled: ZoneStat[];                       // open work but nothing finished for 14 days
  comingUp: Task[];                          // open, late through the end of this week, soonest first
}

const dayOf = (iso: string | null): string | null => (iso && !Number.isNaN(Date.parse(iso)) ? todayStr(new Date(iso)) : null);

export function buildOverview(zones: Zone[], tasks: Task[], today: string): Overview {
  const weekFrom = addDays(today, -6), stallFrom = addDays(today, -13);
  const stats = new Map<string, ZoneStat>(zones.map((zone) => [zone.id, { zone, open: 0, overdue: 0, doneWeek: 0, addedWeek: 0, moneyOpen: 0, lastDoneDay: null, next: [] }]));
  const winsByDay = new Map<string, Task[]>();
  const comingUp: Task[] = [];
  let doneToday = 0;

  for (const t of tasks) {
    const s = stats.get(t.zoneId); if (!s) continue;
    const created = dayOf(t.createdAt); if (created && created >= weekFrom) s.addedWeek++;
    if (t.status === 'done') {
      const d = dayOf(t.doneAt);
      if (d && (!s.lastDoneDay || d > s.lastDoneDay)) s.lastDoneDay = d;
      if (d && d >= weekFrom) { s.doneWeek++; winsByDay.set(d, [...(winsByDay.get(d) ?? []), t]); if (d === today) doneToday++; }
      continue;
    }
    s.open++; if (t.money >= 2) s.moneyOpen++;
    const b = bucketOf(t.dueOn, today);
    if (b === 'overdue') s.overdue++;
    if (b === 'overdue' || b === 'today' || b === 'week') comingUp.push(t);
    s.next.push(t);
  }
  for (const s of stats.values()) s.next = s.next.slice(0, 2);   // listTasks already orders open work by due date, priority, money

  const list = [...stats.values()];
  const totals = list.reduce((a, s) => ({ open: a.open + s.open, overdue: a.overdue + s.overdue, doneWeek: a.doneWeek + s.doneWeek, addedWeek: a.addedWeek + s.addedWeek, doneToday: 0 }), { open: 0, overdue: 0, doneWeek: 0, addedWeek: 0, doneToday: 0 });
  totals.doneToday = doneToday;
  return {
    today, totals, zones: list,
    wins: [...winsByDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, ts]) => ({ day, tasks: ts })),
    stalled: list.filter((s) => s.open > 0 && (!s.lastDoneDay || s.lastDoneDay < stallFrom)),
    comingUp: comingUp.sort((a, b) => (a.dueOn ?? '9').localeCompare(b.dueOn ?? '9') || b.money - a.money).slice(0, 8),
  };
}
