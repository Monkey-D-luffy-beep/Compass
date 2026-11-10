import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { InputError } from './errors';

/**
 * Route wrapper: same-origin check on writes (this app has no login, so a page on another site must not be able to make
 * your browser call it), and uniform JSON errors. Handlers just return data, or throw.
 */
export function api<Ctx = unknown>(handler: (req: NextRequest, ctx: Ctx) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      if (req.method !== 'GET') {
        const origin = req.headers.get('origin');
        const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
        if (origin && new URL(origin).host !== host) return NextResponse.json({ ok: false, error: 'Cross-site request blocked.' }, { status: 403 });
      }
      const data = await handler(req, ctx);
      return data instanceof Response ? data : NextResponse.json({ ok: true, data });
    } catch (e) {
      if ((e instanceof Error && e.name === 'InputError') || e instanceof InputError) return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
      if (e instanceof ZodError) return NextResponse.json({ ok: false, error: e.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
      console.error('[api]', e);
      return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new InputError('Send JSON.'); }
}
