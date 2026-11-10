import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { addTask, type NewTask } from '@/lib/store';

export const POST = api(async (req) => addTask(await getDb(), await body<NewTask>(req)));
