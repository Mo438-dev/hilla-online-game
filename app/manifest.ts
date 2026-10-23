import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'حُلّة',
    short_name: 'حُلّة',
    description: 'لعبة مطابقة الأزياء التقليدية السعودية',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F3E9D2',
    theme_color: '#85152D',
    lang: 'ar',
    dir: 'rtl',
    categories: ['games', 'entertainment'],
    // #61 default app icon (b). The player can pick another before installing; the client then
    // points <link rel="manifest"> at /manifest-<key>.webmanifest (same content, other icons).
    icons: [
      { src: '/icons/b/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/b/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/b/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/b/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }
    ]
  };
}
