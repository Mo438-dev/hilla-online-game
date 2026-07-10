# HANDOFF

## 1. Purpose and Architecture
- Project purpose: standalone browser-based Arabic multiplayer game "حِلّة" built with Next.js + TypeScript.
- UI/gameplay lives primarily in `app/HillaGame.tsx` as a client component.
- Backend storage for online rooms is handled by Next.js API routes backed by Supabase.
- Online sync currently uses client polling, not WebSockets.

## 2. Local Project Path
- `/Users/muhammed/hilla-online-game`

## 3. GitHub Repository
- `https://github.com/Mo438-dev/hilla-online-game.git`

## 4. Vercel Deployment Setup
- Framework: Next.js
- Build command: `npm run build`
- Start command for local testing: `npm run dev -- --port 3001`
- Import the GitHub repo into Vercel and add the required environment variables in project settings.

## 5. Supabase Setup and Table Structure
- Supabase SQL setup file: `supabase/schema.sql`
- Main table: `public.hilla_rooms`
- Columns:
  - `code text primary key`
  - `host_id text not null`
  - `per_player integer not null`
  - `max_players integer not null`
  - `started boolean not null default false`
  - `lobby jsonb not null default '[]'::jsonb`
  - `game jsonb`
  - `expires_at timestamptz not null default (now() + interval '24 hours')`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Includes an `updated_at` trigger and an RLS policy for service-role access.

## 6. Required Environment Variable Names
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 7. Current API Routes
- `POST /api/rooms`
  - Creates a room.
- `GET /api/rooms/[code]`
  - Reads a room by code.
- `PUT /api/rooms/[code]`
  - Updates a room document.
- `POST /api/rooms/[code]/join`
  - Joins a room.

## 8. How Online Room Polling Works
- `OnlineFlow` in `app/HillaGame.tsx` polls `GET /api/rooms/[code]` every 1500 ms.
- Client stores local `room`, `roomCode`, `myId`, and `onlinePhase` in component state.
- Host creates room, guest joins room, both clients keep polling to receive fresh room state.
- Game actions currently save full room/game documents through API requests.

## 9. Recent Stale-Cache Fix
- File changed: `app/api/rooms/[code]/route.ts`
- Fix applied:
  - `export const dynamic = 'force-dynamic'`
  - `export const revalidate = 0`
  - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- Reason: the deployed GET room route was serving stale cached lobby data even when Supabase had the correct row.

## 10. Current Known Issue
- Refreshing the page loses the player session and returns the user to home.
- Cause: `myId`, `roomCode`, `onlinePhase`, and player identity are only held in React state and are regenerated/reset on reload.

## 11. Recommended Refresh Persistence Using localStorage
- Preserve only session metadata, not gameplay rules/UI.
- Recommended keys:
  - `hilla_player_id`
  - `hilla_player_name`
  - `hilla_room_code`
  - `hilla_online_phase`
- On first load of online mode:
  - restore `myId`, `myName`, and `roomCode` from `localStorage`
  - if `roomCode` exists, call `GET /api/rooms/[code]`
  - if the player is still in the room lobby/game, restore `onlinePhase` to `lobby` or `play`
  - if room is missing or expired, clear stored session keys safely
- Keep this implementation client-side in `app/HillaGame.tsx`
- Do not alter game rules, cards, or visual design.

## 12. Commands to Run Locally
- Install dependencies:
  - `npm install`
- Start dev server:
  - `npm run dev -- --port 3001`
- Production build:
  - `npm run build`

## 13. Build and Deployment Workflow
- Local verification:
  - `npm run build`
  - optionally run `npm run dev -- --port 3001`
- Commit to `main`
- Push to GitHub:
  - `git push origin main`
- Vercel auto-redeploys from `main`
- After deploy, verify:
  - create room
  - join room from second browser session
  - both see `2/6`
  - host starts game
  - both enter game
  - moves remain synchronized through polling

## 14. Files That Must Not Be Modified Outside This Repo
- Work only inside `/Users/muhammed/hilla-online-game`
- Do not modify anything in `/Users/muhammed/qcf-mushaf-viewer`
- Do not touch the original Mushaf viewer project for this game work.
