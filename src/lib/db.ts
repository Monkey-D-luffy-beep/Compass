import { randomUUID } from 'node:crypto';
import { dueFor, monthOf, todayStr, type When } from './dates';
import { openPglite, openPostgres, type Db } from './pg';

/** Dates are plain "YYYY-MM-DD" strings in the person's own calendar; created/done stamps are UTC ISO strings. */
const MIGRATIONS: string[] = [
  `
  create table zones (
    id       text primary key,
    name     text not null,
    kind     text not null check (kind in ('project','growth','study','goal')),
    color    text not null,
    note     text,
    sort     integer not null default 0,
    archived integer not null default 0
  );
  create table tasks (
    id         text primary key,
    zone_id    text not null references zones(id) on delete cascade,
    title      text not null,
    notes      text,
    status     text not null default 'todo' check (status in ('todo','doing','done')),
    due_on     text,
    priority   integer not null default 2,
    money      integer not null default 0,
    kind       text not null default 'build' check (kind in ('build','growth','maintenance','study','admin')),
    effort     integer,
    created_at text not null,
    done_at    text
  );
  create index tasks_open on tasks (status, due_on);
  create table goals (
    id       text primary key,
    zone_id  text references zones(id) on delete set null,
    title    text not null,
    target   double precision not null,
    current  double precision not null default 0,
    unit     text not null default '',
    due_on   text,
    note     text,
    created_at text not null
  );
  create table revenue (
    id     text primary key,
    month  text not null,
    source text not null,
    amount double precision not null,
    note   text,
    unique (month, source)
  );
  create table ideas (
    id            text primary key,
    title         text not null,
    kind          text not null default 'extension' check (kind in ('extension','lever','content','other')),
    pitch         text,
    money_logic   text,
    validate_step text,
    status        text not null default 'new' check (status in ('new','validating','building','parked','dropped')),
    score         integer not null default 3,
    created_at    text not null
  );
  create table routines (
    id      text primary key,
    zone_id text references zones(id) on delete set null,
    title   text not null,
    minutes integer,
    money   integer not null default 0,
    days    text not null default '1111111',
    sort    integer not null default 0,
    active  integer not null default 1
  );
  create table routine_log (
    routine_id text not null references routines(id) on delete cascade,
    day        text not null,
    primary key (routine_id, day)
  );
  create table messages (
    id         text primary key,
    role       text not null check (role in ('user','assistant')),
    content    text not null,
    proposals  text,
    created_at text not null
  );
  create table settings (key text primary key, value text not null);
  `,
];

/** Brings the database up to date and seeds it on first run. */
export async function prepare(db: Db): Promise<Db> {
  await db.exec('create table if not exists schema_version (v integer not null)');
  const cur = (await db.query<{ v: number }>('select max(v) as v from schema_version'))[0]?.v ?? 0;
  for (let i = Number(cur); i < MIGRATIONS.length; i++) {
    await db.tx(async (t) => { await t.exec(MIGRATIONS[i]); await t.run('insert into schema_version (v) values (?)', [i + 1]); });
  }
  await seed(db);
  return db;
}

/** A throwaway in-memory database, for tests. */
export async function openMemory(): Promise<Db> { return prepare(await openPglite()); }

/** Hosted: DATABASE_URL. Otherwise a Postgres that lives in a folder on this computer. */
export async function openDefault(localDir: string): Promise<Db> {
  const url = process.env.DATABASE_URL;
  return prepare(url ? await openPostgres(url) : await openPglite(localDir));
}

const id = () => randomUUID();

/**
 * First run only: your real situation as of 2026-11-10, taken from the central CLAUDE.md. Replace anything that is wrong;
 * nothing here is a measured fact except the numbers you stated yourself.
 */
