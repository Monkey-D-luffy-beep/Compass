/**
 * One tiny database interface with two engines behind it, so the same SQL runs everywhere:
 *  - hosted: a real Postgres through DATABASE_URL (Neon, Supabase, anything), for use from the phone;
 *  - local and tests: PGlite, Postgres compiled to run inside Node with no server and no install.
 * SQL is written with "?" placeholders and converted to Postgres's $1, $2.
 */
export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a statement and returns the number of rows it changed. */
  run(sql: string, params?: unknown[]): Promise<number>;
  /** Runs several statements at once (no parameters). */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const toPg = (sql: string): string => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };
const clean = (p: unknown[] = []) => p.map((x) => (x === undefined ? null : x));

type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; affectedRows?: number; rowCount?: number | null }> };
function wrap(q: Queryable, exec: (sql: string) => Promise<unknown>, tx: Db['tx'], close: () => Promise<void>): Db {
  return {
    async query<T = Row>(sql: string, params?: unknown[]) { return (await q.query(toPg(sql), clean(params))).rows as T[]; },
    async run(sql: string, params?: unknown[]) { const r = await q.query(toPg(sql), clean(params)); return r.affectedRows ?? r.rowCount ?? 0; },
    async exec(sql: string) { await exec(sql); },
    tx, close,
  };
}

export async function openPglite(dir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) (await import('node:fs')).mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  const make = (p: { query: Queryable['query']; exec(sql: string): Promise<unknown> }, inner?: boolean): Db =>
    wrap(p as Queryable, (s) => p.exec(s), async (fn) => (inner ? fn(make(p, true)) : pg.transaction((t) => fn(make(t as never, true)))), async () => { if (!inner) await pg.close(); });
  return make(pg as never);
}

export async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import('pg');
  // Hosted Postgres needs TLS; a local one does not.
  const local = /@(localhost|127\.0\.0\.1)/.test(url);
  const pool = new Pool({ connectionString: url, max: 3, ssl: local ? undefined : { rejectUnauthorized: false } });
  const make = (c: { query(sql: string, p?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }> }, inner: boolean): Db =>
    wrap(c as Queryable, async (s) => { await c.query(s); },
      async (fn) => {
        if (inner) return fn(make(c, true));
        const client = await pool.connect();
        try { await client.query('begin'); const out = await fn(make(client, true)); await client.query('commit'); return out; }
        catch (e) { await client.query('rollback').catch(() => undefined); throw e; }
        finally { client.release(); }
      },
      async () => { if (!inner) await pool.end(); });
  return make(pool as never, false);
}
