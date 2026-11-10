import { api, body } from '@/lib/api';
import { MODELS, saveKey } from '@/lib/ai';
import { InputError } from '@/lib/errors';
import { getDb, getKey } from '@/lib/runtime';
import { setSetting } from '@/lib/store';

export const PUT = api(async (req) => {
  const b = await body<{ apiKey?: string; model?: string; revenueGoal?: number }>(req);
  const db = await getDb();
  if (b.apiKey !== undefined) await saveKey(db, getKey(), b.apiKey);
  if (b.model !== undefined) {
    if (!(MODELS as readonly string[]).includes(b.model)) throw new InputError('Pick one of the listed models.');
    await setSetting(db, 'model', b.model);
  }
  if (b.revenueGoal !== undefined) {
    const g = Number(b.revenueGoal);
    if (!Number.isFinite(g) || g <= 0) throw new InputError('The goal must be a number above zero.');
    await setSetting(db, 'revenue_goal', String(g));
  }
  return { ok: true };
});
