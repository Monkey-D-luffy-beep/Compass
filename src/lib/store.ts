import { randomUUID } from 'node:crypto';
import { bucketOf, dueFor, monthOf, todayStr, type Bucket, type When } from './dates';
import { InputError } from './errors';
import type { Db, Row } from './pg';

export { InputError };
export type { Db };

const now = () => new Date().toISOString();
const clamp = (n: unknown, lo: number, hi: number, dflt: number) => { const x = Math.round(Number(n)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt; };
const one = async (db: Db, sql: string, p: unknown[] = []): Promise<Row | undefined> => (await db.query(sql, p))[0];

/* ----------------------------------------------------------------------------------------------- zones */
export interface Zone { id: string; name: string; kind: 'project' | 'growth' | 'study' | 'goal'; color: string; note: string | null; sort: number; archived: boolean }
const toZone = (r: Row): Zone => ({ id: r.id as string, name: r.name as string, kind: r.kind as Zone['kind'], color: r.color as string, note: (r.note as string) ?? null, sort: r.sort as number, archived: !!r.archived });

export const listZones = async (db: Db, includeArchived = false): Promise<Zone[]> =>
  (await db.query(`select * from zones ${includeArchived ? '' : 'where archived = 0'} order by sort, name`)).map(toZone);
export const getZone = async (db: Db, id: string): Promise<Zone | null> => { const r = await one(db, 'select * from zones where id = ?', [id]); return r ? toZone(r) : null; };
export async function zoneByNameOrId(db: Db, key: string): Promise<Zone | null> {
  const k = key.trim().toLowerCase(); const all = await listZones(db);
  return all.find((z) => z.id === key || z.name.toLowerCase() === k) ?? (k ? all.find((z) => z.name.toLowerCase().startsWith(k)) : undefined) ?? null;
}
export async function addZone(db: Db, i: { name: string; kind?: Zone['kind']; color?: string; note?: string }): Promise<Zone> {
  const name = i.name?.trim(); if (!name) throw new InputError('Give the zone a name.');
  const sort = Number((await one(db, 'select coalesce(max(sort), -1) + 1 as n from zones'))!.n);
  const zid = randomUUID();
  await db.run('insert into zones (id, name, kind, color, note, sort) values (?,?,?,?,?,?)', [zid, name.slice(0, 60), i.kind ?? 'project', i.color ?? '#8b90a0', i.note?.trim() || null, sort]);
  return (await getZone(db, zid))!;
}
export async function updateZone(db: Db, id: string, p: { name?: string; color?: string; note?: string | null; archived?: boolean }): Promise<Zone> {
  const z = await getZone(db, id); if (!z) throw new InputError('That zone does not exist.');
  await db.run('update zones set name = ?, color = ?, note = ?, archived = ? where id = ?',
    [(p.name ?? z.name).trim().slice(0, 60) || z.name, p.color ?? z.color, p.note === undefined ? z.note : p.note?.trim() || null, (p.archived ?? z.archived) ? 1 : 0, id]);
  return (await getZone(db, id))!;
}

/* ----------------------------------------------------------------------------------------------- tasks */
export const KINDS = ['build', 'growth', 'maintenance', 'study', 'admin'] as const;
export type Kind = (typeof KINDS)[number];
export interface Task {
  id: string; zoneId: string; zoneName: string; zoneColor: string; title: string; notes: string | null;
  status: 'todo' | 'doing' | 'done'; dueOn: string | null; priority: number; money: number; kind: Kind; effort: number | null; createdAt: string; doneAt: string | null; archivedAt: string | null;
}
const toTask = (r: Row): Task => ({
  id: r.id as string, zoneId: r.zone_id as string, zoneName: r.zone_name as string, zoneColor: r.zone_color as string, title: r.title as string, notes: (r.notes as string) ?? null,
  status: r.status as Task['status'], dueOn: (r.due_on as string) ?? null, priority: r.priority as number, money: r.money as number, kind: r.kind as Kind, effort: (r.effort as number) ?? null,
  createdAt: r.created_at as string, doneAt: (r.done_at as string) ?? null, archivedAt: (r.archived_at as string) ?? null,
});
const TASK_SQL = 'select t.*, z.name as zone_name, z.color as zone_color from tasks t join zones z on z.id = t.zone_id';

/** archived: undefined = everything, false = hide archived, true = only archived. */
export async function listTasks(db: Db, o: { zoneId?: string; status?: 'open' | 'done'; archived?: boolean } = {}): Promise<Task[]> {
  const w: string[] = []; const a: unknown[] = [];
  if (o.zoneId) { w.push('t.zone_id = ?'); a.push(o.zoneId); }
  if (o.status === 'open') w.push("t.status != 'done'");
  if (o.status === 'done') w.push("t.status = 'done'");
  if (o.archived === false) w.push('t.archived_at is null');
  if (o.archived === true) w.push('t.archived_at is not null');
  const order = o.status === 'done' ? 't.done_at desc' : "coalesce(t.due_on, '9999-99-99'), t.priority, t.money desc, t.created_at";
  return (await db.query(`${TASK_SQL} ${w.length ? 'where ' + w.join(' and ') : ''} order by ${order}`, a)).map(toTask);
}
export const getTask = async (db: Db, id: string): Promise<Task | null> => { const r = await one(db, `${TASK_SQL} where t.id = ?`, [id]); return r ? toTask(r) : null; };

export interface NewTask { zone: string; title: string; when?: When; dueOn?: string | null; money?: number; kind?: Kind; priority?: number; effort?: number | null; notes?: string }
const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function addTask(db: Db, i: NewTask, today = todayStr()): Promise<Task> {
  const title = i.title?.trim(); if (!title) throw new InputError('Write what needs doing.');
  const zone = await zoneByNameOrId(db, i.zone ?? ''); if (!zone) throw new InputError('Pick a zone for it.');
  if (i.dueOn && !validDate(i.dueOn)) throw new InputError('That date is not valid.');
  const due = i.dueOn !== undefined ? i.dueOn || null : dueFor(i.when ?? 'later', today);
  const tid = randomUUID();
  await db.run('insert into tasks (id, zone_id, title, notes, due_on, priority, money, kind, effort, created_at) values (?,?,?,?,?,?,?,?,?,?)',
    [tid, zone.id, title.slice(0, 300), i.notes?.trim() || null, due, clamp(i.priority, 1, 3, 2), clamp(i.money, 0, 3, 0),
      (KINDS as readonly string[]).includes(i.kind ?? '') ? (i.kind as string) : 'build', i.effort ? clamp(i.effort, 1, 1440, 30) : null, now()]);
  return (await getTask(db, tid))!;
}
export interface TaskPatch { title?: string; notes?: string | null; status?: Task['status']; archived?: boolean; when?: When; dueOn?: string | null; money?: number; kind?: Kind; priority?: number; effort?: number | null; zone?: string }
export async function updateTask(db: Db, id: string, p: TaskPatch, today = todayStr()): Promise<Task> {
  const t = await getTask(db, id); if (!t) throw new InputError('That task does not exist.');
  const zone = p.zone ? await zoneByNameOrId(db, p.zone) : null; if (p.zone && !zone) throw new InputError('That zone does not exist.');
  if (p.dueOn && !validDate(p.dueOn)) throw new InputError('That date is not valid.');
  if (p.title !== undefined && !p.title.trim()) throw new InputError('A task needs a title.');
  const status = p.status && ['todo', 'doing', 'done'].includes(p.status) ? p.status : t.status;
  const due = p.dueOn !== undefined ? p.dueOn || null : p.when ? dueFor(p.when, today) : t.dueOn;
  await db.run('update tasks set zone_id = ?, title = ?, notes = ?, status = ?, due_on = ?, priority = ?, money = ?, kind = ?, effort = ?, done_at = ?, archived_at = ? where id = ?', [
    zone?.id ?? t.zoneId, (p.title ?? t.title).trim().slice(0, 300), p.notes === undefined ? t.notes : p.notes?.trim() || null, status, due,
    p.priority === undefined ? t.priority : clamp(p.priority, 1, 3, 2), p.money === undefined ? t.money : clamp(p.money, 0, 3, 0),
    p.kind && (KINDS as readonly string[]).includes(p.kind) ? p.kind : t.kind, p.effort === undefined ? t.effort : p.effort ? clamp(p.effort, 1, 1440, 30) : null,
    status === 'done' ? (t.doneAt ?? now()) : null,
    p.archived === undefined ? t.archivedAt : p.archived ? (t.archivedAt ?? now()) : null, id]);
  return (await getTask(db, id))!;
}
/** Tuck every finished task of a project (or of all projects) away. Returns how many. */
export async function archiveDone(db: Db, zoneId?: string): Promise<number> {
  const rows = await db.query(`select id from tasks where status = 'done' and archived_at is null${zoneId ? ' and zone_id = ?' : ''}`, zoneId ? [zoneId] : []);
  if (rows.length) await db.run(`update tasks set archived_at = ? where status = 'done' and archived_at is null${zoneId ? ' and zone_id = ?' : ''}`, zoneId ? [now(), zoneId] : [now()]);
  return rows.length;
}
/** Archive finished tasks that were done more than `days` days ago, so the Done column stays about this week. Returns how many. */
export async function archiveOldDone(db: Db, days = 7, at = new Date()): Promise<number> {
  const cutoff = new Date(at.getTime() - days * 86_400_000).toISOString();
  const rows = await db.query("select id from tasks where status = 'done' and archived_at is null and done_at < ?", [cutoff]);
  if (rows.length) await db.run("update tasks set archived_at = ? where status = 'done' and archived_at is null and done_at < ?", [at.toISOString(), cutoff]);
  return rows.length;
}
export const deleteTask = async (db: Db, id: string) => { await db.run('delete from tasks where id = ?', [id]); };

/** Which open tasks to look at first: money, then how soon, then priority. Pure so it can be tested. */
export function focusScore(t: Pick<Task, 'money' | 'priority' | 'dueOn' | 'status'>, today: string): number {
  if (t.status === 'done') return -1;
  const b: Bucket = bucketOf(t.dueOn, today);
  const when = { overdue: 6, today: 5, week: 3, next: 1, month: 0.5, later: 0 }[b];
  return t.money * 3 + when + (3 - t.priority) * 1.5 + (t.status === 'doing' ? 1 : 0);
}
export function focusList(tasks: Task[], today: string, n = 3): Task[] {
  return tasks.filter((t) => t.status !== 'done').map((t) => ({ t, s: focusScore(t, today) })).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.t);
}

