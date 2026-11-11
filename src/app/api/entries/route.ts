import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addEntry } from '@/lib/store';

export const POST = api(async (req) => addEntry(await getDb(), await body<Parameters<typeof addEntry>[1]>(req)));
