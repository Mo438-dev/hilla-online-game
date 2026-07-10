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
