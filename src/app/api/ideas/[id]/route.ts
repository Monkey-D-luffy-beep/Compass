import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteIdea, updateIdea } from '@/lib/store';

export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => updateIdea(await getDb(), (await ctx.params).id, await body<{ status?: string; score?: number; title?: string; pitch?: string | null }>(req)));
export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteIdea(await getDb(), (await ctx.params).id); return { ok: true }; });
