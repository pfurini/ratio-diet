import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  name: 'Ratio Diet',
  short_name: 'RatioDiet',
  description: 'La tua alimentazione basata su numeri, proporzioni e metodo.',
  start_url: '/dashboard',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#4a1d6a',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
});

export default manifest;
