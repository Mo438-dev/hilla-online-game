export const dynamic = 'force-dynamic';

import { isAdmin, json } from '@/lib/analytics/data';
import { buildRules } from '@/lib/analytics/build';

// GET /api/analytics2/rules?version=v2.3&humans=1 → { cells: { "2": Cell, … "6": Cell }, coverage, versions }
export async function GET(request: Request) {
  if (!(await isAdmin())) return json({ error: 'unauthorized' }, 401);
  try {
    const url = new URL(request.url);
    return json(await buildRules(url.searchParams.get('version') || 'v2.3', url.searchParams.get('humans') === '1'));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unknown_error' }, 500);
  }
}
