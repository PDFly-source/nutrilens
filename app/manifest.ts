import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NutriLens - Smart Processed Food Scanner',
    short_name: 'NutriLens',
    description: 'Privacy-first, in-browser food label intelligence scanner. Scan. Know. Choose.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F7F2',
    theme_color: '#159A6A',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
