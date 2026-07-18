import type { Metadata, Viewport } from 'next';
import PWARegister from './pwa-register';
import './globals.css';

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
    icon: [
      { url: '/pwa-icon?size=32', sizes: '32x32', type: 'image/png' },
      { url: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/pwa-icon?size=180&apple=1', sizes: '180x180', type: 'image/png' }],
    shortcut: [
      { url: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icon?size=512&maskable=1', sizes: '512x512', type: 'image/png' }
    ]
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
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