/* ----------------------------------------------------------------------------------------------- goals */
export interface Goal { id: string; zoneId: string | null; zoneName: string | null; zoneColor: string | null; title: string; target: number; current: number; unit: string; dueOn: string | null; note: string | null }
const toGoal = (r: Row): Goal => ({ id: r.id as string, zoneId: (r.zone_id as string) ?? null, zoneName: (r.zone_name as string) ?? null, zoneColor: (r.zone_color as string) ?? null, title: r.title as string, target: Number(r.target), current: Number(r.current), unit: r.unit as string, dueOn: (r.due_on as string) ?? null, note: (r.note as string) ?? null });
const GOAL_SQL = 'select g.*, z.name as zone_name, z.color as zone_color from goals g left join zones z on z.id = g.zone_id';
export const listGoals = async (db: Db, zoneId?: string): Promise<Goal[]> => (await db.query(`${GOAL_SQL} ${zoneId ? 'where g.zone_id = ?' : ''} order by g.created_at`, zoneId ? [zoneId] : [])).map(toGoal);
export async function addGoal(db: Db, i: { zone?: string; title: string; target: number; current?: number; unit?: string; dueOn?: string | null; note?: string }): Promise<Goal> {
  const title = i.title?.trim(); if (!title) throw new InputError('Name the goal.');
  const target = Number(i.target); if (!Number.isFinite(target) || target <= 0) throw new InputError('The target must be a number above zero.');
  const zone = i.zone ? await zoneByNameOrId(db, i.zone) : null; const gid = randomUUID();
  await db.run('insert into goals (id, zone_id, title, target, current, unit, due_on, note, created_at) values (?,?,?,?,?,?,?,?,?)', [gid, zone?.id ?? null, title.slice(0, 120), target, Number(i.current) || 0, (i.unit ?? '').slice(0, 16), i.dueOn || null, i.note?.trim() || null, now()]);
  return toGoal((await one(db, `${GOAL_SQL} where g.id = ?`, [gid]))!);
}
export async function updateGoal(db: Db, id: string, p: { title?: string; target?: number; current?: number; note?: string | null }): Promise<Goal> {
  const g = await one(db, `${GOAL_SQL} where g.id = ?`, [id]); if (!g) throw new InputError('That goal does not exist.');
  const cur = toGoal(g);
  await db.run('update goals set title = ?, target = ?, current = ?, note = ? where id = ?', [(p.title ?? cur.title).trim() || cur.title, p.target && p.target > 0 ? p.target : cur.target, p.current === undefined ? cur.current : Number(p.current) || 0, p.note === undefined ? cur.note : p.note?.trim() || null, id]);
  return toGoal((await one(db, `${GOAL_SQL} where g.id = ?`, [id]))!);
}
export const deleteGoal = async (db: Db, id: string) => { await db.run('delete from goals where id = ?', [id]); };

