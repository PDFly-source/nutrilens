import type { Metadata, Viewport } from 'next';
import './globals.css';

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
      'A privacy-first, local-in-browser food intelligence scanner to understand packaged food labels, nutrition, ingredients, and processing levels. Scan. Know. Choose.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NutriLens - Smart Processed Food Scanner',
    description:
      'A privacy-first, local-in-browser food intelligence scanner to understand packaged food labels, nutrition, ingredients, and processing levels. Scan. Know. Choose.',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
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
