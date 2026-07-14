// Single source of truth for the ruleset version tag stored on every
// game_sessions row. Bump this manually whenever a balance change ships
// (item count per coord card, random/region ratio, rarity copy counts,
// action card strength, turn rules, ...) so games can be compared with
// `group by ruleset_version` instead of guessing from dates.
export const RULESET_VERSION = 'v1';

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
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
