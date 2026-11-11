/** npx tsx --conditions react-server scripts/test-core.mts : the timeline maths, the store, the focus score and the assistant plumbing. */
import { openMemory } from '../src/lib/db';
import { addDays, bucketOf, dayLabel, dueFor, monthEnd, monthLabel, weekEnd, weekStart } from '../src/lib/dates';
import { decrypt, encrypt } from '../src/lib/secrets';
import { randomBytes } from 'node:crypto';

let failed = 0;
const ok = (n: string) => console.log('  PASS', n);
const eq = (n: string, got: unknown, want: unknown) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(n); else { failed++; console.log('  FAIL', n, '- got', JSON.stringify(got), 'want', JSON.stringify(want)); } };
const yes = (n: string, c: boolean, why = '') => { if (c) ok(n); else { failed++; console.log('  FAIL', n, why); } };

console.log('dates');
// Wednesday 2026-11-11
const T = '2026-11-11';
eq('week ends on Sunday', weekEnd(T), '2026-11-15');
eq('week starts on Monday', weekStart(T), '2026-11-09');
eq('Sunday belongs to its own week', weekEnd('2026-11-15'), '2026-11-15');
eq('Monday starts a new week', weekEnd('2026-11-16'), '2026-11-22');
eq('month end', monthEnd(T), '2026-11-30');
eq('month end in a leap year', monthEnd('2028-02-10'), '2028-02-29');
eq('yesterday is overdue', bucketOf('2026-11-10', T), 'overdue');
eq('today', bucketOf(T, T), 'today');
eq('Sunday is this week', bucketOf('2026-11-15', T), 'week');
eq('next Monday is next week', bucketOf('2026-11-16', T), 'next');
eq('the Sunday after is still next week', bucketOf('2026-11-22', T), 'next');
eq('later in the month', bucketOf('2026-11-30', T), 'month');
eq('next month is later', bucketOf('2026-12-01', T), 'later');
eq('no date is later', bucketOf(null, T), 'later');
eq('"today" maps to today', dueFor('today', T), T);
eq('"week" maps to Sunday', dueFor('week', T), '2026-11-15');
eq('"next" maps to the Sunday after', dueFor('next', T), '2026-11-22');
eq('"month" maps to month end', dueFor('month', T), '2026-11-30');
eq('"later" has no date', dueFor('later', T), null);
eq('"month" late in the month is the real month end, shown where it is due', [dueFor('month', '2026-11-26'), bucketOf(dueFor('month', '2026-11-26'), '2026-11-26')], ['2026-11-30', 'next']);
eq('every "when" lands in its own bucket early in the month', (['today', 'week', 'next', 'month'] as const).map((w) => bucketOf(dueFor(w, '2026-11-03'), '2026-11-03')), ['today', 'week', 'next', 'month']);
eq('addDays crosses a month', addDays('2026-11-30', 1), '2026-12-01');

console.log('labels');
eq('a day label', dayLabel('2026-11-10'), 'Tue 10 Nov');
eq('a month label', monthLabel('2026-12'), 'Dec 2026');

console.log('secrets');
const key = randomBytes(32);
eq('round trip', decrypt(encrypt('sk-ant-test', key), key), 'sk-ant-test');
yes('the ciphertext is not the key', !encrypt('sk-ant-test', key).includes('sk-ant'));
let wrong = false; try { decrypt(encrypt('x', key), randomBytes(32)); } catch { wrong = true; }
yes('a different key cannot read it', wrong);


console.log('store');
const store = await import('../src/lib/store');
const db = await openMemory();
const zones = await store.listZones(db);
yes('first run seeds the zones', zones.length === 5 && zones.some((z) => z.name === 'Growth'), zones.map((z) => z.name).join());
yes('first run seeds real tasks, ideas, routines and a goal', (await store.listTasks(db)).length >= 15 && (await store.listIdeas(db)).length >= 4 && (await store.listRoutines(db)).length >= 5 && (await store.listGoals(db)).length >= 2);
eq('revenue goal defaults to 1000', await store.revenueGoal(db), 1000);
const rev = store.monthTotals(await store.listRevenue(db));
eq('the seed has one revenue month of 300', rev.map((r) => r.total), [300]);
const again = await openMemory(); eq('seeding is repeatable on a fresh database', (await store.listZones(again)).length, 5);

