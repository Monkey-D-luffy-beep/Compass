"use client";
import { useState } from 'react';
import { Compass } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg px-5">
      <form onSubmit={go} className="card card-pad w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2.5 text-[17px] font-semibold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-bg"><Compass className="h-[18px] w-[18px]" /></span>Compass</div>
        <input className="input !text-[16px]" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" />
        {error && <p role="alert" className="text-bad">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