/* -------------------------------------------------------------------------------------------- revenue */
export interface RevenueRow { id: string; month: string; source: string; amount: number; note: string | null }
export const listRevenue = async (db: Db): Promise<RevenueRow[]> => (await db.query('select * from revenue order by month desc, source')).map((r) => ({ id: r.id as string, month: r.month as string, source: r.source as string, amount: Number(r.amount), note: (r.note as string) ?? null }));
export async function upsertRevenue(db: Db, i: { month: string; source: string; amount: number; note?: string }): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(i.month ?? '')) throw new InputError('Pick a month.');
  const source = i.source?.trim(); if (!source) throw new InputError('Say where the money came from (a product name).');
  const amount = Number(i.amount); if (!Number.isFinite(amount) || amount < 0) throw new InputError('The amount must be a number, zero or more.');
  await db.run('insert into revenue (id, month, source, amount, note) values (?,?,?,?,?) on conflict (month, source) do update set amount = excluded.amount, note = excluded.note',
    [randomUUID(), i.month, source.slice(0, 60), amount, i.note?.trim() || null]);
}
export const deleteRevenue = async (db: Db, id: string) => { await db.run('delete from revenue where id = ?', [id]); };
export function monthTotals(rows: RevenueRow[]): { month: string; total: number }[] {
  const m = new Map<string, number>(); for (const r of rows) m.set(r.month, (m.get(r.month) ?? 0) + r.amount);
  return [...m.entries()].map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month));
}

