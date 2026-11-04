import { redirect } from 'next/navigation';

// The old dashboard lives next to the new page, so it keeps the same admin gate.
export default function LegacyRedirect() {
  redirect('/admin/analytics/legacy');
}