const growth = zones.find((z) => z.name === 'Growth')!;
const t = await store.addTask(db, { zone: 'growth', title: 'Test task', when: 'week', money: 3 }, T);
eq('a task is added to the zone found by name', t.zoneName, 'Growth');
eq('"week" gives the Sunday', t.dueOn, '2026-11-15');
eq('money is kept', t.money, 3);
yes('a done task gets a timestamp', !!(await store.updateTask(db, t.id, { status: 'done' }, T)).doneAt);
eq('and loses it when reopened', (await store.updateTask(db, t.id, { status: 'todo' }, T)).doneAt, null);
eq('moving it changes the date', (await store.updateTask(db, t.id, { when: 'next' }, T)).dueOn, '2026-11-22');
const rejects = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch (e) { return (e as Error).name === 'InputError'; } };
yes('an unknown zone is a plain input error', await rejects(() => store.addTask(db, { zone: 'nonexistent', title: 'x' })));
yes('an empty title is refused', await rejects(() => store.addTask(db, { zone: 'growth', title: '   ' })));
eq('money is clamped to 3', (await store.addTask(db, { zone: growth.id, title: 'x', money: 99 }, T)).money, 3);

console.log('editing');
const ed = await store.updateTask(db, t.id, { title: 'Renamed', notes: 'a note', dueOn: '2026-12-24', zone: 'nexora', priority: 1, kind: 'growth', effort: 45, money: 2 }, T);
eq('every field of a task can be edited', [ed.title, ed.notes, ed.dueOn, ed.zoneName, ed.priority, ed.kind, ed.effort, ed.money], ['Renamed', 'a note', '2026-12-24', 'Nexora', 1, 'growth', 45, 2]);
eq('an exact date can be cleared', (await store.updateTask(db, t.id, { dueOn: null }, T)).dueOn, null);
yes('a bad date is refused', await rejects(() => store.updateTask(db, t.id, { dueOn: '2026-13-45' }, T)));
yes('an empty title is refused on edit', await rejects(() => store.updateTask(db, t.id, { title: '  ' }, T)));
yes('an unknown zone is refused on edit', await rejects(() => store.updateTask(db, t.id, { zone: 'nowhere' }, T)));
await store.deleteTask(db, t.id); eq('delete removes it', await store.getTask(db, t.id), null);

console.log('focus');
const base = { status: 'todo' as const, priority: 2 };
yes('direct revenue beats no revenue', store.focusScore({ ...base, money: 3, dueOn: null }, T) > store.focusScore({ ...base, money: 0, dueOn: null }, T));
yes('overdue beats later at the same money', store.focusScore({ ...base, money: 1, dueOn: '2026-11-01' }, T) > store.focusScore({ ...base, money: 1, dueOn: null }, T));
yes('a done task never ranks', store.focusScore({ ...base, status: 'done', money: 3, dueOn: T }, T) < 0);
yes('high priority beats low at the same money and date', store.focusScore({ status: 'todo', priority: 1, money: 1, dueOn: T }, T) > store.focusScore({ status: 'todo', priority: 3, money: 1, dueOn: T }, T));
const top = store.focusList(await store.listTasks(db, { status: 'open' }), todayDate(), 3);
yes('the seeded focus is led by something that earns money', top.length === 3 && top[0].money >= 2, JSON.stringify(top.map((x) => [x.title.slice(0, 30), x.money])));
function todayDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

console.log('revenue and goals');
await store.upsertRevenue(db, { month: '2026-12', source: 'ListLift', amount: 220 });
await store.upsertRevenue(db, { month: '2026-12', source: 'ListLift', amount: 250 });
await store.upsertRevenue(db, { month: '2026-12', source: 'GroupExporter', amount: 80 });
eq('saving the same product and month replaces it', (await store.listRevenue(db)).filter((r) => r.month === '2026-12').map((r) => [r.source, r.amount]).sort(), [['GroupExporter', 80], ['ListLift', 250]]);
eq('month totals add up', store.monthTotals(await store.listRevenue(db)).find((m) => m.month === '2026-12')?.total, 330);
yes('a bad month is refused', await rejects(() => store.upsertRevenue(db, { month: 'December', source: 'x', amount: 1 })));
yes('a negative amount is refused', await rejects(() => store.upsertRevenue(db, { month: '2026-12', source: 'x', amount: -5 })));
const goal = (await store.listGoals(db))[0];
eq('a goal\'s number can be updated', (await store.updateGoal(db, goal.id, { current: 450 })).current, 450);

