'use client';
// Coarse device info for analytics: the platform family, whether the game runs as the home-screen
// app, and the UI language. Nothing that identifies a person or a device.

export type Device = { platform: 'ios' | 'android' | 'desktop'; standalone: boolean };

export function deviceInfo(): Device {
  if (typeof window === 'undefined') return { platform: 'desktop', standalone: false };
  const ua = navigator.userAgent || '';
  // iPadOS reports a Mac user agent; a touch screen tells them apart
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const platform = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  let standalone = (navigator as any).standalone === true;
  try {
    standalone = standalone || window.matchMedia('(display-mode: standalone)').matches;
  } catch {}
  return { platform, standalone };
}
