import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  background_color: '#ffffff',
  description: 'La tua alimentazione basata su numeri, proporzioni e metodo.',
  display: 'standalone',
  icons: [
    { sizes: '192x192', src: '/web-app-manifest-192x192.png', type: 'image/png' },
    { sizes: '512x512', src: '/web-app-manifest-512x512.png', type: 'image/png' },
  ],
  name: 'Ratio Diet',
  short_name: 'RatioDiet',
  start_url: '/dashboard',
  theme_color: '#4a1d6a',
});

export default manifest;
