import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { updateZone } from '@/lib/store';

export const PATCH = api(async (req, ctx: { params: Promise<{ id: string }> }) => updateZone(await getDb(), (await ctx.params).id, await body<{ name?: string; color?: string; note?: string | null; archived?: boolean }>(req)));
