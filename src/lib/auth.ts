/**
 * One password, one signed cookie. Web Crypto only, so it runs in the proxy (edge-style) and in route handlers alike.
 * The cookie holds an expiry and an HMAC of it with a key derived from the password, so changing the password
 * signs every device out.
 */
export const COOKIE = 'compass_session';
const DAYS = 30;
const enc = new TextEncoder();

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function sign(msg: string, password: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode('compass-session:' + password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
/** Compares without stopping at the first difference. */
export function same(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

export const configuredPassword = (): string | null => process.env.COMPASS_PASSWORD || null;
/** Hosted without a password must refuse everything, never fall open. Local without one is open (it binds to 127.0.0.1). */
export const mustLock = (): boolean => !!process.env.VERCEL || !!process.env.COMPASS_REQUIRE_LOGIN;

export async function makeSession(password: string, now = Date.now()): Promise<string> {
  const exp = String(now + DAYS * 86_400_000);
  return `${exp}.${await sign(exp, password)}`;
}
export async function checkSession(token: string | undefined, password: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return same(mac, await sign(exp, password));
}
export const SESSION_SECONDS = DAYS * 86_400;
