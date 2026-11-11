"use client";
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) { setError(j?.error ?? 'Could not sign in.'); setBusy(false); return; }
      window.location.href = '/';
    } catch { setError('Could not reach the server.'); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-navy px-5 py-8">
      <form onSubmit={go} className="card card-pad relative w-full max-w-md space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banner-hero.webp" alt="" className="-mx-1 -mt-1 block h-auto w-[calc(100%+8px)] rounded-md border-2 border-outline" />
        {/* The wordmark is dark, so it always sits on its own cream plate, in either theme. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="rounded-md bg-[#fbf4e4] px-3 py-2"><img src="/logo-full.png" alt="Compass: plan, focus, build, grow" className="mx-auto h-auto w-full max-w-[260px]" style={{ imageRendering: 'pixelated' }} /></div>
        <input className="input !text-[16px]" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" />
        {error && <p role="alert" className="text-bad">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
