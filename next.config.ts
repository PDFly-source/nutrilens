import type {NextConfig} from 'next';

/**
 * NutriLens build configuration.
 *
 * Two build modes are supported:
 *  1. Default (`next build`) — server build with the optional Gemini vision
 *     API route, unchanged from the original project.
 *  2. GitHub Pages static export — enabled by setting NEXT_OUTPUT=export at
 *     build time (see scripts/build-pages.mjs). Produces a fully static site
 *     in ./out with an optional base path.
 *
 * NEXT_PUBLIC_BASE_PATH (e.g. "/nutrilens" for a project site) is applied as
 * the Next.js basePath so assets and routes resolve correctly on GitHub Pages.
 */
const isStaticExport = process.env.NEXT_OUTPUT === 'export';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    // Required for static export (GitHub Pages has no image optimization server).
    unoptimized: isStaticExport,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  // GitHub Pages serves project sites from a sub-path (e.g. /nutrilens/).
  ...(basePath ? { basePath } : {}),
  // Static export for GitHub Pages; server build otherwise.
  output: isStaticExport ? 'export' : 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
