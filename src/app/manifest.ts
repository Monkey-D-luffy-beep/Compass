import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Compass',
    short_name: 'Compass',
    description: 'Your plan, your money and your next move in one place.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0b0e',
    theme_color: '#0a0b0e',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
