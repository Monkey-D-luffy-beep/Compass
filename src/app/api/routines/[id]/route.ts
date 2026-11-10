import { api } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteRoutine, toggleRoutine } from '@/lib/store';

/** POST ticks or unticks the routine for today. */
export const POST = api(async (_req, ctx: { params: Promise<{ id: string }> }) => ({ done: await toggleRoutine(await getDb(), (await ctx.params).id) }));
export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteRoutine(await getDb(), (await ctx.params).id); return { ok: true }; });
