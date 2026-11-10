import { api, body } from '@/lib/api';
import { ask } from '@/lib/ai';
import { readBrain } from '@/lib/brain';
import { getDb, getKey } from '@/lib/runtime';
import { clearMessages } from '@/lib/store';

export const POST = api(async (req) => {
  const db = await getDb();
  return ask(db, getKey(), await readBrain(db), (await body<{ question: string }>(req)).question);
});
export const DELETE = api(async () => { await clearMessages(await getDb()); return { ok: true }; });
