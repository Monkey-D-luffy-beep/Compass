import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { deleteTask, updateTask, type TaskPatch } from '@/lib/store';

export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => updateTask(await getDb(), (await ctx.params).id, await body<TaskPatch>(req)));
export const DELETE = api(async (_req, ctx: { params: Promise<{ id: string }> }) => { await deleteTask(await getDb(), (await ctx.params).id); return { ok: true }; });
