import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MobileNav, Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: { default: 'Compass', template: '%s · Compass' },
  description: 'Your plan, your money and your next move in one place.',
  appleWebApp: { capable: true, title: 'Compass', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#0a0b0e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before the first paint so the chosen theme never flashes.
const THEME_SCRIPT = `try{var t=localStorage.getItem('compass-theme');if(t==='grey'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <div className="mx-auto flex min-h-screen max-w-[1400px]">
          <Sidebar />
          <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10"><MobileNav />{children}</main>
        </div>
      </body>
    </html>
  );
}