/* ----------------------------------------------------------------------------------------------- ideas */
/** Suggested kinds. A person can also type their own (a game, a newsletter...), so the stored kind is any short text. */
export const IDEA_KINDS = ['extension', 'saas', 'game', 'content', 'lever', 'other'] as const;
export const IDEA_STATUS = ['new', 'validating', 'building', 'parked', 'dropped'] as const;
export interface Idea { id: string; title: string; kind: string; pitch: string | null; moneyLogic: string | null; validateStep: string | null; status: (typeof IDEA_STATUS)[number]; score: number }
const toIdea = (r: Row): Idea => ({ id: r.id as string, title: r.title as string, kind: r.kind as string, pitch: (r.pitch as string) ?? null, moneyLogic: (r.money_logic as string) ?? null, validateStep: (r.validate_step as string) ?? null, status: r.status as Idea['status'], score: r.score as number });
export const listIdeas = async (db: Db): Promise<Idea[]> => (await db.query("select * from ideas order by case status when 'dropped' then 2 when 'parked' then 1 else 0 end, score desc, created_at desc")).map(toIdea);
export async function addIdea(db: Db, i: { title: string; kind?: string; pitch?: string; moneyLogic?: string; validateStep?: string; score?: number }): Promise<Idea> {
  const title = i.title?.trim(); if (!title) throw new InputError('Name the idea.');
  const iid = randomUUID();
  await db.run('insert into ideas (id, title, kind, pitch, money_logic, validate_step, score, created_at) values (?,?,?,?,?,?,?,?)',
    [iid, title.slice(0, 120), (i.kind ?? '').trim().slice(0, 24).toLowerCase() || 'extension', i.pitch?.trim() || null, i.moneyLogic?.trim() || null, i.validateStep?.trim() || null, clamp(i.score, 1, 5, 3), now()]);
  return toIdea((await one(db, 'select * from ideas where id = ?', [iid]))!);
}
export async function updateIdea(db: Db, id: string, p: { status?: string; score?: number; title?: string; pitch?: string | null }): Promise<Idea> {
  const r = await one(db, 'select * from ideas where id = ?', [id]); if (!r) throw new InputError('That idea does not exist.');
  const c = toIdea(r);
  await db.run('update ideas set status = ?, score = ?, title = ?, pitch = ? where id = ?', [(IDEA_STATUS as readonly string[]).includes(p.status ?? '') ? (p.status as string) : c.status, p.score === undefined ? c.score : clamp(p.score, 1, 5, c.score), (p.title ?? c.title).trim() || c.title, p.pitch === undefined ? c.pitch : p.pitch?.trim() || null, id]);
  return toIdea((await one(db, 'select * from ideas where id = ?', [id]))!);
}
export const deleteIdea = async (db: Db, id: string) => { await db.run('delete from ideas where id = ?', [id]); };

