'use client';

import { useEffect } from 'react';

export function ThemeInitializer() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        }
      } catch (_) {}
    }
  }, []);

  return null;
}
