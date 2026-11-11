import { api } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteEntry } from '@/lib/store';

export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteEntry(await getDb(), (await ctx.params).id); return { ok: true }; });