console.log('ideas');
const idea = await store.addIdea(db, { title: 'Kept idea', kind: 'extension', pitch: 'p', moneyLogic: 'm', validateStep: 'v', score: 4 });
eq('an idea can be kept', [idea.title, idea.status, idea.score], ['Kept idea', 'new', 4]);
eq('and its status changed', (await store.updateIdea(db, idea.id, { status: 'validating' })).status, 'validating');
await store.deleteIdea(db, idea.id);
eq('and removed', (await store.listIdeas(db)).some((i) => i.id === idea.id), false);

console.log('routine');
const r = (await store.listRoutines(db, '2026-11-11'))[0];
eq('not done at first', r.doneToday, false);
eq('ticking marks it done', await store.toggleRoutine(db, r.id, '2026-11-11'), true);
eq('and it shows as done', (await store.listRoutines(db, '2026-11-11')).find((x) => x.id === r.id)?.doneToday, true);
eq('ticking again undoes it', await store.toggleRoutine(db, r.id, '2026-11-11'), false);
yes('a weekday routine does not run on Saturday', !store.runsOn('1111100', '2026-11-14') && store.runsOn('1111100', '2026-11-13'));
await store.toggleRoutine(db, r.id, '2026-11-09'); await store.toggleRoutine(db, r.id, '2026-11-10'); await store.toggleRoutine(db, r.id, '2026-11-11');
eq('three days in a row is a streak of three', await store.streak(db, '2026-11-11'), 3);
eq('a streak survives until the end of the day', await store.streak(db, '2026-11-12'), 3);
eq('and breaks after a missed day', await store.streak(db, '2026-11-13'), 0);

console.log('assistant plumbing');
const ai = await import('../src/lib/ai');
const snap = await ai.snapshot(db, '2026-11-11');
yes('the snapshot names the money goal', /MONEY GOAL: \$1000/.test(snap), snap.slice(0, 200));
yes('the snapshot lists open tasks with their zone and money', /\[Growth\].*\$\$\$/.test(snap));
yes('the snapshot says what the app would focus on', /FOCUS BY THE APP/.test(snap));
const sys = ai.systemPrompt('I am Saurav.', 'SNAP');
yes('the system prompt carries the brain and the snapshot', sys.includes('I am Saurav.') && sys.includes('SNAP'));
yes('it tells the model to put money first', /money first/i.test(sys));

const names = ['Growth', 'Nexora', 'Study'];
const good = ai.extractProposals('Do this.\n\n```tasks\n[{"title":"Rewrite the listing","zone":"growth","when":"week","money":3},{"title":"Nope","zone":"Nowhere","when":"today","money":1},{"title":"Study block","zone":"Study","when":"someday","money":9}]\n```\n', names);
eq('the answer text is kept without the block', good.text, 'Do this.');
eq('unknown zones are dropped', good.proposals.map((p) => p.title), ['Rewrite the listing', 'Study block']);
eq('the zone name is normalised', good.proposals[0].zone, 'Growth');
eq('an invalid "when" becomes this week and money is clamped', [good.proposals[1].when, good.proposals[1].money], ['week', 3]);
eq('broken JSON gives no proposals and keeps the text', ai.extractProposals('Hi\n```tasks\n{nope\n```', names), { text: 'Hi', proposals: [] });
eq('no block means no proposals', ai.extractProposals('Just text.', names), { text: 'Just text.', proposals: [] });

// the call, against a fake Anthropic
const calls: { url: string; init: RequestInit }[] = [];
const fake = (status: number, json: unknown) => (async (url: string, init?: RequestInit) => { calls.push({ url, init: init! }); return new Response(JSON.stringify(json), { status }); }) as never;
const out = await ai.callClaude('sk-ant-x', 'claude-sonnet-5-5', 'SYS', [{ role: 'user', content: 'hi' }], 100, fake(200, { content: [{ type: 'text', text: 'Hello' }] }));
eq('the answer text comes back', out, 'Hello');
eq('it calls Anthropic\'s Messages API', calls[0].url, 'https://api.anthropic.com/v1/messages');
const sent = JSON.parse(String(calls[0].init.body));
eq('with the model, the system prompt and the messages', [sent.model, sent.system, sent.messages], ['claude-sonnet-5-5', 'SYS', [{ role: 'user', content: 'hi' }]]);
eq('the key travels in the header, not the body', [(calls[0].init.headers as Record<string, string>)['x-api-key'], String(calls[0].init.body).includes('sk-ant-x')], ['sk-ant-x', false]);
async function failsWith(status: number, re: RegExp) { try { await ai.callClaude('k', 'm', 's', [{ role: 'user', content: 'x' }], 10, fake(status, { error: { message: 'detail' } })); return false; } catch (e) { return (e as Error).name === 'InputError' && re.test((e as Error).message) && !(e as Error).message.includes('"k"'); } }
yes('a rejected key says so', await failsWith(401, /rejected the key/));
yes('an unknown model says so', await failsWith(404, /does not know the model/));
yes('a rate limit says so', await failsWith(429, /credit or going too fast/));

