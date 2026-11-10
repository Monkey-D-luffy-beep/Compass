import 'server-only';
import path from 'node:path';
import { openDefault } from './db';
import type { Db } from './pg';
import { loadKey } from './secrets';

/** One database and one key per server process. Kept on globalThis because Next.js can load a module twice. */
const DATA_DIR = path.resolve(/* turbopackIgnore: true */ process.env.COMPASS_DATA ?? '.data');
const g = globalThis as unknown as { __compass_db?: Promise<Db>; __compass_key?: Buffer };

export const dataDir = (): string => DATA_DIR;
/** A promise, so concurrent first requests share one connection and one migration run. A failed open is retried next time. */
export const getDb = (): Promise<Db> => {
  if (!g.__compass_db) {
    g.__compass_db = openDefault(path.join(DATA_DIR, 'pg')).catch((e) => { g.__compass_db = undefined; throw e; });
  }
  return g.__compass_db;
};
export const getKey = (): Buffer => (g.__compass_key ??= loadKey(DATA_DIR));
