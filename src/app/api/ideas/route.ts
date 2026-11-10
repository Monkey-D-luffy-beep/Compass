import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addIdea } from '@/lib/store';

export const POST = api(async (req) => addIdea(await getDb(), await body<{ title: string; kind?: string; pitch?: string; moneyLogic?: string; validateStep?: string; score?: number }>(req)));
