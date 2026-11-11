import { api, body } from '@/lib/api';
import { InputError } from '@/lib/errors';
import { getDb } from '@/lib/runtime';
import { getSetting, setSetting } from '@/lib/store';

/** Who the app greets and which pixel avatar they picked. Just two settings. */
export const GET = api(async () => {
  const db = await getDb();
  return { displayName: (await getSetting(db, 'display_name')) || 'Saurav', avatar: Number(await getSetting(db, 'avatar')) || 0 };
});
export const PUT = api(async (req) => {
  const b = await body<{ displayName?: string; avatar?: number }>(req); const db = await getDb();
  if (b.displayName !== undefined) {
    const n = String(b.displayName).trim().slice(0, 30); if (!n) throw new InputError('Enter a name.');
    await setSetting(db, 'display_name', n);
  }
  if (b.avatar !== undefined) {
    const a = Number(b.avatar); if (!Number.isInteger(a) || a < 0 || a > 5) throw new InputError('Pick one of the avatars.');
    await setSetting(db, 'avatar', String(a));
  }
  return { ok: true };
});
