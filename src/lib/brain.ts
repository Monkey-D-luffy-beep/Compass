import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Db } from './pg';
import { getSetting, setSetting } from './store';

/**
 * The brain lives in the database (so it works when hosted, where there is no writable disk). BRAIN.md in this folder is
 * the starting text: it is copied in the first time the brain is read, after which the database copy wins.
 */
const FILE = path.resolve(/* turbopackIgnore: true */ process.env.COMPASS_BRAIN ?? 'BRAIN.md');

export async function readBrain(db: Db): Promise<string> {
  const saved = await getSetting(db, 'brain');
  if (saved !== null) return saved;
  const start = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
  if (start) await setSetting(db, 'brain', start);
  return start;
}
export async function writeBrain(db: Db, text: string): Promise<void> {
  await setSetting(db, 'brain', text.replace(/\r\n/g, '\n'));
}
