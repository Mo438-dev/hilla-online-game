// Leaderboard nicknames (hulla-leaderboard-spec.md §6).

export const NICK_MIN = 2;
export const NICK_MAX = 16;
// Arabic letters (and Arabic-Indic digits), Latin letters, digits, spaces, _ and -.
const ALLOWED = /^[\p{Script=Arabic}A-Za-z0-9 _-]+$/u;

export function cleanNickname(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
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
  const n = [...nickname].length;
  if (n < NICK_MIN || n > NICK_MAX) return { ok: false, error: 'length' };
  if (!ALLOWED.test(nickname)) return { ok: false, error: 'chars' };
  const key = nicknameKey(nickname);
  if (key.length < NICK_MIN) return { ok: false, error: 'length' };
  if (BLOCKED.some((w) => key.includes(w))) return { ok: false, error: 'blocked' };
  return { ok: true, nickname, key };
}
