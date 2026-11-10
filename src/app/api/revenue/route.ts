import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { upsertRevenue } from '@/lib/store';

export const POST = api(async (req) => { await upsertRevenue(await getDb(), await body<{ month: string; source: string; amount: number; note?: string }>(req)); return { ok: true }; });
