'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/analytics-client';
import { AUTH_ENABLED, authHeaders } from '@/lib/supabase-browser';

// Re-applies --app-h once React has mounted. The head script in layout.tsx sets it before first
// paint, but if hydration falls back to client rendering, React resets <html>'s attributes and the
// value is lost; this calls the same setter again (the script's resize listeners stay in place).
export default function AppHeight() {
  useEffect(() => {
    (window as any).__hullaSetAppH?.();
  }, []);
  return null;
}

// Uncaught errors and unhandled promise rejections on the player's device go to client_errors,
// tagged with the game being played (GameBoard sets window.__hullaGameId). The reporter itself
// caps how many it sends (a few per minute).
export function ErrorReporter() {
  useEffect(() => {
    const send = async (message: string, stack: string | null) => {
      try {
        const headers = AUTH_ENABLED ? await authHeaders() : {};
        reportClientError(message, stack, (window as any).__hullaGameId || null, headers);
      } catch {}
    };
    const onError = (e: ErrorEvent) => send(e.message || 'error', e.error?.stack || null);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: any = e.reason;
      send(r?.message || String(r || 'unhandledrejection'), r?.stack || null);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

// iOS ignores user-scalable=no for pinch in Safari; its proprietary gesture events can still be
// cancelled. Applies to every screen (home, leaderboard, lobby, game table).
export function NoPinchZoom() {
  useEffect(() => {
    // never interfere with typing: a gesture that starts on a field is left alone
    const stop = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
    };
    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
    };
  }, []);
  return null;
}
