# حُلّة analytics schema

One line per table and column. Everything is written by server routes with the service role; the
browser never reads or writes these tables directly. Device info is coarse only (platform family,
home-screen app or browser, UI language). Added in delta-14 is marked **(14)**.

## game_sessions — one row per game
- `id` — the game id (`game.analyticsId`), shared by every client in the game.
- `room_code` — online room code; null for same-device games.
- `ruleset_version` — rules the game was dealt under (e.g. `v2.3`).
- `started_at` / `ended_at` — server times of the start and the finish report.
- `duration_seconds` — server-measured length.
- `player_count` / `human_count` / `bot_count` — seats at the table.
- `winner_player_id` / `winner_name` / `winner_is_bot` — who emptied their hand.
- `total_turns` / `total_rounds` — turns played; rounds estimated from turns.
- `completed` — true once a winner was reported.
- `created_at` — row creation time.
- `mode` **(14)** — `online` or `local`.
- `cards_per_player` **(14)** — hand size dealt.
- `ended_reason` **(14)** — `win`; `abandoned` is set by the daily cron for games not finished within a day; `everyone_left` is reserved (not detected yet).
- `duration_ms` **(14)** — game length in ms (the game's own start/end; server time as fallback).
- `coord_rounds` **(14)** — coordination cards drawn during the game.
- `app_build` **(14)** — deployed commit (first 12 chars).

## game_players — one row per seat per game
- `id` — row id.
- `game_id` — the game.
- `player_id` — the seat id inside the game.
- `player_name` — the name typed for the room.
- `is_bot` — bot seat.
- `won` — emptied their hand.
- `created_at` — row creation time.
- `user_id` — the account on that seat (online, with an account); filled when results are written.
- `seat` **(14)** — seat order (0 = first to play).
- `place` **(14)** — finishing place by cards left (ties share).
- `cards_left` **(14)** — cards still in hand at the end.
- `items_played` **(14)** — clothing cards played (totalled from `items_played` events).
- `rares_played` **(14)** — rare clothing cards played.
- `actions_played` **(14)** — action cards played, by type, e.g. `{"drawTwo":1,"freeze":2}`.
- `blocks_used` **(14)** — «لا ما تقدر» used to cancel someone's action.
- `times_targeted` **(14)** — actions aimed at this seat (landed or blocked).
- `missed_turns` **(14)** — turns skipped for not playing in time.
- `became_inactive` **(14)** — marked inactive (😴) during the game.
- `premoves_set` **(14)** — premove cards picked on this phone.
- `premoves_played` **(14)** — premoves played at turn start.
- `reactions_sent` **(14)** — emoji reactions sent.
- `platform` **(14)** — `ios`, `android` or `desktop`.
- `standalone` **(14)** — playing from the home-screen app (true) or a browser (false).
- `lang` **(14)** — UI language: `ar`, `en`, `es`.

## game_events — raw, append-only events (unique `event_id`)
- `id` / `event_id` — row id / client-made idempotency key.
- `game_id` — the game (null for the few app events outside a game).
- `room_code` — online room code.
- `player_id` / `player_name` / `is_bot` — who did it.
- `event_type` — see the list below.
- `turn_number` / `round_number` — when in the game.
- `coord_type` / `coord_region` / `coord_item_count` — the coordination card in play.
- `cards_played_count` — cards involved (items played, cards received, premove size).
- `items` — item cards involved (name/region/rarity/card id).
- `action_type` — action card type.
- `skip_reason` — `timeout` or `timeout_inactive`.
- `payload` — small allowlisted extras per event type.
- `created_at` — server insert time.

Event types: `game_started`, `game_finished`, `player_joined`, `turn_started`, `items_played`,
`action_played`, `block_used`, `turn_skipped`, `coord_changed`, `bot_move`, `winner_declared`,
`deal_snapshot`, `end_snapshot`, `player_identity`, `state_rejected`, `auth_rate_limited`, and **(14)**:
- `premove_set` / `premove_played` / `premove_cancelled` (payload `reason`: `card_left_hand` | `no_longer_fits`).
- `cards_received` — cards arrived from someone's action (payload `kind`: `drawTwo` | `stealTwo` | `giveTakeGot` | `giveTakeTook`).
- `duel_opened` — head-to-head opened (payload `source`: `leaderboard` | `win`).
- `share_clicked` — result shared (payload `source`: `win`).
- `resume_shown` / `resume_tapped` — the «كمّل لعبتك» pill (room code).
- `leaderboard_opened` — leaderboard screen opened.
- `username_set` — a username was saved.
- `survey_step` — one survey step (payload `step` 0–3, `how`: `answered` | `skipped`).

## game_feedback — the end-of-game survey (one per seat per game)
- `id` — row id.
- `game_id` — the game (this is the session id).
- `player_id` — the seat.
- `client_pid` — random per-browser id (returning vs new, nothing personal).
- `fun` — 1–5.
- `clarity` — 1–5 (rules were clear).
- `play_again` — yes/no.
- `comment` — optional, up to 280 chars.
- `created_at` — when answered.
- `steps_answered` **(14)** — how many of the 4 steps were answered.
- `skipped_at_step` **(14)** — the step where they pressed «تخطي» (null if they finished).

## profiles — one per account (guest or saved)
- `user_id` — the account.
- `nickname` — display name («اسمك», 2–16 chars, can repeat since delta-14).
- `nickname_key` — normalised display name, used for lookups (no longer unique).
- `nickname_changed_at` — last name change.
- `hidden` — hidden from the leaderboard (reports).
- `created_at` — row creation time.
- `username` **(14)** — unique English handle (@…), 3–15 chars, lowercase.
- `username_changed_at` **(14)** — last handle change (one change per 30 days).
- `created_platform` / `created_standalone` **(14)** — device of the first profile write.
- `first_game_at` **(14)** — when the first result was written.
- `last_seen_at` **(14)** — last app open with a signed-in guest or account.
- `merged_into` **(14)** — reserved: merged guests are currently deleted, so it stays empty.

## game_results — leaderboard results (server-written)
- `game_id` / `room_code` / `user_id` — the game and the account.
- `place` / `humans` / `total_players` / `cards_left` / `beaten` / `won` / `finished` — the outcome.
- `points` — points earned (summed only when counted).
- `counted` / `reason` — whether it counts, and why not (`same_group_cap`, `daily_cap`, `too_short`, `too_few_turns`, `too_few_humans`, `integrity`).
- `group_key` — the set of players, for the same-group daily cap.
- `duration_ms` / `turns` / `ruleset_version` / `finished_at` — game length and rules.

## client_errors **(14)** — uncaught errors from players' devices
- `id` / `created_at` — row id and time (kept 90 days).
- `session_id` — the game being played, if any.
- `user_id` — the account, if signed in.
- `app_build` — deployed commit.
- `platform` / `standalone` — coarse device info.
- `message` — error message (≤500 chars).
- `stack` — stack trace (≤2000 chars).
- `url_path` — page path.
