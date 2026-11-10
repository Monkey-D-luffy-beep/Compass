import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteGoal, updateGoal } from '@/lib/store';

export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => updateGoal(await getDb(), (await ctx.params).id, await body<{ title?: string; target?: number; current?: number; note?: string | null }>(req)));
export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteGoal(await getDb(), (await ctx.params).id); return { ok: true }; });
