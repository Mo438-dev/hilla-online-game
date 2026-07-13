# Hilla Online Game

Standalone Next.js + TypeScript project for the Hilla online multiplayer game.

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

- `NEXT_PUBLIC_SUPABASE_URL` is your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` is used only on the server-side API routes.

## Supabase Setup

Run the SQL in `supabase/schema.sql` inside the Supabase SQL Editor.

This creates:
- `public.hilla_rooms`
- a trigger to update `updated_at`
- an RLS policy that allows only the service role to manage rooms
- an index on `expires_at`

## Room Expiration

- Each room expires 24 hours after creation.
- Expired rooms are treated as missing by the API.
- The API deletes expired rooms opportunistically when they are accessed.

## Local Run

```bash
npm install
npm run dev -- --port 3001
```

Then open [http://localhost:3001](http://localhost:3001).

## Production Notes

- This app uses polling against Next.js API routes.
- For Vercel deployment, add the same two environment variables in the Vercel project settings.
- Because the API routes use the service role key, never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Analytics

The game records raw gameplay events so balance can be analyzed (which
regions/rarities are hard to unload, skip rates, action-card strength, game
pace, ...).

### Setup

1. Run the SQL in `supabase/analytics-schema.sql` in the Supabase SQL editor.
   This creates `game_sessions`, `game_players`, `game_events` (RLS-protected,
   server-only) and the `analytics_*` views.
2. Set `ADMIN_ANALYTICS_PASSWORD` in `.env.local` and in the Vercel project
   settings (see `.env.example`). Without it the dashboard denies all access.
3. Open `/admin/analytics` and sign in with that password.

Until step 1 is done, gameplay is unaffected: analytics writes fail silently
server-side (a sanitized `[analytics] ...` line in the server log) and the
dashboard shows a setup warning.

### How it works

- The browser sends events to `POST /api/analytics/events` and
  `POST /api/analytics/games` (fire-and-forget). Only those routes touch the
  analytics tables, using the service role key server-side.
- `game_events` is append-only and is the single source of truth. Every
  aggregate (turns, skips, cards per play, rarity unload rates, ...) is
  computed by the `analytics_*` SQL views — there are no app-maintained
  counters. If view queries ever get slow, convert hot views to materialized
  views refreshed on a schedule; do not add counter columns.
- Every event has a deterministic `event_id`; duplicates (retries, multiple
  clients) collapse into one row.
- `ruleset_version` is read from `RULESET_VERSION` in
  `lib/analytics-config.ts` when a game starts. Bump it whenever a balance
  change ships, then compare versions on the dashboard.
- Events never contain hands or hidden cards — the `items` payload lists only
  cards actually placed (name/region/rarity, all public on the card face).

### Privacy / anonymization

Player display names are stored as entered. To hash them in place later, run
in the SQL editor:

```sql
select public.analytics_anonymize_player_names();
```

### Retention plan (not automated yet)

Raw events are kept indefinitely for now. Suggested policy once volume grows:
review yearly; export `game_events` older than 12 months to CSV, then delete
those rows (sessions/players rows are tiny — keep them). Example cleanup, run
manually after exporting:

```sql
delete from public.game_events where created_at < now() - interval '12 months';
```

Do not schedule automatic deletion until an export routine exists.
