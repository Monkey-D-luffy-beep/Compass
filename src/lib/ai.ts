import { getPulse, pulseText } from './pulse';
import type { Db } from './pg';
import { bucketOf, BUCKET_LABEL, dayLabel, monthLabel, todayStr, weekEnd, type When } from './dates';
import { InputError } from './errors';
import { decrypt, encrypt } from './secrets';
import {
  addMessage, focusList, getSetting, listGoals, listIdeas, listMessages, listRevenue, listRoutines, listTasks, listZones, monthTotals, revenueGoal, runsOn,
  setSetting, deleteSetting, type Message,
} from './store';

/**
 * The assistant. It reads your brain file plus a fresh snapshot of your own data on every question, and answers through
 * Anthropic's Messages API (plain fetch, no SDK). It never changes anything itself: suggested tasks come back as buttons.
 */
export const MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-5-5'] as const;
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';

export const hasKey = async (db: Db): Promise<boolean> => !!process.env.ANTHROPIC_API_KEY || !!(await getSetting(db, 'anthropic_key'));
export async function saveKey(db: Db, key: Buffer, apiKey: string): Promise<void> {
  const k = apiKey.trim();
  if (!k) { await deleteSetting(db, 'anthropic_key'); return; }
  if (!/^sk-ant-/.test(k)) throw new InputError('That does not look like an Anthropic key. It starts with sk-ant-.');
  await setSetting(db, 'anthropic_key', encrypt(k, key));
}
async function readKey(db: Db, key: Buffer): Promise<string> {
  const env = process.env.ANTHROPIC_API_KEY; if (env) return env;
  const blob = await getSetting(db, 'anthropic_key'); if (!blob) throw new InputError('Add your Anthropic API key on the Settings page first.');
  return decrypt(blob, key);
}
export const currentModel = async (db: Db): Promise<string> => (await getSetting(db, 'model')) || DEFAULT_MODEL;

/* ------------------------------------------------------------------------------------------ the snapshot */
const stars = (n: number) => (n ? '$'.repeat(n) : 'no direct money');

/** Your data as plain text, small enough to send with every question. Pure apart from reading the database. */
export async function snapshot(db: Db, today = todayStr()): Promise<string> {
  const out: string[] = [];
  out.push(`TODAY: ${dayLabel(today)} (${today}). This week ends ${dayLabel(weekEnd(today))}.`);

  const revRows = await listRevenue(db); const rev = monthTotals(revRows); const goal = await revenueGoal(db);
  const latest = rev[rev.length - 1];
  out.push(`MONEY GOAL: $${goal} a month. ${latest ? `Latest month ${monthLabel(latest.month)}: $${latest.total}.` : 'No revenue logged yet.'}`);
  if (rev.length) out.push('Monthly totals: ' + rev.slice(-6).map((r) => `${monthLabel(r.month)} $${r.total}`).join(', '));
  const bySource = revRows.filter((r) => latest && r.month === latest.month);
  if (bySource.length > 1) out.push('Latest month by product: ' + bySource.map((r) => `${r.source} $${r.amount}`).join(', '));

  const zones = await listZones(db); const open = await listTasks(db, { status: 'open' });
  out.push('ZONES (open tasks): ' + zones.map((z) => `${z.name} ${open.filter((t) => t.zoneId === z.id).length}`).join(', '));

  const overdue = open.filter((t) => bucketOf(t.dueOn, today) === 'overdue');
  if (overdue.length) out.push('OVERDUE:\n' + overdue.map((t) => line(t, today)).join('\n'));
  out.push('OPEN TASKS (soonest first):\n' + (open.slice(0, 60).map((t) => line(t, today)).join('\n') || '(none)'));
  const doneRecent = (await listTasks(db, { status: 'done' })).filter((t) => t.doneAt && t.doneAt >= new Date(Date.now() - 7 * 86_400_000).toISOString()).slice(0, 15);
  out.push('DONE IN THE LAST 7 DAYS: ' + (doneRecent.length ? doneRecent.map((t) => `[${t.zoneName}] ${t.title}`).join('; ') : 'nothing logged'));

  const goals = await listGoals(db);
  if (goals.length) out.push('GOALS: ' + goals.map((g) => `${g.title} (${g.current}/${g.target} ${g.unit})`).join('; '));
  const routines = (await listRoutines(db, today)).filter((r) => runsOn(r.days, today));
  if (routines.length) out.push('ROUTINE TODAY: ' + routines.map((r) => `${r.doneToday ? '[done]' : '[not yet]'} ${r.title}`).join('; '));
  const ideas = (await listIdeas(db)).filter((i) => i.status === 'new' || i.status === 'validating');
  if (ideas.length) out.push('IDEAS NOT YET TESTED: ' + ideas.map((i) => `${i.title} (${i.kind}, score ${i.score}/5)`).join('; '));
  out.push('FOCUS BY THE APP\'S OWN SCORE: ' + (focusList(open, today, 3).map((t) => t.title).join(' | ') || 'nothing open'));
  return out.join('\n');
}
function line(t: { zoneName: string; title: string; dueOn: string | null; money: number; kind: string; effort: number | null; status: string }, today: string): string {
  const b = bucketOf(t.dueOn, today);
  return `- [${t.zoneName}] ${t.title} | ${BUCKET_LABEL[b]}${t.dueOn ? ` (${t.dueOn})` : ''} | ${stars(t.money)} | ${t.kind}${t.effort ? ` | ${t.effort} min` : ''}${t.status === 'doing' ? ' | in progress' : ''}`;
}

