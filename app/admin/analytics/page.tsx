export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { ADMIN_COOKIE, adminPasswordConfigured, isValidAdminToken } from '@/lib/admin-auth';
import AnalyticsApp from './AnalyticsApp';

// Same gate as the old dashboard. The page only reaches the browser after it; every number comes from
// the admin-only /api/analytics2 routes.
export default function AnalyticsPage({ searchParams }: { searchParams: { error?: string } }) {
  const configured = adminPasswordConfigured();
  if (configured && isValidAdminToken(cookies().get(ADMIN_COOKIE)?.value)) return <AnalyticsApp />;
  return (
    <div style={{ fontFamily: 'var(--font-plex), system-ui, sans-serif', maxWidth: 420, margin: '80px auto', padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>حُلّة · التحليلات</h1>
      {!configured ? (
        <p style={{ color: '#961E21' }}>ADMIN_ANALYTICS_PASSWORD is not configured on the server.</p>
      ) : (
        <form method="post" action="/api/analytics/admin-login" style={{ background: '#FCF3E2', border: '1px solid #D7CAA9', borderRadius: 12, padding: 16 }}>
          {searchParams.error && <p style={{ color: '#961E21', fontSize: 13, marginBottom: 8 }}>كلمة السر غلط.</p>}
          <input type="password" name="password" placeholder="كلمة السر" style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box' }} />
          <button type="submit" style={{ padding: '8px 16px' }}>دخول</button>
        </form>
      )}
    </div>
  );
}
