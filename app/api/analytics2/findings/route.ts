export const dynamic = 'force-dynamic';

import { isAdmin, json } from '@/lib/analytics/data';
import { buildFindings } from '@/lib/analytics/build';

// GET /api/analytics2/findings?version=v2.3&humans=1 → الخلاصة cards, built on the server from the cells.
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    return json(await buildFindings(url.searchParams.get('version') || 'v2.3', url.searchParams.get('humans') === '1'));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}
