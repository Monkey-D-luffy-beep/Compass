import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addGoal } from '@/lib/store';

export const POST = api(async (req) => addGoal(await getDb(), await body<{ zone?: string; title: string; target: number; current?: number; unit?: string; note?: string }>(req)));
