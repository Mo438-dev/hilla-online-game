export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminTokenFor, isValidAdminPassword } from '@/lib/admin-auth';

// Login/logout for the private analytics dashboard. Sets an httpOnly cookie
// containing sha256(ADMIN_ANALYTICS_PASSWORD) — no secrets are ever sent to
// the client in readable form and no Supabase credential is involved.
export async function POST(request: Request) {
  const url = new URL('/admin/analytics', request.url);
  try {
    const form = await request.formData();
    const intent = form.get('intent');
    if (intent === 'logout') {
      const res = NextResponse.redirect(url, 303);
      res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 0 });
      return res;
    }
    const password = form.get('password');
    if (typeof password === 'string' && isValidAdminPassword(password)) {
      const res = NextResponse.redirect(url, 303);
      res.cookies.set(ADMIN_COOKIE, adminTokenFor(password), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }
  } catch {
    /* fall through to error redirect */
  }
  url.searchParams.set('error', '1');
  return NextResponse.redirect(url, 303);
}
