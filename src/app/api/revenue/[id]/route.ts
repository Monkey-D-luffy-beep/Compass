import { api } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteRevenue } from '@/lib/store';

export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteRevenue(await getDb(), (await ctx.params).id); return { ok: true }; });
