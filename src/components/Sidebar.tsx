"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, LogOut, BookOpen, CalendarRange, Compass, Layers, Lightbulb, MessageSquare, Repeat, Settings, Sun, Wallet } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Today', icon: Sun },
  { href: '/plan', label: 'Plan', icon: CalendarRange },
  { href: '/zones', label: 'Zones', icon: Layers },
  { href: '/money', label: 'Money', icon: Wallet },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/routine', label: 'Routine', icon: Repeat },
  { href: '/assistant', label: 'Assistant', icon: MessageSquare },
  { href: '/brain', label: 'Brain', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

async function signOut() { try { await fetch('/api/login', { method: 'DELETE' }); } finally { window.location.href = '/login'; } }

export function Sidebar() {
  const path = usePathname();
  const [theme, setTheme] = useState<'dark' | 'grey'>('dark');
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'grey' ? 'grey' : 'dark'); }, []);
  function pick(t: 'dark' | 'grey') {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('compass-theme', t); } catch { /* the choice just will not be remembered */ }
  }
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line px-3 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-3 text-[17px] font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-bg"><Compass className="h-[18px] w-[18px]" /></span>Compass
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition ${active(href) ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface hover:text-ink'}`}>
            <Icon className="h-[17px] w-[17px]" />{label}
          </Link>
        ))}
      </nav>
      <div className="px-1">
        <button type="button" onClick={signOut} className="mb-4 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-muted hover:bg-surface hover:text-ink"><LogOut className="h-[17px] w-[17px]" />Sign out</button>
        <p className="label mb-2 px-2">Theme</p>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-[13px]" role="radiogroup" aria-label="Theme">
          {(['dark', 'grey'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => pick(t)}
              className={`rounded-lg py-1.5 capitalize transition ${theme === t ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`}>{t}</button>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** A compact bar for small screens, where the sidebar is hidden. */
export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto md:hidden" aria-label="Main mobile">
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={`shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] ${(href === '/' ? path === '/' : path.startsWith(href)) ? 'bg-surface2 text-ink' : 'text-muted'}`}>{label}</Link>
      ))}
      <button type="button" onClick={signOut} className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-muted">Sign out</button>
    </nav>
  );
}
