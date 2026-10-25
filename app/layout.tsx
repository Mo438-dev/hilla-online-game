import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Markazi_Text } from 'next/font/google';
import PWARegister from './pwa-register';
import AppHeight from './app-height';
import './globals.css';

// Licensed web stand-ins for Thmanyah (which may not be embedded): Plex for UI, Markazi for titles.
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
const markazi = Markazi_Text({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-markazi', display: 'swap' });

const MAROON = '#6B1F2A';
const CREAM = '#F3E9D2';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: CREAM
};

export const metadata: Metadata = {
  title: 'حُلّة',
  description: 'لعبة مطابقة الأزياء التقليدية السعودية',
  applicationName: 'حُلّة',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'حُلّة'
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [{ url: '/icons/b/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/b/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }]
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'حُلّة',
    'msapplication-TileColor': MAROON,
    'msapplication-navbutton-color': MAROON,
    'theme-color': CREAM,
    'application-name': 'حُلّة',
    'background-color': CREAM
  }
};

// The real full-screen height. Installed iOS app (navigator.standalone): the whole physical screen,
// because there 100vh/innerHeight can come out one top safe-area inset short. Everywhere else: the
// visible window (innerHeight), which also follows Safari's toolbar. Re-measured on resize/rotation.
const APP_HEIGHT_SCRIPT = `(function(){try{var d=document.documentElement;function set(){var h=window.innerHeight;if(window.navigator.standalone===true){var p=window.matchMedia("(orientation: portrait)").matches;var s=p?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);if(s>h)h=s;}if(h>0)d.style.setProperty("--app-h",h+"px");}window.__hullaSetAppH=set;set();window.addEventListener("resize",set);window.addEventListener("orientationchange",function(){setTimeout(set,300);});}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${markazi.variable}`}>
      <head>
        {/* Sets --app-h (see globals.css) before first paint, so the splash is full height too. */}
        <script dangerouslySetInnerHTML={{ __html: APP_HEIGHT_SCRIPT }} />
      </head>
      <body>
        {children}
        <PWARegister />
        <AppHeight />
      </body>
    </html>
  );
}
