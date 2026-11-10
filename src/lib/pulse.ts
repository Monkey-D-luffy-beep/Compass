/**
 * Business pulse: what changed in the last 7 days against the 7 before, from two READ-ONLY sources.
 *   - Dodo Payments (money, new customers, failed payments): the source of truth for revenue.
 *   - The Nexora backend /api/pulse (signups, uninstalls, usage, paying-now counts): same numbers as /admin.
 * Nothing here writes anywhere. Each source can be missing or fail on its own; the other still shows.
 * Env: DODO_API_KEY (read-only key), DODO_ENV (live|test), NEXORA_PULSE_URL, NEXORA_PULSE_TOKEN.
 */
import type { FetchLike } from './ai';

const DAY = 86_400_000;

export type Part<T> = { state: 'ready'; data: T } | { state: 'not-set-up'; why: string } | { state: 'error'; why: string };

export interface CurrencyWeek { currency: string; thisWeek: number; lastWeek: number; paymentsThis: number; paymentsLast: number }
export interface DodoReport {
  revenue: CurrencyWeek[];                 // major units (e.g. dollars), succeeded payments only
  newCustomersThisWeek: number;            // first successful payment inside the history we fetched (28 days) fell in this week
  newCustomersLastWeek: number;
  failedThisWeek: number;
  activeSubscriptions: number | null;
  cancellingSubscriptions: number | null;  // active but set to end at the next billing date
  byProductThisWeek: { product: string; payments: number }[];
  historyDays: number;
  truncated: boolean;                      // true if we stopped paging before reaching the start of the window
}

export interface NexoraReport {
  generatedAt: string;
  signups: { thisWeek: number; lastWeek: number };
  uninstalls: { thisWeek: number; lastWeek: number; byProductThisWeek: Record<string, number>; reasonsThisWeek: string[] };
  usage: { thisWeek: Record<string, { events: number; items: number; users: number }>; lastWeek: Record<string, { events: number; items: number; users: number }> };
  entitledNow: { total: number; byProduct: Record<string, number>; expiringIn7Days: number };
}

export interface Pulse { generatedAt: string; dodo: Part<DodoReport>; nexora: Part<NexoraReport> }

type Env = Record<string, string | undefined>;

/* ----------------------------------------------------------------------------------------------- Dodo */
interface DodoPayment { payment_id?: string; created_at?: string; status?: string | null; total_amount?: number; currency?: string; subscription_id?: string | null; product_id?: string | null; customer?: { customer_id?: string }; metadata?: Record<string, string> }
const itemsOf = (j: unknown): Record<string, unknown>[] => (Array.isArray(j) ? j : Array.isArray((j as { items?: unknown })?.items) ? (j as { items: Record<string, unknown>[] }).items : []);

async function getJson(f: FetchLike, url: string, key: string): Promise<unknown> {
  const res = await f(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 || res.status === 403) throw new Error('Dodo refused the key (wrong key, or wrong live/test mode).');
  if (!res.ok) throw new Error(`Dodo answered ${res.status}.`);
  return res.json();
}

