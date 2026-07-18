import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'حِلّة',
    short_name: 'حِلّة',
    description: 'لعبة مطابقة الأزياء التقليدية السعودية',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F3E9D2',
    theme_color: '#6B1F2A',
    lang: 'ar',
    dir: 'rtl',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-icon?size=1024', sizes: '1024x1024', type: 'image/png' },
      { src: '/pwa-icon?size=512&maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa-icon?size=180&apple=1', sizes: '180x180', type: 'image/png' }
    ]
  };
}