// a whole question: saved, with history, proposals stored
const db2 = await openMemory(); const k2 = randomBytes(32);
await ai.saveKey(db2, k2, 'sk-ant-saved');
yes('a saved key is encrypted in the database', !String(await store.getSetting(db2, 'anthropic_key')).includes('sk-ant-saved'));
yes('something that is not an Anthropic key is refused', await rejects(() => ai.saveKey(db2, k2, 'not-a-key')));
const seen: { system: string; messages: { role: string }[] }[] = [];
const reply = (async (_u: string, init?: RequestInit) => { seen.push(JSON.parse(String(init!.body))); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Start with the store listing.\n```tasks\n[{"title":"Write the listing","zone":"Growth","when":"today","money":3}]\n```' }] }), { status: 200 }); }) as never;
const got = await ai.ask(db2, k2, 'BRAIN TEXT', 'What first?', reply);
eq('both sides of the exchange are saved', got.map((m) => m.role), ['user', 'assistant']);
eq('the suggested task is stored with the answer', (await store.listMessages(db2)).at(-1)?.proposals.map((p) => p.title), ['Write the listing']);
yes('the brain and the live snapshot reach the model', seen[0].system.includes('BRAIN TEXT') && /MONEY GOAL/.test(seen[0].system));
await ai.ask(db2, k2, 'B', 'And then?', reply);
eq('the second question carries the first exchange as history', seen[1].messages.map((m) => m.role), ['user', 'assistant', 'user']);
let noKey = false; try { await ai.ask(await openMemory(), k2, 'B', 'hi', reply); } catch (e) { noKey = /API key/.test((e as Error).message); }
yes('without a key it tells you where to add one', noKey);

console.log('new ideas');
const known = ['Kept idea'];
const raw = 'Sure! Here you go:\n```json\n[{"title":"Container tracker","kind":"extension","pitch":"p","moneyLogic":"m","validateStep":"v"},{"title":"kept idea","kind":"extension"},{"title":"","kind":"lever"},{"title":"Bundle","kind":"weird","pitch":"x"}]\n```';
const parsed = ai.parseIdeas(raw, known);
eq('ideas are pulled out of chatter and a code fence', parsed.map((i) => i.title), ['Container tracker', 'Bundle']);
eq('an idea he already has is not suggested again', parsed.some((i) => i.title.toLowerCase() === 'kept idea'), false);
eq('an unknown kind becomes extension', parsed[1].kind, 'extension');
eq('no JSON gives nothing', ai.parseIdeas('I cannot do that', []), []);
eq('broken JSON gives nothing', ai.parseIdeas('[{"title": ', []), []);
const gdb = await openMemory(); const gk = randomBytes(32); await ai.saveKey(gdb, gk, 'sk-ant-gen');
const genReply = (async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify([1, 2, 3, 4, 5, 6].map((n) => ({ title: 'Idea ' + n, kind: 'lever', pitch: 'p', moneyLogic: 'm', validateStep: 'v' }))) }] }), { status: 200 })) as never;
const gen = await ai.generateIdeas(gdb, gk, 'BRAIN', 'freight', genReply);
eq('at most five come back and none are saved until kept', [gen.length, (await store.listIdeas(gdb)).some((i) => i.title === 'Idea 1')], [5, false]);

console.log('login');
const auth = await import('../src/lib/auth');
const tok = await auth.makeSession('pw', 1_000);
yes('a fresh session is accepted', await auth.checkSession(tok, 'pw', 2_000));
yes('another password is rejected', !(await auth.checkSession(tok, 'other', 2_000)));
yes('an expired session is rejected', !(await auth.checkSession(tok, 'pw', 1_000 + 31 * 86_400_000)));
yes('a tampered expiry is rejected', !(await auth.checkSession(`99999999999999.${tok.split('.')[1]}`, 'pw', 2_000)));
yes('garbage and nothing are rejected', !(await auth.checkSession('abc', 'pw')) && !(await auth.checkSession(undefined, 'pw')));
yes('same() compares exactly', auth.same('abc', 'abc') && !auth.same('abc', 'abd') && !auth.same('abc', 'abcd'));

