import { api, body } from '@/lib/api';
import { generateIdeas } from '@/lib/ai';
import { readBrain } from '@/lib/brain';
import { getDb, getKey } from '@/lib/runtime';

export const maxDuration = 120;
export const POST = api(async (req) => {
  const b = await body<{ focus?: string }>(req).catch(() => ({} as { focus?: string }));
  const db = await getDb();
  return generateIdeas(db, getKey(), await readBrain(db), b.focus ?? '');
});
