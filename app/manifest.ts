import type { MetadataRoute } from 'next';

// Required for `output: 'export'` (GitHub Pages) in Next.js 15.5+.
export const dynamic = 'force-static';

// Base path for the deployment target (e.g. "/nutrilens" on GitHub Pages
// project sites). Kept relative-safe so the PWA installs correctly under any
// sub-path without hardcoding a host.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE_PATH}/`,
    name: 'NutriLens - Smart Processed Food Scanner',
    short_name: 'NutriLens',
    description: 'Privacy-first, in-browser food label intelligence scanner. Scan. Know. Choose.',
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    background_color: '#F7F7F2',
    theme_color: '#159A6A',
    orientation: 'portrait',
    icons: [
      {
        src: `${BASE_PATH}/icon.svg`,
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: `${BASE_PATH}/icon.svg`,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
