"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, FolderKanban, LayoutDashboard, LogOut, BookOpen, CalendarRange, Layers, Lightbulb, MessageSquare, Moon, Settings, Sun, SunMedium, Wallet } from 'lucide-react';
import { PixelAvatar } from './ds';

const NAV = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/', label: 'Today', icon: Sun },
  { href: '/plan', label: 'Plan', icon: CalendarRange },
  { href: '/zones', label: 'Zones', icon: Layers },
  { href: '/money', label: 'Finance', icon: Wallet },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/assistant', label: 'Assistant', icon: MessageSquare },
  { href: '/brain', label: 'Brain', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const PROFILE_KEY = 'compass-profile';

async function signOut() { try { await fetch('/api/login', { method: 'DELETE' }); } finally { window.location.href = '/login'; } }
const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

function useProfile() {
  const [profile, setProfile] = useState<{ displayName: string; avatar: number }>({ displayName: 'Saurav', avatar: 0 });
  useEffect(() => {
    try { const s = localStorage.getItem(PROFILE_KEY); if (s) setProfile(JSON.parse(s)); } catch { /* default profile */ }
    if (window.location.pathname === '/login') return;   // not signed in yet: nothing to ask for
    fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.ok) { setProfile(j.data); try { localStorage.setItem(PROFILE_KEY, JSON.stringify(j.data)); } catch { /* fine */ } }
    }).catch(() => {});
    const onChange = (e: Event) => setProfile((e as CustomEvent).detail);
    window.addEventListener('compass-profile', onChange); return () => window.removeEventListener('compass-profile', onChange);
  }, []);
  return profile;
}

export function Sidebar() {
  const path = usePathname();
  const profile = useProfile();
  const [theme, setTheme] = useState<'cream' | 'night'>('cream');
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'night' ? 'night' : 'cream'); }, []);
  function pick(t: 'cream' | 'night') {
    setTheme(t); document.documentElement.dataset.theme = t;
    try { localStorage.setItem('compass-theme', t); } catch { /* the choice just will not be remembered */ }
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r-4 border-[#0f1226] bg-navy px-3 py-5 text-[#e9e6f5] md:flex" style={{ color: 'var(--navy-ink)' }}>
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-emblem.png" alt="" width={42} height={42} style={{ imageRendering: 'pixelated' }} />
        <span className="font-pixel text-[29px] font-bold">Compass</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-[14.5px] font-medium transition ${on ? 'border-[#0f1226] bg-accent text-on-accent shadow-[0_3px_0_#0f1226]' : 'border-transparent hover:bg-navy2'}`}
              style={on ? undefined : { color: 'var(--navy-ink)' }}>
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />{label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg border-2 border-[#0f1226] bg-navy2 p-1 text-[13px]" role="radiogroup" aria-label="Theme">
          {([['cream', 'Day', SunMedium], ['night', 'Night', Moon]] as const).map(([t, label, Icon]) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => pick(t)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${theme === t ? 'bg-accent text-on-accent' : 'hover:bg-navy'}`} style={theme === t ? undefined : { color: 'var(--navy-muted)' }}><Icon className="h-3.5 w-3.5" />{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border-2 border-[#0f1226] bg-navy2 p-2">
          <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Your profile and settings"><PixelAvatar index={profile.avatar} size={38} /><span className="min-w-0 truncate text-[14px] font-semibold">{profile.displayName}</span></Link>
          <button type="button" onClick={signOut} className="tip rounded-md p-1.5 hover:bg-navy" data-tip="Sign out" aria-label="Sign out" style={{ color: 'var(--navy-muted)' }}><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </aside>
  );
}

/** A compact bar for small screens, where the sidebar is hidden. */
export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="-mx-5 -mt-8 mb-5 flex items-center gap-1.5 overflow-x-auto border-b-4 border-[#0f1226] bg-navy px-4 py-3 sm:-mx-8 sm:px-6 md:hidden" aria-label="Main mobile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-emblem.png" alt="Compass" width={30} height={30} className="mr-1 shrink-0" style={{ imageRendering: 'pixelated' }} />
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? 'page' : undefined}
          className={`shrink-0 rounded-md border-2 px-3 py-1.5 text-[13px] font-semibold ${isActive(path, href) ? 'border-[#0f1226] bg-accent text-on-accent' : 'border-transparent'}`} style={isActive(path, href) ? undefined : { color: 'var(--navy-ink)' }}>{label}</Link>
      ))}
      <button type="button" onClick={signOut} className="shrink-0 rounded-md border-2 border-transparent px-3 py-1.5 text-[13px]" style={{ color: 'var(--navy-muted)' }}>Sign out</button>
    </nav>
  );
}