/* ------------------------------------------------------------------------------------------- the prompt */
export function systemPrompt(brain: string, snap: string): string {
  return [
    'You are Saurav\'s planning partner: an advisor and assistant, not a cheerleader. You can see his brain file and a live snapshot of his tasks, money and routine.',
    '',
    'How to answer:',
    '- Be blunt, specific and short. Lead with the answer. Use his real task titles and numbers from the snapshot.',
    '- Rank by money first (his goal is $1,000 a month). If the plan avoids the hard thing, say so.',
    '- For "what should I work on": give at most three things in order, the reason each earns or protects money, and what to drop or delay today.',
    '- Never invent a number, user count or result. If you do not know, say so and say how to find out.',
    '- New extension ideas are fine to suggest when asked, but say they are unproven and give the cheapest test first. Never make one today\'s priority over growth work unless he asks you to compare.',
    '- If you propose tasks he could add, finish your answer with ONE fenced block exactly like this (valid JSON, at most 5 items; zone must be one of his zone names; when is today, week, next, month or later; money is 0 to 3):',
    '```tasks',
    '[{"title":"...","zone":"Growth","when":"week","money":3}]',
    '```',
    'Otherwise do not include that block.',
    '',
    '=== BRAIN (what he told you about himself; treat as fact) ===',
    brain.trim() || '(empty)',
    '',
    '=== SNAPSHOT (live, from his Compass) ===',
    snap,
  ].join('\n');
}

export type Proposal = Message['proposals'][number];
/** Pulls the suggested tasks out of the answer and returns the text without that block. Pure. */
export function extractProposals(text: string, zoneNames: string[]): { text: string; proposals: Proposal[] } {
  const m = text.match(/```tasks\s*([\s\S]*?)```/i);
  if (!m) return { text: text.trim(), proposals: [] };
  const rest = (text.slice(0, m.index) + text.slice((m.index ?? 0) + m[0].length)).trim();
  let arr: unknown;
  try { arr = JSON.parse(m[1]); } catch { return { text: rest, proposals: [] }; }
  if (!Array.isArray(arr)) return { text: rest, proposals: [] };
  const whens: When[] = ['today', 'week', 'next', 'month', 'later'];
  const zones = zoneNames.map((z) => z.toLowerCase());
  const proposals: Proposal[] = [];
  for (const x of arr.slice(0, 5)) {
    const o = x as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 300) : '';
    const zi = zones.indexOf(String(o.zone ?? '').toLowerCase());
    if (!title || zi < 0) continue;
    proposals.push({ title, zone: zoneNames[zi], when: whens.includes(o.when as When) ? (o.when as When) : 'week', money: Math.min(3, Math.max(0, Math.round(Number(o.money) || 0))) });
  }
  return { text: rest, proposals };
}

