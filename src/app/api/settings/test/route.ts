import { api } from '@/lib/api';
import { testKey } from '@/lib/ai';
import { getDb, getKey } from '@/lib/runtime';

export const POST = api(async () => ({ reply: await testKey(await getDb(), getKey()) }));