console.log('pulse');
const pulse = await import('../src/lib/pulse');
const NOW = Date.parse('2026-11-10T12:00:00Z'); const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const pays = [
  { payment_id: 'a', created_at: ago(1), status: 'succeeded', total_amount: 499, currency: 'USD', customer: { customer_id: 'c1' }, metadata: { product: 'listlift' } },
  { payment_id: 'b', created_at: ago(2), status: 'succeeded', total_amount: 199, currency: 'USD', customer: { customer_id: 'c2' }, metadata: { product: 'listlift' } },
  { payment_id: 'c', created_at: ago(3), status: 'failed', total_amount: 499, currency: 'USD', customer: { customer_id: 'c3' } },
  { payment_id: 'd', created_at: ago(9), status: 'succeeded', total_amount: 499, currency: 'USD', customer: { customer_id: 'c1' } },
  { payment_id: 'e', created_at: ago(10), status: 'succeeded', total_amount: 29900, currency: 'INR', customer: { customer_id: 'c4' } },
  { payment_id: 'f', created_at: ago(20), status: 'succeeded', total_amount: 499, currency: 'USD', customer: { customer_id: 'c2' } },
];
const sum = pulse.summariseDodo(pays, [{ status: 'active' }, { status: 'active', cancel_at_next_billing_date: true }, { status: 'cancelled' }], NOW);
eq('this-week USD revenue counts only succeeded payments', sum.revenue.find((r) => r.currency === 'USD')?.thisWeek, 6.98);
eq('last-week USD revenue', sum.revenue.find((r) => r.currency === 'USD')?.lastWeek, 4.99);
eq('INR is kept separate and in major units', sum.revenue.find((r) => r.currency === 'INR')?.lastWeek, 299);
eq('a customer who paid earlier is not new', [sum.newCustomersThisWeek, sum.newCustomersLastWeek], [0, 2]);
eq('failed payments this week', sum.failedThisWeek, 1);
eq('subscriptions: active and ending', [sum.activeSubscriptions, sum.cancellingSubscriptions], [2, 1]);
eq('products this week', sum.byProductThisWeek, [{ product: 'listlift', payments: 2 }]);
const none = await pulse.fetchDodo({}, (async () => { throw new Error('no network expected'); }) as never, NOW);
eq('Dodo with no key is "not set up" and makes no request', none.state, 'not-set-up');
const dodoCalls: string[] = [];
const fakeDodo = (async (url: string, init?: RequestInit) => { dodoCalls.push(url + '|' + (init?.headers as Record<string, string>).Authorization); return new Response(JSON.stringify({ items: url.includes('/payments') ? pays : [{ status: 'active' }] }), { status: 200 }); }) as never;
const live = await pulse.fetchDodo({ DODO_API_KEY: 'k', DODO_ENV: 'live' }, fakeDodo, NOW);
yes('Dodo ready, sends the bearer key to the live host, only GETs', live.state === 'ready' && dodoCalls.every((s) => s.startsWith('https://live.dodopayments.com/') && s.endsWith('|Bearer k')), dodoCalls.join(','));
const bad = await pulse.fetchDodo({ DODO_API_KEY: 'k' }, (async () => new Response('', { status: 401 })) as never, NOW);
yes('a refused key says so in plain words', bad.state === 'error' && /refused the key/.test(bad.why));
eq('Nexora with no url is "not set up"', (await pulse.fetchNexora({}, (async () => { throw new Error('x'); }) as never)).state, 'not-set-up');
const nx = { ok: true, generatedAt: 'x', signups: { thisWeek: 9, lastWeek: 6 }, uninstalls: { thisWeek: 4, lastWeek: 5, byProductThisWeek: {}, reasonsThisWeek: ['too slow'] }, usage: { thisWeek: { listlift: { events: 50, items: 900, users: 20 } }, lastWeek: {} }, entitledNow: { total: 80, byProduct: { listlift: 60 }, expiringIn7Days: 12 } };
const nxr = await pulse.fetchNexora({ NEXORA_PULSE_URL: 'https://x/api/pulse', NEXORA_PULSE_TOKEN: 't' }, (async (_u: string, i?: RequestInit) => { yes('Nexora sends the bearer token', (i?.headers as Record<string, string>).Authorization === 'Bearer t'); return new Response(JSON.stringify(nx), { status: 200 }); }) as never);
eq('Nexora feed parsed', nxr.state, 'ready');
const txt = pulse.pulseText({ generatedAt: 'x', dodo: live, nexora: nxr });
yes('pulse text carries the real numbers', /Active subscriptions/.test(txt) && /Signups[^\n]*: 9 vs 6/.test(txt) && /12 run out/.test(txt), txt);
const txt2 = pulse.pulseText({ generatedAt: 'x', dodo: { state: 'not-set-up', why: 'no key' }, nexora: { state: 'error', why: 'down' } });
yes('missing sources tell the assistant not to invent numbers', /Do not state any revenue/.test(txt2) && /Do not state any signup/.test(txt2));

