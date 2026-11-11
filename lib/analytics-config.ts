// Single source of truth for the ruleset version tag stored on every
// game_sessions row. Bump this manually whenever a balance change ships
// (item count per coord card, random/region ratio, rarity copy counts,
// action card strength, turn rules, ...) so games can be compared with
// `group by ruleset_version` instead of guessing from dates.
export const RULESET_VERSION = 'v2.3';

// Allowlisted analytics event types. Shared by the client emitter and the
// server-side validator.
export const ANALYTICS_EVENT_TYPES = [
  'game_started',
  'game_finished',
  'player_joined',
  'turn_started',
  'items_played',
  'action_played',
  'block_used',
  'turn_skipped',
  'coord_changed',
  'bot_move',
  'winner_declared',
  // V2 events
  'deal_snapshot', // all dealt cards at game start (no player attribution)
  'end_snapshot', // losers' remaining cards + final standings at game end
  'player_identity', // pseudonymous localStorage client_pid per human player
  // Leaderboard / integrity
  'state_rejected', // server refused a room save (written by the server, payload.reason)
  'auth_rate_limited', // anonymous sign-in hit Supabase's rate limit (no game, no personal data)
  // delta-14
  'premove_set',
  'premove_played',
  'premove_cancelled',
  'cards_received',
  'duel_opened',
  'share_clicked',
  'resume_shown',
  'resume_tapped',
  'leaderboard_opened',
  'username_set',
  'survey_step',
  // delta-15
  'card_entered', // an item card entered a seat's hand (payload cid, name, source, turn_number)
  // delta-16
  'rematch_opened', // first press of «العب من جديد» online opened the new room
  'rematch_joined', // a later press got the room someone else opened
  'rematch_failed', // a press that didn't land in a lobby (payload stage, status, error)
  // delta-18 (never an email or a provider id; method is google | email)
  'account_linked',
  'account_signin',
  'account_signout',
  'account_conflict',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
