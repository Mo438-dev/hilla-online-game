'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocal) return;

    let cancelled = false;
    const register = async () => {
      try {
        if (!cancelled) await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // Ignore registration failures so gameplay is never affected.
      }
    };

    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener('load', register);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
