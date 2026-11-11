import { api, body } from '@/lib/api';
import { getDb } from '@/lib/runtime';
import { archiveDone } from '@/lib/store';

/** Archive every finished task, in one project ({ zone }) or everywhere. */
export const POST = api(async (req) => {
  const b = await body<{ zone?: string }>(req).catch(() => ({} as { zone?: string }));
  return { archived: await archiveDone(await getDb(), b.zone) };
});
