import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addRoutine } from '@/lib/store';

export const POST = api(async (req) => { await addRoutine(await getDb(), await body<{ zone?: string; title: string; minutes?: number; money?: number; days?: string }>(req)); return { ok: true }; });
