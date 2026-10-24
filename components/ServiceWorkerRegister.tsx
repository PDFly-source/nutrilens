'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister
 * 
 * In preview/iframe environments, actively unregisters stale service workers
 * to ensure React event listeners, touch manipulation, and hydration are never blocked.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
              registration.unregister().catch(() => {});
            }
          }).catch(() => {});
        }

        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }, []);

  return null;
}
