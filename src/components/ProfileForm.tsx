"use client";
import { useEffect, useState } from 'react';
import { call } from '@/lib/client';
import { AVATARS, PixelAvatar } from './ds';
import { useToast } from './ds-client';

/** Who Compass greets, and which pixel avatar shows in the sidebar. Saved in the database, so it follows you to your phone. */
export function ProfileForm() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { call<{ displayName: string; avatar: number }>('/api/profile', 'GET').then((p) => { setName(p.displayName); setAvatar(p.avatar); setLoaded(true); }).catch(() => setLoaded(true)); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await call('/api/profile', 'PUT', { displayName: name, avatar });
      const detail = { displayName: name.trim(), avatar };
      try { localStorage.setItem('compass-profile', JSON.stringify(detail)); } catch { /* fine */ }
      window.dispatchEvent(new CustomEvent('compass-profile', { detail }));   // the sidebar updates at once
      toast('Profile saved');
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not save.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card card-pad space-y-4" aria-busy={!loaded}>
      <div><h2 className="h-card">Profile</h2><p className="mt-1 text-muted">The name Compass greets you with, and your avatar.</p></div>
      <div>
        <p className="label mb-2">Avatar</p>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Avatar">
          {AVATARS.map((a, i) => (
            <button key={a.name} type="button" role="radio" aria-checked={avatar === i} aria-label={a.name} onClick={() => setAvatar(i)}
              className={`tip rounded-lg border-2 p-1 transition ${avatar === i ? 'border-outline bg-accent shadow-[0_3px_0_var(--shadow)]' : 'border-transparent hover:bg-surface2'}`} data-tip={a.name}><PixelAvatar index={i} size={52} /></button>
          ))}
        </div>
      </div>
      <label className="block"><span className="label mb-1.5 block">Your name</span>
        <input className="input !text-[16px]" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Saurav" /></label>
      <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}