/** Pure: turns raw Dodo payments into the report. Exported so it can be tested without a network. */
export function summariseDodo(payments: DodoPayment[], subs: { status?: string; cancel_at_next_billing_date?: boolean }[] | null, now: number, historyDays = 28, truncated = false): DodoReport {
  const thisStart = now - 7 * DAY, prevStart = now - 14 * DAY;
  const which = (iso?: string) => { const t = Date.parse(iso ?? ''); return t >= thisStart ? 'this' : t >= prevStart ? 'prev' : 'older'; };
  const ok = (p: DodoPayment) => !p.status || p.status === 'succeeded';
  const money = new Map<string, CurrencyWeek>();
  const products = new Map<string, number>();
  let failedThisWeek = 0;
  const firstSeen = new Map<string, number>();

  for (const p of payments) {
    const w = which(p.created_at);
    if (!ok(p)) { if (w === 'this' && p.status && /failed/.test(p.status)) failedThisWeek++; continue; }
    const cur = p.currency || 'USD';
    const row = money.get(cur) ?? { currency: cur, thisWeek: 0, lastWeek: 0, paymentsThis: 0, paymentsLast: 0 };
    const amount = (p.total_amount ?? 0) / 100;
    if (w === 'this') { row.thisWeek += amount; row.paymentsThis++; const k = p.metadata?.product || p.product_id || 'unknown'; products.set(k, (products.get(k) ?? 0) + 1); }
    else if (w === 'prev') { row.lastWeek += amount; row.paymentsLast++; }
    money.set(cur, row);
    const cid = p.customer?.customer_id; const t = Date.parse(p.created_at ?? '');
    if (cid && Number.isFinite(t)) firstSeen.set(cid, Math.min(firstSeen.get(cid) ?? Infinity, t));
  }
  let nThis = 0, nLast = 0;
  for (const t of firstSeen.values()) { if (t >= thisStart) nThis++; else if (t >= prevStart) nLast++; }

  const active = subs ? subs.filter((s) => s.status === 'active') : null;
  return {
    revenue: [...money.values()].map((r) => ({ ...r, thisWeek: Math.round(r.thisWeek * 100) / 100, lastWeek: Math.round(r.lastWeek * 100) / 100 })),
    newCustomersThisWeek: nThis, newCustomersLastWeek: nLast, failedThisWeek,
    activeSubscriptions: active ? active.length : null,
    cancellingSubscriptions: active ? active.filter((s) => s.cancel_at_next_billing_date).length : null,
    byProductThisWeek: [...products.entries()].map(([product, payments]) => ({ product, payments })).sort((a, b) => b.payments - a.payments),
    historyDays, truncated,
  };
}

export async function fetchDodo(env: Env, f: FetchLike = fetch, now = Date.now()): Promise<Part<DodoReport>> {
  const key = env.DODO_API_KEY?.trim();
  if (!key) return { state: 'not-set-up', why: 'Add DODO_API_KEY (a read-only key) to connect payments.' };
  const base = env.DODO_ENV === 'test' ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';
  const historyDays = 28;
  try {
    const since = new Date(now - historyDays * DAY).toISOString();
    const payments: DodoPayment[] = []; let truncated = false;
    for (let page = 0; ; page++) {
      if (page >= 15) { truncated = true; break; }
      const rows = itemsOf(await getJson(f, `${base}/payments?created_at_gte=${encodeURIComponent(since)}&page_size=100&page_number=${page}`, key)) as DodoPayment[];
      payments.push(...rows);
      if (rows.length < 100) break;
    }
    let subs: { status?: string; cancel_at_next_billing_date?: boolean }[] | null = null;
    try {
      subs = []; for (let page = 0; page < 10; page++) {
        const rows = itemsOf(await getJson(f, `${base}/subscriptions?status=active&page_size=100&page_number=${page}`, key)) as { status?: string; cancel_at_next_billing_date?: boolean }[];
        subs.push(...rows); if (rows.length < 100) break;
      }
    } catch { subs = null; }   // payments are the point; a subscriptions hiccup should not hide them
    return { state: 'ready', data: summariseDodo(payments, subs, now, historyDays, truncated) };
  } catch (e) { return { state: 'error', why: e instanceof Error ? e.message : 'Could not reach Dodo.' }; }
}