/* -------------------------------------------------------------------------------------------- routines */
export interface RoutineItem { id: string; zoneId: string | null; zoneName: string | null; zoneColor: string | null; title: string; minutes: number | null; money: number; days: string; doneToday: boolean }
export async function listRoutines(db: Db, day = todayStr()): Promise<RoutineItem[]> {
  const rows = await db.query('select r.*, z.name as zone_name, z.color as zone_color, (select 1 from routine_log l where l.routine_id = r.id and l.day = ?) as done from routines r left join zones z on z.id = r.zone_id where r.active = 1 order by r.sort, r.title', [day]);
  return rows.map((r) => ({ id: r.id as string, zoneId: (r.zone_id as string) ?? null, zoneName: (r.zone_name as string) ?? null, zoneColor: (r.zone_color as string) ?? null, title: r.title as string, minutes: (r.minutes as number) ?? null, money: r.money as number, days: r.days as string, doneToday: !!r.done }));
}
/** Does this routine run on that date? `days` is Monday..Sunday as seven 0/1 characters. */
export function runsOn(days: string, day: string): boolean { const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))); return days[(d.getDay() + 6) % 7] === '1'; }
export async function toggleRoutine(db: Db, id: string, day = todayStr()): Promise<boolean> {
  const had = await one(db, 'select 1 as x from routine_log where routine_id = ? and day = ?', [id, day]);
  if (had) { await db.run('delete from routine_log where routine_id = ? and day = ?', [id, day]); return false; }
  await db.run('insert into routine_log (routine_id, day) values (?,?)', [id, day]); return true;
}
export async function addRoutine(db: Db, i: { zone?: string; title: string; minutes?: number; money?: number; days?: string }): Promise<void> {
  const title = i.title?.trim(); if (!title) throw new InputError('Name the routine.');
  const zone = i.zone ? await zoneByNameOrId(db, i.zone) : null;
  const sort = Number((await one(db, 'select coalesce(max(sort), -1) + 1 as n from routines'))!.n);
  await db.run('insert into routines (id, zone_id, title, minutes, money, days, sort) values (?,?,?,?,?,?,?)', [randomUUID(), zone?.id ?? null, title.slice(0, 120), i.minutes ? clamp(i.minutes, 1, 600, 30) : null, clamp(i.money, 0, 3, 0), /^[01]{7}$/.test(i.days ?? '') ? (i.days as string) : '1111111', sort]);
}
export const deleteRoutine = async (db: Db, id: string) => { await db.run('update routines set active = 0 where id = ?', [id]); };
/** Days in a row, ending today or yesterday, on which at least one routine was done. */
export async function streak(db: Db, today = todayStr()): Promise<number> {
  const days = new Set((await db.query<{ day: string }>('select distinct day from routine_log')).map((r) => r.day));
  let n = 0; let d = today;
  if (!days.has(d)) d = addDaysLocal(d, -1);
  while (days.has(d)) { n++; d = addDaysLocal(d, -1); }
  return n;
}
function addDaysLocal(s: string, n: number): string { const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)) + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/* ------------------------------------------------------------------------------------ messages, settings */
export interface Message { id: string; role: 'user' | 'assistant'; content: string; proposals: { title: string; zone: string; when: When; money: number }[]; createdAt: string }
export const listMessages = async (db: Db, limit = 60): Promise<Message[]> =>
  (await db.query('select * from (select * from messages order by created_at desc limit ?) m order by created_at', [limit])).map((r) => ({ id: r.id as string, role: r.role as Message['role'], content: r.content as string, proposals: r.proposals ? JSON.parse(r.proposals as string) : [], createdAt: r.created_at as string }));