/* ------------------------------------------------------------------------------------------- the call */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function callClaude(apiKey: string, model: string, system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens = 1800, f: FetchLike = fetch): Promise<string> {
  let res: Response;
  try {
    res = await f(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new InputError(e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'Claude took too long to answer. Try again.' : 'Could not reach Claude. Check your connection.');
  }
  if (!res.ok) {
    let detail = ''; try { const j = (await res.json()) as { error?: { message?: string } }; detail = j.error?.message ?? ''; } catch { /* not JSON */ }
    if (res.status === 401 || res.status === 403) throw new InputError(`Anthropic rejected the key${detail ? `: ${detail}` : '.'} Check it on the Settings page.`);
    if (res.status === 404) throw new InputError(`Anthropic does not know the model "${model}"${detail ? `: ${detail}` : '.'} Pick another on the Settings page.`);
    if (res.status === 429) throw new InputError(`Anthropic says you are out of credit or going too fast${detail ? `: ${detail}` : '.'}`);
    throw new InputError(`Anthropic answered with an error (${res.status})${detail ? `: ${detail}` : '.'}`);
  }
  const j = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const text = (j?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim();
  if (!text) throw new InputError('Claude sent back an empty answer. Try again.');
  return text;
}

/** One question in, one answer out; both are saved so the conversation carries on. */
export async function ask(db: Db, secretKey: Buffer, brain: string, question: string, f: FetchLike = fetch): Promise<Message[]> {
  const q = question.trim(); if (!q) throw new InputError('Ask something first.');
  const apiKey = await readKey(db, secretKey);
  const history = (await listMessages(db, 10)).map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();
  const system = systemPrompt(brain, (await snapshot(db)) + (await pulseBlock()));
  const answer = await callClaude(apiKey, await currentModel(db), system, [...history, { role: 'user', content: q }], 1800, f);
  const { text, proposals } = extractProposals(answer, (await listZones(db)).map((z) => z.name));
  await addMessage(db, 'user', q);
  await addMessage(db, 'assistant', text, proposals);
  return listMessages(db, 2);
}

/** The business pulse as extra snapshot text, or nothing when neither source is set up (or it fails: the answer must never depend on it). */
async function pulseBlock(): Promise<string> {
  try {
    const p = await getPulse();
    if (p.dodo.state === 'not-set-up' && p.nexora.state === 'not-set-up') return '';
    return '\n\n' + pulseText(p);
  } catch { return ''; }
}

export async function testKey(db: Db, secretKey: Buffer, f: FetchLike = fetch): Promise<string> {
  return callClaude(await readKey(db, secretKey), await currentModel(db), 'Reply with the single word: ready', [{ role: 'user', content: 'Are you there?' }], 20, f);
}

/* ------------------------------------------------------------------------------------------ new ideas */
export interface IdeaDraft { title: string; kind: 'extension' | 'lever' | 'content' | 'other'; pitch: string; moneyLogic: string; validateStep: string }

/** Pulls ideas out of a model answer. Pure: tolerates a code fence or chatter around the JSON, drops anything unusable and repeats of known titles. */
export function parseIdeas(text: string, known: string[] = []): IdeaDraft[] {
  const m = text.match(/\[[\s\S]*\]/); if (!m) return [];
  let arr: unknown; try { arr = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const kinds = ['extension', 'lever', 'content', 'other'];
  const seen = new Set(known.map((k) => k.trim().toLowerCase()));
  const out: IdeaDraft[] = [];
  for (const x of arr) {
    const o = x as Record<string, unknown>;
    const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const title = s(o.title, 120); if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    out.push({ title, kind: kinds.includes(o.kind as string) ? (o.kind as IdeaDraft['kind']) : 'extension', pitch: s(o.pitch, 400), moneyLogic: s(o.moneyLogic, 500), validateStep: s(o.validateStep, 400) });
    if (out.length === 5) break;
  }
  return out;
}

/** Asks for fresh ideas. Nothing is saved: the person keeps the ones they like. */
export async function generateIdeas(db: Db, secretKey: Buffer, brain: string, focus = '', f: FetchLike = fetch): Promise<IdeaDraft[]> {
  const apiKey = await readKey(db, secretKey);
  const known = (await listIdeas(db)).map((i) => i.title);
  const system = [
    'You suggest new products and revenue levers for one solo founder. Be concrete, sceptical and short.',
    'Rules:',
    '- Every idea is UNPROVEN. Never claim a market size, user count, price people pay or competitor weakness you cannot back; say what you would check instead.',
    '- His goal is $1,000 a month recurring. Prefer ideas that reuse what he already built (backend, billing, store listings, four live extensions) over starting from zero.',
    '- Mix: some new Chrome extensions that do NOT depend on one social platform, and some levers on the extensions he already has (pricing, email, listings, bundles).',
    '- "validateStep" must be the cheapest test he can run in a day or two BEFORE writing code.',
    '- Do not repeat anything in his existing list.',
    '',
    'Answer with ONLY a JSON array of exactly 5 objects, no other text:',
    '[{"title":"...","kind":"extension|lever|content|other","pitch":"what it is, one or two sentences","moneyLogic":"why it could earn, and what is not known","validateStep":"cheapest test first"}]',
    '',
    '=== BRAIN ===', brain.trim() || '(empty)',
    '',
    '=== SNAPSHOT ===', await snapshot(db),
    '',
    '=== IDEAS HE ALREADY HAS (do not repeat) ===', known.join('; ') || '(none)',
  ].join('\n');
  const ask = focus.trim() ? `Give me 5 new ideas. Focus: ${focus.trim().slice(0, 300)}` : 'Give me 5 new ideas.';
  const text = await callClaude(apiKey, await currentModel(db), system, [{ role: 'user', content: ask }], 2500, f);
  const ideas = parseIdeas(text, known);
  if (!ideas.length) throw new InputError('Claude did not return usable ideas. Try again.');
  return ideas;
}
