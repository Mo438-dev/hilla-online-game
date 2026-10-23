import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Markazi_Text } from 'next/font/google';
import PWARegister from './pwa-register';
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
  themeColor: MAROON
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
    'theme-color': MAROON,
    'application-name': 'حُلّة',
    'background-color': CREAM
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${markazi.variable}`}>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