export async function addMessage(db: Db, role: Message['role'], content: string, proposals: Message['proposals'] = []): Promise<void> {
  await db.run('insert into messages (id, role, content, proposals, created_at) values (?,?,?,?,?)', [randomUUID(), role, content, proposals.length ? JSON.stringify(proposals) : null, now()]);
}
export const clearMessages = async (db: Db) => { await db.run('delete from messages'); };

export const getSetting = async (db: Db, key: string): Promise<string | null> => ((await one(db, 'select value from settings where key = ?', [key]))?.value as string | undefined) ?? null;
export const setSetting = async (db: Db, key: string, value: string) => { await db.run('insert into settings (key, value) values (?,?) on conflict (key) do update set value = excluded.value', [key, value]); };
export const deleteSetting = async (db: Db, key: string) => { await db.run('delete from settings where key = ?', [key]); };
export const revenueGoal = async (db: Db): Promise<number> => Number(await getSetting(db, 'revenue_goal')) || 1000;
export { monthOf };


/* -------------------------------------------------------------------------------------------- income & expenses */
export interface Entry { id: string; type: 'income' | 'expense'; category: string; amount: number; currency: 'USD' | 'INR'; onDate: string; note: string | null }
const toEntry = (r: Row): Entry => ({ id: r.id as string, type: r.type as Entry['type'], category: r.category as string, amount: Number(r.amount), currency: r.currency as Entry['currency'], onDate: r.on_date as string, note: (r.note as string) ?? null });
export const listEntries = async (db: Db): Promise<Entry[]> => (await db.query('select * from entries order by on_date desc, created_at desc')).map(toEntry);
export async function addEntry(db: Db, i: { type: string; category: string; amount: number; currency?: string; onDate: string; note?: string }): Promise<Entry> {
  if (i.type !== 'income' && i.type !== 'expense') throw new InputError('Choose income or expense.');
  const category = i.category?.trim().slice(0, 40); if (!category) throw new InputError('Add a category, like Salary or Hosting.');
  const amount = Number(i.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new InputError('The amount must be a number above zero.');
  const currency = i.currency === 'INR' ? 'INR' : 'USD';
  if (!validDate(i.onDate)) throw new InputError('Pick a valid date.');
  const id = randomUUID();
  await db.run('insert into entries (id, type, category, amount, currency, on_date, note, created_at) values (?,?,?,?,?,?,?,?)', [id, i.type, category, Math.round(amount * 100) / 100, currency, i.onDate, i.note?.trim().slice(0, 200) || null, now()]);
  return toEntry((await one(db, 'select * from entries where id = ?', [id]))!);
}
export const deleteEntry = async (db: Db, id: string) => { await db.run('delete from entries where id = ?', [id]); };
/** INR per 1 USD, set by the person. 88 until they change it; a guess, not a live rate. */
export const inrPerUsd = async (db: Db): Promise<number> => Number(await getSetting(db, 'inr_per_usd')) || 88;