console.log('archive');
const adb = await openMemory();
const az = await store.addZone(adb, { name: 'Arch Test', kind: 'project' });
const a1 = await store.addTask(adb, { title: 'one', zone: az.id }); const a2 = await store.addTask(adb, { title: 'two', zone: az.id }); await store.addTask(adb, { title: 'three', zone: az.id });
await store.updateTask(adb, a1.id, { status: 'done' }); await store.updateTask(adb, a2.id, { status: 'done' });
eq('archive-done only touches finished tasks of that project', [await store.archiveDone(adb, az.id), (await store.listTasks(adb, { zoneId: az.id, archived: false })).map((t) => t.title)], [2, ['three']]);
eq('archived tasks are listed on their own and keep their done state', (await store.listTasks(adb, { zoneId: az.id, archived: true })).map((t) => [t.title, t.status]).sort(), [['one', 'done'], ['two', 'done']]);
await store.updateTask(adb, a1.id, { archived: false });
eq('a task can be restored', (await store.listTasks(adb, { zoneId: az.id, archived: false })).map((t) => t.title).sort(), ['one', 'three']);
eq('archiving twice does nothing new', await store.archiveDone(adb, az.id), 1);
eq('a renamed project keeps its tasks', [(await store.updateZone(adb, az.id, { name: 'Renamed' })).name, (await store.listTasks(adb, { zoneId: az.id })).length], ['Renamed', 3]);

console.log('auto-archive');
const odb = await openMemory();
const oz = await store.addZone(odb, { name: 'Old Done' });
const o1 = await store.addTask(odb, { title: 'finished long ago', zone: oz.id }); const o2 = await store.addTask(odb, { title: 'finished today', zone: oz.id }); const o3 = await store.addTask(odb, { title: 'still planned', zone: oz.id });
await store.updateTask(odb, o1.id, { status: 'done' }); await store.updateTask(odb, o2.id, { status: 'done' });
await odb.run('update tasks set done_at = ? where id = ?', [new Date(Date.now() - 9 * 86_400_000).toISOString(), o1.id]);
eq('only done work older than a week is archived', [await store.archiveOldDone(odb, 7), (await store.listTasks(odb, { zoneId: oz.id, archived: false })).map((t) => t.title).sort()], [1, ['finished today', 'still planned']]);
eq('running it again archives nothing more', await store.archiveOldDone(odb, 7), 0);
void o3;

