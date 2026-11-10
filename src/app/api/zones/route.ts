import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addZone, listZones } from '@/lib/store';

export const GET = api(async () => (await listZones(await getDb())).map((z) => ({ id: z.id, name: z.name, color: z.color })));
export const POST = api(async (req) => addZone(await getDb(), await body<{ name: string; kind?: 'project' | 'growth' | 'study' | 'goal'; color?: string; note?: string }>(req)));