/* --------------------------------------------------------------------------------------------- Nexora */
export async function fetchNexora(env: Env, f: FetchLike = fetch): Promise<Part<NexoraReport>> {
  const url = env.NEXORA_PULSE_URL?.trim(), token = env.NEXORA_PULSE_TOKEN?.trim();
  if (!url || !token) return { state: 'not-set-up', why: 'Add NEXORA_PULSE_URL and NEXORA_PULSE_TOKEN to connect the Nexora dashboard data.' };
  try {
    const res = await f(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (res.status === 401) return { state: 'error', why: 'The Nexora backend refused the token (PULSE_TOKEN differs).' };
    if (res.status === 404) return { state: 'error', why: 'The Nexora backend has no /api/pulse yet: deploy it first.' };
    if (res.status === 503) return { state: 'error', why: 'PULSE_TOKEN is not set on the Nexora backend yet.' };
    const j = (await res.json().catch(() => null)) as (NexoraReport & { ok?: boolean; error?: string }) | null;
    if (!res.ok || !j?.ok) return { state: 'error', why: j?.error ?? `The Nexora backend answered ${res.status}.` };
    return { state: 'ready', data: j };
  } catch (e) { return { state: 'error', why: e instanceof Error ? e.message : 'Could not reach the Nexora backend.' }; }
}

/* ----------------------------------------------------------------------------------- cache + text form */
const g = globalThis as unknown as { __compass_pulse?: { at: number; value: Pulse } };

/** Both sources, cached for 10 minutes per server instance so asking the assistant three questions does not hit Dodo three times. */
export async function getPulse(env: Env = process.env, opts: { fresh?: boolean; f?: FetchLike } = {}): Promise<Pulse> {
  const c = g.__compass_pulse;
  if (!opts.fresh && c && Date.now() - c.at < 10 * 60_000) return c.value;
  const [dodo, nexora] = await Promise.all([fetchDodo(env, opts.f), fetchNexora(env, opts.f)]);
  const value: Pulse = { generatedAt: new Date().toISOString(), dodo, nexora };
  if (dodo.state !== 'error' && nexora.state !== 'error') g.__compass_pulse = { at: Date.now(), value };
  return value;
}

const delta = (a: number, b: number) => (b === 0 ? (a === 0 ? 'flat' : 'new') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`);
const cash = (c: string, n: number) => `${c === 'USD' ? '$' : c === 'INR' ? 'Rs ' : c + ' '}${n.toFixed(2)}`;

/** The plain-text version the assistant reads. Says plainly what is missing so it never invents numbers. */
export function pulseText(p: Pulse): string {
  const out: string[] = ['BUSINESS PULSE (last 7 days vs the 7 before; read-only, from Dodo and the Nexora backend):'];
  if (p.dodo.state !== 'ready') out.push(`- Dodo: NOT AVAILABLE (${p.dodo.why}). Do not state any revenue figure.`);
  else {
    const d = p.dodo.data;
    if (!d.revenue.length) out.push('- Dodo revenue: no successful payments in the last 14 days.');
    for (const r of d.revenue) out.push(`- Dodo revenue (${r.currency}): ${cash(r.currency, r.thisWeek)} this week (${r.paymentsThis} payments) vs ${cash(r.currency, r.lastWeek)} (${r.paymentsLast}) before, ${delta(r.thisWeek, r.lastWeek)}. Currencies are not converted.`);
    out.push(`- New paying customers: ${d.newCustomersThisWeek} this week vs ${d.newCustomersLastWeek} (first payment within the last ${d.historyDays} days of history, so a returning older customer can look new). Failed payments this week: ${d.failedThisWeek}.`);
    if (d.activeSubscriptions !== null) out.push(`- Active subscriptions in Dodo: ${d.activeSubscriptions}, of which ${d.cancellingSubscriptions} will end at the next billing date.`);
    if (d.byProductThisWeek.length) out.push('- Payments by product this week: ' + d.byProductThisWeek.map((x) => `${x.product} ${x.payments}`).join(', '));
    if (d.truncated) out.push('- Warning: Dodo history was cut off at the page limit; totals may be low.');
  }
  if (p.nexora.state !== 'ready') out.push(`- Nexora dashboard: NOT AVAILABLE (${p.nexora.why}). Do not state any signup, uninstall or usage figure.`);
  else {
    const n = p.nexora.data;
    out.push(`- Signups (Google sign-in only, not installs): ${n.signups.thisWeek} vs ${n.signups.lastWeek}. Uninstall forms: ${n.uninstalls.thisWeek} vs ${n.uninstalls.lastWeek} (not comparable to signups).`);
    const prods = new Set([...Object.keys(n.usage.thisWeek), ...Object.keys(n.usage.lastWeek)]);
    for (const k of prods) { const a = n.usage.thisWeek[k], b = n.usage.lastWeek[k]; out.push(`- Usage ${k}: ${a?.events ?? 0} events / ${a?.users ?? 0} users vs ${b?.events ?? 0} / ${b?.users ?? 0}`); }
    out.push(`- Paying and still entitled now: ${n.entitledNow.total} (${Object.entries(n.entitledNow.byProduct).map(([k, v]) => `${k} ${v}`).join(', ')}); ${n.entitledNow.expiringIn7Days} run out within 7 days.`);
    if (n.uninstalls.reasonsThisWeek.length) out.push('- Uninstall reasons this week: ' + n.uninstalls.reasonsThisWeek.slice(-8).join(' | '));
  }
  return out.join('\n');
}
