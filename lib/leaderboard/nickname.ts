// Leaderboard nicknames (hulla-leaderboard-spec.md §6).

export const NICK_MIN = 2;
export const NICK_MAX = 16;
// Arabic and Latin letters, digits, spaces, punctuation and symbols, and emoji (with the joiners,
// variation selectors, skin tones and flag tags emoji are made of).
const ALLOWED = /^[\p{Script=Arabic}\p{Script=Latin}\p{Nd}\p{P}\p{S}\p{Extended_Pictographic}\p{Emoji_Component}\u200D\uFE0F\u{E0020}-\u{E007F} ]+$/u;
// Invisible / control characters are stripped, except the ones emoji need (ZWJ, variation
// selectors, flag tags).
const INVISIBLE = /[\p{Cc}\u00AD\u061C\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

export function cleanNickname(v: string): string {
  return v.replace(INVISIBLE, '').trim().replace(/\s+/g, ' ');
}

// Length as the eye sees it: 🇸🇦 or 👨‍👩‍👧 is one character.
const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function nickLength(v: string): number {
  return segmenter ? [...segmenter.segment(v)].length : [...v].length;
}

// The form used for uniqueness and the word filter, so near-duplicates collide: tashkeel and
// tatweel stripped, أ/إ/آ → ا, ى → ي, Latin lower-cased, spaces/_/- removed.
export function nicknameKey(v: string): string {
  return cleanNickname(v)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

// Kept short on purpose: extend it as reports come in. Checked as substrings of the normalised key.
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigga', 'nigger', 'whore', 'slut', 'porn',
  'admin', 'support',
  'كلب', 'حمار', 'حيوان', 'زق', 'خرا', 'شرموط', 'قحب', 'منيوك', 'نيك', 'طيز', 'لوطي', 'ديوث', 'عرص', 'سكس'
].map(nicknameKey);

export type NickCheck = { ok: true; nickname: string; key: string } | { ok: false; error: 'length' | 'chars' | 'blocked' };

export function validateNickname(raw: unknown): NickCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'length' };
  const nickname = cleanNickname(raw);
  const n = nickLength(nickname);
  if (n < NICK_MIN || n > NICK_MAX) return { ok: false, error: 'length' };
  // nothing visible (only joiners / variation selectors): not a name
  if (!nickname.replace(/[\s\u200D\uFE0F\u{E0020}-\u{E007F}]/gu, '')) return { ok: false, error: 'length' };
  if (!ALLOWED.test(nickname)) return { ok: false, error: 'chars' };
  const key = nicknameKey(nickname);
  if (nickLength(key) < 1) return { ok: false, error: 'length' };
  if (BLOCKED.some((w) => key.includes(w))) return { ok: false, error: 'blocked' };
  return { ok: true, nickname, key };
}
