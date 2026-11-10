import { api } from '@/lib/api';
import { getPulse } from '@/lib/pulse';

export const dynamic = 'force-dynamic';
/** Read-only. ?fresh=1 skips the 10-minute cache. */
export const GET = api(async (req) => getPulse(process.env, { fresh: req.nextUrl.searchParams.get('fresh') === '1' }));
