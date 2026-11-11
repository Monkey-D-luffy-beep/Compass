import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, checkSession, configuredPassword, mustLock } from '@/lib/auth';

/** Everything except the login page, its API, and static files needs the session cookie. */
export async function proxy(req: NextRequest) {
  const pw = configuredPassword();
  const { pathname } = req.nextUrl;
  if (!pw) {
    // Hosted with no password set: refuse, so a missing setting can never publish your plans.
    if (mustLock()) return new NextResponse('Compass is locked: set COMPASS_PASSWORD.', { status: 503 });
    return NextResponse.next();
  }
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  if (await checkSession(req.cookies.get(COOKIE)?.value, pw)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Not the icons or manifest, which the browser fetches without the cookie when installing to a home screen.
  matcher: ['/((?!_next/|favicon\\.ico|icon|apple-icon|logo-|banner-|manifest\\.webmanifest).*)'],
};