console.log('finance and ideas');
const fin = await import('../src/lib/finance');
const fdb = await openMemory();
await store.addEntry(fdb, { type: 'income', category: 'Salary', amount: 88000, currency: 'INR', onDate: '2026-11-01' });
await store.addEntry(fdb, { type: 'expense', category: 'Hosting', amount: 880, currency: 'INR', onDate: '2026-11-03' });
await store.addEntry(fdb, { type: 'expense', category: 'Ads', amount: 20, currency: 'USD', onDate: '2026-11-05' });
await store.addEntry(fdb, { type: 'expense', category: 'Domain', amount: 12, currency: 'USD', onDate: '2026-10-09' });
const fe = await store.listEntries(fdb);
const fr = fin.monthlyFinance([
  { id: 'p1', date: '2026-11-04', amount: 22501, fee: 500, currency: 'USD', status: 'success' },
  { id: 'p2', date: '2026-10-19', amount: 11115, fee: 500, currency: 'USD', status: 'success' },
  { id: 'p3', date: '2026-10-20', amount: 99999, fee: 500, currency: 'USD', status: 'failed' },
  { id: 'p4', date: '2026-10-21', amount: 5000, fee: 100, currency: 'EUR', status: 'success' },
], fe, 88, '2026-11');
const nov = fr.rows.find((r) => r.month === '2026-11')!; const oct = fr.rows.find((r) => r.month === '2026-10')!;
eq('November: payout 225.01 + salary 1000 (88000 INR at 88) - hosting 10 - ads 20 - 5 fee', nov.profit, 1190.01);
eq('November expense categories, biggest first', nov.byCategory, [{ category: 'Ads', usd: 20 }, { category: 'Hosting', usd: 10 }]);
eq('October: payout 111.15 - domain 12 - 5 fee; the failed payout is ignored', oct.profit, 94.15);
eq('a payout in another currency is skipped and counted', fr.skippedPayouts, 1);
eq('totals add the months', fr.totals.profit, 1284.16);
eq('rows are newest month first', fr.rows.map((r) => r.month), ['2026-11', '2026-10']);
eq('the current month shows even with no data', fin.monthlyFinance([], [], 88, '2026-12').rows.map((r) => r.month), ['2026-12']);
let negErr = ''; try { await store.addEntry(fdb, { type: 'expense', category: 'X', amount: -5, onDate: '2026-11-01' }); } catch (e) { negErr = (e as Error).message; }
eq('a negative amount is refused in plain words', negErr, 'The amount must be a number above zero.');
await store.deleteEntry(fdb, fe[0].id);
eq('an entry can be deleted', (await store.listEntries(fdb)).length, 3);
const gi = await store.addIdea(fdb, { title: 'Pocket quiz', kind: '  Mobile Game ' });
const si = await store.addIdea(fdb, { title: 'Invoice tool', kind: 'saas' });
eq('an idea can have a kind you wrote yourself, and SaaS is a built-in one', [gi.kind, si.kind], ['mobile game', 'saas']);

console.log('settled revenue and overview');
const settle = new Map([['a', { currency: 'USD', net: 242 - 37 }], ['b', { currency: 'USD', net: 199 }], ['e', { currency: 'USD', net: 300 }]]);
const sum2 = pulse.summariseDodo(pays, null, NOW, 28, false, settle);
eq('settled USD this week is net of tax, in dollars', sum2.settled.find((r) => r.currency === 'USD')?.thisWeek, 4.04);
eq('settled USD last week', sum2.settled.find((r) => r.currency === 'USD')?.lastWeek, 3);
eq('succeeded payments with no settlement detail are counted, not guessed', sum2.settledMissing, 1);
yes('the assistant text states settled USD, not per-currency noise', /settled revenue \(USD.*\$4\.04/.test(pulse.pulseText({ generatedAt: 'x', dodo: { state: 'ready', data: sum2 }, nexora: { state: 'not-set-up', why: 'x' } })));
const ov = await import('../src/lib/overview');
const ovZ = (id: string): never => ({ id, name: id, kind: 'project', color: '#fff', note: null, sort: 0, archived: false }) as never;
const ovT = (id: string, zone: string, over: object): never => ({ id, zoneId: zone, zoneName: zone, zoneColor: '#fff', title: id, notes: null, status: 'todo', dueOn: null, priority: 2, money: 0, kind: 'build', effort: null, createdAt: '2026-01-01T00:00:00.000Z', doneAt: null, ...over }) as never;
const o = ov.buildOverview([ovZ('A'), ovZ('B')], [
  ovT('t1', 'A', { status: 'done', doneAt: '2026-11-10T08:00:00.000Z' }),
  ovT('t2', 'A', { dueOn: '2026-11-08' }),
  ovT('t3', 'B', { dueOn: '2026-11-12', money: 3 }),
  ovT('t4', 'B', { status: 'done', doneAt: '2026-10-01T08:00:00.000Z' }),
], '2026-11-10');
eq('overview totals', o.totals, { open: 2, overdue: 1, doneWeek: 1, addedWeek: 0, doneToday: 1 });
eq('stalled = open work, nothing finished in 14 days', o.stalled.map((s) => s.zone.id), ['B']);
eq('wins grouped by day', o.wins.map((w) => [w.day, w.tasks.length]), [['2026-11-10', 1]]);
eq('coming up is soonest first', o.comingUp.map((t) => t.id), ['t2', 't3']);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