async function seed(db: Db): Promise<void> {
  if ((await db.query("select 1 as x from settings where key = 'seeded'")).length) return;
  const today = todayStr();
  const now = new Date().toISOString();

  const zone = async (name: string, kind: string, color: string, note: string, sort: number) => {
    const zid = id();
    await db.run('insert into zones (id, name, kind, color, note, sort) values (?,?,?,?,?,?)', [zid, name, kind, color, note, sort]);
    return zid;
  };
  const Z = {
    growth: await zone('Growth', 'growth', '#f5a524', 'Getting new people to the four live extensions. This is the money problem.', 0),
    nexora: await zone('Nexora', 'project', '#6ea8ff', 'ListLift, GroupExporter, SafePace, Telegram Group Exporter, The Side Quest.', 1),
    club: await zone('Extension Club', 'project', '#b794f6', 'Directory for extension makers. A traffic and link asset, not the income plan.', 2),
    study: await zone('Study', 'study', '#4fd1c5', 'IIIT-B ML/AI diploma. Protect the blocks.', 3),
    money: await zone('Money & Goals', 'goal', '#4ade80', '$1,000 a month recurring is the number that is enough.', 4),
  };

  const task = (zoneId: string, title: string, when: When, money: number, kind: string, priority = 2, effort: number | null = null) =>
    db.run('insert into tasks (id, zone_id, title, due_on, priority, money, kind, effort, created_at) values (?,?,?,?,?,?,?,?,?)', [id(), zoneId, title, dueFor(when, today), priority, money, kind, effort, now]);

  // Growth: the only real money problem (measured 2026-09-29: new people stopped arriving; product and retention are fine).
  await task(Z.growth, 'Rewrite the Chrome Web Store listing for ListLift: query-first title, the benefit in line one, fresh screenshots. The store is the channel.', 'week', 3, 'growth', 1, 120);
  await task(Z.growth, 'Win-back email to lapsed pass and plan holders (they already paid once)', 'week', 3, 'growth', 1, 90);
  await task(Z.growth, 'Write the first SafePace blog post (how to send bulk WhatsApp messages without a ban). SafePace has none.', 'next', 2, 'growth', 2, 120);
  await task(Z.growth, 'Submit SafePace to AlternativeTo.net (free, about 20 minutes)', 'week', 1, 'growth', 2, 20);
  await task(Z.growth, 'Post on X once a day: one real, useful thing with a real number', 'today', 1, 'growth', 2, 20);
  // Nexora
  await task(Z.nexora, 'Upload SafePace v0.7.3 to the Chrome Web Store once the PDF send test passes', 'today', 2, 'maintenance', 1, 30);
  await task(Z.nexora, 'Renewal nudges before a pass or plan lapses (median entitlement left is 13 days and nothing is sent before it ends)', 'week', 3, 'build', 1, 180);
  await task(Z.nexora, 'Let pass holders upgrade to monthly (the buy button disappears once you are Pro)', 'next', 2, 'build', 2, 120);
  await task(Z.nexora, 'Fix /admin: 189 rows say active but only 123 really are (add cancel_at_period_end)', 'next', 1, 'maintenance', 3, 90);
  await task(Z.nexora, 'Find out why scroll capture is only 3.5% of ListLift exports although it is the default', 'month', 1, 'maintenance', 3, 60);
  // Extension Club
  await task(Z.club, 'Create the saurav@extensionclub.com mailbox (replies and the privacy page point to it)', 'today', 0, 'admin', 1, 15);
  await task(Z.club, 'Verify the badge on the ListLift and The Side Quest pages (press Verify in each dashboard)', 'today', 1, 'admin', 2, 10);
  await task(Z.club, 'Send the first 5 maker emails from batch 1, by hand', 'week', 1, 'growth', 2, 40);
  await task(Z.club, 'Decide the Product Hunt launch day (copy and images are ready)', 'next', 1, 'growth', 3, 20);
  await task(Z.club, 'Review the two-week test: makers with a verified badge. Stop rule: fewer than 10 means park it.', 'month', 1, 'admin', 2, 30);
  // Study
  await task(Z.study, 'Plan this week\'s study: three blocks of 90 minutes, same hours each day', 'today', 0, 'study', 2, 15);
  // Money & goals
  await task(Z.money, 'Enter this month\'s revenue per product in Compass (Money page)', 'today', 0, 'admin', 2, 15);
  await task(Z.money, 'Sunday review: what earned money this week and what did not? (20 minutes)', 'week', 0, 'admin', 2, 20);

  await db.run('insert into goals (id, zone_id, title, target, current, unit, due_on, note, created_at) values (?,?,?,?,?,?,?,?,?)',
    [id(), Z.money, 'Reach $1,000 a month recurring', 1000, 300, '$/mo', null, 'You said you are at about $300. Update the number on the Money page.', now]);
  await db.run('insert into goals (id, zone_id, title, target, current, unit, due_on, note, created_at) values (?,?,?,?,?,?,?,?,?)',
    [id(), Z.club, 'Extension Club: 10 makers with a verified badge (not you)', 10, 0, 'makers', null, 'Two-week test, then decide.', now]);

  await db.run('insert into revenue (id, month, source, amount, note) values (?,?,?,?,?)',
    [id(), monthOf(today), 'All products', 300, 'Your own figure when Compass was set up. Replace with one row per product.']);

  const routine = (zoneId: string | null, title: string, minutes: number, money: number, days: string, sort: number) =>
    db.run('insert into routines (id, zone_id, title, minutes, money, days, sort) values (?,?,?,?,?,?,?)', [id(), zoneId, title, minutes, money, days, sort]);
  await routine(Z.growth, 'Money block: 90 minutes on the one thing that brings new paying people', 90, 3, '1111100', 0);
  await routine(Z.growth, 'One post on X', 20, 1, '1111111', 1);
  await routine(Z.nexora, 'Answer every customer email', 15, 2, '1111100', 2);
  await routine(Z.nexora, 'Look at /admin: signups, passes, revenue', 10, 1, '1111100', 3);
  await routine(Z.club, 'Five maker emails, by hand', 25, 1, '1111100', 4);
  await routine(Z.study, 'Study block', 60, 0, '1111111', 5);

  const idea = (title: string, kind: string, pitch: string, money: string, validate: string, score: number) =>
    db.run('insert into ideas (id, title, kind, pitch, money_logic, validate_step, score, created_at) values (?,?,?,?,?,?,?,?)', [id(), title, kind, pitch, money, validate, score, now]);
  await idea('Win-back email for lapsed passes and plans', 'lever',
    'Email people whose pass or plan just ended, with a one-click way to buy again.',
    'About 119 of 123 entitlements expire within 30 days, and people who already paid once convert best. No new product, about a day of work.',
    'Send it by hand to the last 30 lapsed buyers and count how many return.', 5);
  await idea('Annual plan for ListLift and GroupExporter', 'lever',
    'Add a yearly price next to the 7-day pass and monthly.',
    'A yearly payment lifts the money per customer and removes the monthly drop-off. It reuses what you built.',
    'Show it to new buyers for two weeks and see if anyone picks it.', 4);
  await idea('Freight and logistics data extension', 'extension',
    'A Chrome extension for freight forwarders: pull container, bill of lading or shipment details from carrier and portal pages into Excel, or combine tracking across carriers.',
    'Business users pay more per seat, you know the work from Tiger Logistics, and it does not depend on one social platform. Unproven.',
    'Ask five people at forwarders which portal they copy data from by hand. Check search demand ("container tracking excel") before writing code.', 4);
  await idea('One Nexora pass across all four tools', 'lever',
    'A single price that unlocks ListLift, GroupExporter, SafePace and the Telegram exporter.',
    'Raises what each customer pays and gives every product a reason to mention the others.',
    'Offer it by email to current buyers of any one product.', 3);
  await idea('Marketplace seller data exporter', 'extension',
    'Export product and review data for sellers on large marketplaces to Excel.',
    'Sellers pay for research data, but the market is crowded and these sites restrict automated access, so the risk is high. Unproven.',
    'Read the competitors\' reviews for what they do badly before deciding anything.', 2);

  await db.run("insert into settings (key, value) values ('revenue_goal', '1000'), ('model', 'claude-sonnet-5-5'), ('seeded', ?)", [now]);
}
