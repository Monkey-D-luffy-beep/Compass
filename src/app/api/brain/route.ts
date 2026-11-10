import { api, body } from '@/lib/api';
import { writeBrain } from '@/lib/brain';
import { InputError } from '@/lib/errors';
import { getDb } from '@/lib/runtime';

export const PUT = api(async (req) => {
  const { text } = await body<{ text: string }>(req);
  if (typeof text !== 'string') throw new InputError('Send the text.');
  if (text.length > 40_000) throw new InputError('Keep the brain under 40,000 characters: it is sent with every question.');
  await writeBrain(await getDb(), text);
  return { ok: true, chars: text.length };
});
