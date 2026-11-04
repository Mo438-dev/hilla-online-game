// Today's 32-item roster (same as the game). Region and rarity always come from here, never from the
// logged event, so old rows can't put an item in the wrong region.
export type Rarity = 'common' | 'medium' | 'rare';

export const ROSTER: Record<string, { name: string; items: Record<string, Rarity> }> = {
  najdi: { name: 'نجدي', items: { 'عقال': 'common', 'المخطم': 'rare', 'المخنق': 'medium', 'متفت': 'medium', 'دراعة': 'medium', 'رشرش': 'medium', 'بشت': 'medium', 'شماغ': 'medium' } },
  sharqi: { name: 'شرقي', items: { 'ثوب مرودن': 'common', 'قلادة': 'common', 'برقع أسود': 'common', 'دقلة': 'common', 'مقصب': 'medium', 'هامة': 'medium', 'نفنوف': 'medium', 'النشل': 'medium' } },
  janoubi: { name: 'جنوبي', items: { 'خواتم': 'common', 'مريشة': 'rare', 'جنبية': 'medium', 'خرص': 'medium', 'منديل برتقالي': 'medium', 'المجنب': 'medium', 'طفشة': 'medium', 'بيدي': 'medium' } },
  gharbi: { name: 'غربي', items: { 'غوايش': 'common', 'حلق': 'common', 'بيرم ومسفع': 'rare', 'برقع حجازي': 'rare', 'شاية': 'medium', 'ثوب مبقر': 'medium', 'ثوب الزبون': 'medium', 'مرتعشة': 'medium' } },
};

export const ITEM_ALIASES: Record<string, string> = {
  'مرودن': 'ثوب مرودن', 'مخنق': 'المخنق', 'المقصب': 'مقصب', 'المجنب العسيري': 'المجنب', 'مبقر': 'ثوب مبقر',
  'نشل': 'النشل', 'الزبون الغربي': 'ثوب الزبون', 'البرم والمسفع': 'بيرم ومسفع', 'المريشة': 'مريشة',
};
// Retired: they count in totals (turns, plays) but never appear in item tables, and are never merged.
export const RETIRED_ITEMS = new Set(['ثوب', 'برقع حرب']);
export const canonicalItem = (name: string) => ITEM_ALIASES[name] ?? name;

export const ITEM_INFO: Record<string, { region: string; rarity: Rarity }> = {};
for (const [region, r] of Object.entries(ROSTER)) {
  for (const [name, rarity] of Object.entries(r.items)) ITEM_INFO[name] = { region, rarity };
}
