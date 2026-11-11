import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Compass',
    short_name: 'Compass',
    description: 'Your plan, your money and your next move in one place.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b2040',
    theme_color: '#1b2040',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
