import { createHillaIconResponse } from '../../lib/pwa-icon';

export const runtime = 'edge';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = Number.parseInt(searchParams.get('size') || '192', 10);
  const size = clamp(Number.isFinite(parsed) ? parsed : 192, 32, 1024);
  const maskable = searchParams.get('maskable') === '1';
  const apple = searchParams.get('apple') === '1';
  const response = createHillaIconResponse({ size, maskable, apple });
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return response;
}
