import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, SESSION_SECONDS, configuredPassword, makeSession, same } from '@/lib/auth';

/** Failures per address in a sliding window. In memory, so per server instance: it slows guessing, it is not a vault. */
const g = globalThis as unknown as { __compass_fails?: Map<string, number[]> };
const fails: Map<string, number[]> = (g.__compass_fails ??= new Map());
const WINDOW = 15 * 60_000; const MAX = 8;

export async function POST(req: NextRequest) {
  const pw = configuredPassword();
  if (!pw) return NextResponse.json({ ok: false, error: 'No password is set on the server.' }, { status: 503 });
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX) return NextResponse.json({ ok: false, error: 'Too many wrong tries. Wait 15 minutes.' }, { status: 429 });

  let given = ''; try { given = String(((await req.json()) as { password?: string }).password ?? ''); } catch { /* empty */ }
  if (!same(given, pw)) {
    fails.set(ip, [...recent, now]);
    return NextResponse.json({ ok: false, error: 'Wrong password.' }, { status: 401 });
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeSession(pw), { httpOnly: true, secure: !!process.env.VERCEL || req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
