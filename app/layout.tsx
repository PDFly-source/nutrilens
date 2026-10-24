import type { Metadata, Viewport } from 'next';
import './globals.css';

// Base path for the deployment target (e.g. "/nutrilens" on GitHub Pages project sites).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const viewport: Viewport = {
  themeColor: '#159A6A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'NutriLens - Smart Processed Food Scanner',
  description:
    'A privacy-first, local-in-browser food intelligence scanner to understand packaged food labels, nutrition, ingredients, and processing levels. Scan. Know. Choose.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NutriLens',
  },
  openGraph: {
    title: 'NutriLens - Smart Processed Food Scanner',
    description:
      'A privacy-first, in-browser food label intelligence scanner. Scan. Know. Choose.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NutriLens - Smart Processed Food Scanner',
    description:
      'A privacy-first, in-browser food label intelligence scanner. Scan. Know. Choose.',
  },
  icons: {
    icon: `${BASE_PATH}/icon.svg`,
    apple: `${BASE_PATH}/icon.svg`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen selection:bg-[#DDF5EA] selection:text-[#08734E]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
