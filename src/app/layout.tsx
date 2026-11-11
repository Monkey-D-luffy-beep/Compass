import type { Metadata, Viewport } from 'next';
import { Jersey_10 } from 'next/font/google';
import './globals.css';
import { MobileNav, Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/ds-client';

// The pixel face is for titles, labels and big numbers only; body text stays in a plain, readable face.
const pixel = Jersey_10({ weight: '400', subsets: ['latin'], variable: '--font-pixel-face', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Compass', template: '%s · Compass' },
  description: 'Your plan, your money and your next move in one place.',
  appleWebApp: { capable: true, title: 'Compass', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#1b2040', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before the first paint so the chosen theme never flashes. Day (cream) unless Night was picked.
const THEME_SCRIPT = `try{var t=localStorage.getItem('compass-theme');document.documentElement.dataset.theme=t==='night'?'night':'cream';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="cream" className={pixel.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <ToastProvider>
          <div className="mx-auto flex min-h-screen max-w-[1480px]">
            <Sidebar />
            <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10"><MobileNav />{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
