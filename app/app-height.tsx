'use client';

import { useEffect } from 'react';

// Re-applies --app-h once React has mounted. The head script in layout.tsx sets it before first
// paint, but if hydration falls back to client rendering, React resets <html>'s attributes and the
// value is lost; this calls the same setter again (the script's resize listeners stay in place).
export default function AppHeight() {
  useEffect(() => {
    (window as any).__hullaSetAppH?.();
  }, []);
  return null;
}

// iOS ignores user-scalable=no for pinch in Safari; its proprietary gesture events can still be
// cancelled. Applies to every screen (home, leaderboard, lobby, game table).
export function NoPinchZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
    };
  }, []);
  return null;
}
