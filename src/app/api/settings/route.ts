import { api, body } from '@/lib/api';
import { MODELS, saveKey } from '@/lib/ai';
import { InputError } from '@/lib/errors';
import { getDb, getKey } from '@/lib/runtime';
import { setSetting } from '@/lib/store';

export const PUT = api(async (req) => {
  const b = await body<{ apiKey?: string; model?: string; revenueGoal?: number; inrPerUsd?: number }>(req);
  const db = await getDb();
  if (b.apiKey !== undefined) await saveKey(db, getKey(), b.apiKey);
  if (b.model !== undefined) {
    if (!(MODELS as readonly string[]).includes(b.model)) throw new InputError('Pick one of the listed models.');
    await setSetting(db, 'model', b.model);
  }
  if (b.inrPerUsd !== undefined) {
    const r = Number(b.inrPerUsd);
    if (!Number.isFinite(r) || r < 1 || r > 1000) throw new InputError('Enter how many rupees one dollar is worth, like 88.');
    await setSetting(db, 'inr_per_usd', String(r));
  }
  if (b.revenueGoal !== undefined) {
    const g = Number(b.revenueGoal);
    if (!Number.isFinite(g) || g <= 0) throw new InputError('The goal must be a number above zero.');
    await setSetting(db, 'revenue_goal', String(g));
  }
  return { ok: true };
});
