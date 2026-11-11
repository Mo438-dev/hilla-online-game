import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — حُلّة',
  description: 'وش نحفظ في حُلّة وليش · What Hulla stores and why',
  alternates: { canonical: '/privacy' }
};

// Public, static privacy policy (Google sign-in needs one). Follows the theme the player picked in
// the game (the layout script sets data-hilla-theme; the colours are the game's --h-* variables, and
// the page background is the body's, from globals.css).
// Arabic first, English below.
const mail = 'hulla-support@googlegroups.com';

const css = `
/* one background layer (the page's own) so the rug never shows a seam on a long page */
body { background: transparent !important; }
.pv { min-height: 100vh; color: var(--h-ink); font-family: var(--font-plex), "IBM Plex Sans Arabic", system-ui, sans-serif;
  padding: max(14px, env(safe-area-inset-top)) 16px max(40px, env(safe-area-inset-bottom)); }
.pv-bar { max-width: 720px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pv-back { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 999px; font-weight: 700; font-size: 14px;
  color: var(--h-ink); background: color-mix(in srgb, var(--h-surf) 92%, transparent); text-decoration: none;
  box-shadow: 0 0 0 1.5px #DDAD55, 0 6px 16px -8px rgba(60,30,10,.45); }
.pv-back:active { transform: scale(.97); }
.pv-mark { height: 34px; width: 74px; background: var(--h-brand-t);
  -webkit-mask: url(/hilla-art/wordmark.webp) center / contain no-repeat; mask: url(/hilla-art/wordmark.webp) center / contain no-repeat; }
.pv-hero { max-width: 720px; margin: 0 auto; text-align: center; padding: 6px 4px 18px; }
.pv-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px;
  background: #DDAD5533; color: var(--h-gold-t); }
.pv-h1 { font-family: var(--font-markazi), "Markazi Text", serif; font-weight: 700; font-size: 40px; line-height: 1.1; margin: 10px 0 6px; color: var(--h-brand-t); }
.pv-sub { font-size: 15px; line-height: 1.7; margin: 0 auto; max-width: 520px; color: color-mix(in srgb, var(--h-ink) 75%, transparent); }
.pv-date { font-size: 12px; margin-top: 8px; color: color-mix(in srgb, var(--h-ink) 55%, transparent); }
.pv-grid { max-width: 720px; margin: 0 auto; display: grid; gap: 12px; }
.pv-card { background: var(--h-surf); border-radius: 22px; padding: 18px 18px 16px;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, #DDAD55 70%, transparent), 0 14px 30px -18px rgba(60,30,10,.5); }
.pv-card h2 { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; margin: 0 0 8px; color: var(--h-brand-t); }
.pv-ic { width: 34px; height: 34px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: #DDAD5533; font-size: 17px; }
.pv-card p, .pv-card li { font-size: 15px; line-height: 1.8; margin: 0; }
.pv-card ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.pv-card li { position: relative; padding-inline-start: 18px; }
.pv-card li::before { content: ""; position: absolute; inset-inline-start: 2px; top: .75em; width: 7px; height: 7px; border-radius: 2px;
  background: #DDAD55; transform: rotate(45deg); }
.pv-mail { color: var(--h-brand-t); font-weight: 700; word-break: break-all; }
.pv-sep { max-width: 720px; margin: 30px auto 22px; display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700;
  color: color-mix(in srgb, var(--h-ink) 55%, transparent); }
.pv-sep::before, .pv-sep::after { content: ""; flex: 1; height: 1.5px; background: linear-gradient(90deg, transparent, #DDAD55, transparent); }
.pv-foot { max-width: 720px; margin: 26px auto 0; text-align: center; }
`;

type Section = { icon: string; title: string; items?: string[]; text?: React.ReactNode };

function Policy({ dir, lang, badge, title, sub, date, sections, back }: { dir: 'rtl' | 'ltr'; lang: string; badge: string; title: string; sub: string; date: string; sections: Section[]; back?: boolean }) {
  return (
    <section dir={dir} lang={lang}>
      <div className="pv-hero">
        <span className="pv-badge">{badge}</span>
        <h1 className="pv-h1">{title}</h1>
        <p className="pv-sub">{sub}</p>
        <div className="pv-date">{date}</div>
      </div>
      <div className="pv-grid">
        {sections.map((s) => (
          <article key={s.title} className="pv-card">
            <h2>
              <span className="pv-ic" aria-hidden="true">{s.icon}</span>
              {s.title}
            </h2>
            {s.items ? (
              <ul>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : (
              <p>{s.text}</p>
            )}
          </article>
        ))}
      </div>
      {back && (
        <div className="pv-foot">
          <a className="pv-back" href="/">{dir === 'rtl' ? '→ رجوع للعبة' : '← Back to the game'}</a>
        </div>
      )}
    </section>
  );
}

export default function PrivacyPage() {
  const mailLink = (
    <a className="pv-mail" href={`mailto:${mail}`} dir="ltr">
      {mail}
    </a>
  );
  return (
    <main className="pv">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pv-bar" dir="rtl">
        <a className="pv-back" href="/" aria-label="رجوع للعبة">
          <span aria-hidden="true">→</span> رجوع
        </a>
        <span className="pv-mark" role="img" aria-label="حُلّة" />
      </div>

      <Policy
        dir="rtl"
        lang="ar"
        badge="الخصوصية"
        title="سياسة الخصوصية — حُلّة"
        sub="حُلّة لعبة ورق عن الأزياء السعودية التقليدية. هذي الصفحة توضح وش نحفظ وليش."
        date="آخر تحديث: ١٠ نوفمبر ٢٠٢٦"
        sections={[
          {
            icon: '🗂️',
            title: 'وش نحفظ',
            items: [
              'حساب مجهول يُنشأ تلقائيًا أول ما تفتح اللعبة، عشان نحفظ مبارياتك.',
              'الاسم أو اسم المستخدم اللي تختاره، ويظهر للاعبين الثانيين وفي الترتيب.',
              'نتائج مبارياتك وحالة الغرف اللي تلعب فيها.',
              'إذا سجّلت بقوقل أو بالإيميل: عنوان إيميلك، نستخدمه بس لتسجيل دخولك وإرسال رمز الدخول. ما يظهر لأي لاعب.',
              'إحصاءات استخدام عامة (مثل نوع الجهاز والمتصفح بشكل تقريبي، ومدة المباريات) عشان نحسن اللعبة. ما نحفظ عنوان IP ولا بصمة الجهاز في هالإحصاءات.'
            ]
          },
          { icon: '🚫', title: 'وش ما نسويه', items: ['ما نبيع بياناتك ولا نشاركها لأغراض إعلانية.', 'ما نعرض إعلانات.'] },
          {
            icon: '🔗',
            title: 'خدمات نعتمد عليها',
            text: 'نستضيف اللعبة على Vercel، ونحفظ البيانات في Supabase، ونرسل إيميلات رمز الدخول عبر Resend، وتسجيل الدخول بقوقل يتم عبر Google. هالخدمات تعالج البيانات اللازمة لتشغيل اللعبة فقط.'
          },
          { icon: '🗑️', title: 'حذف بياناتك', text: <>تقدر تطلب حذف حسابك وبياناتك بمراسلتنا على {mailLink}.</> },
          { icon: '🧒', title: 'الأطفال', text: 'اللعبة موجهة للعموم وما نجمع بيانات عن قصد من أطفال دون ١٣ سنة.' }
        ]}
      />

      <div className="pv-sep">English</div>

      <Policy
        dir="ltr"
        lang="en"
        back
        badge="Privacy"
        title="Privacy Policy — Hulla"
        sub="Hulla is a card game about traditional Saudi clothing. This page explains what we store and why."
        date="Last updated: November 10, 2026"
        sections={[
          {
            icon: '🗂️',
            title: 'What we store',
            items: [
              'An anonymous account created automatically when you first open the game, so your games are saved.',
              'The name or username you choose, which other players and the leaderboard can see.',
              'Your game results and the state of rooms you play in.',
              'If you sign in with Google or email: your email address, used only to sign you in and send your sign-in code. It is never shown to other players.',
              'General usage statistics (approximate device and browser type, game length) to improve the game. We do not store IP addresses or device fingerprints in these statistics.'
            ]
          },
          { icon: '🚫', title: "What we don't do", items: ["We don't sell your data or share it for advertising.", "We don't show ads."] },
          {
            icon: '🔗',
            title: 'Services we use',
            text: 'The game is hosted on Vercel, data is stored in Supabase, sign-in emails are sent through Resend, and Google sign-in goes through Google. These services process only what is needed to run the game.'
          },
          { icon: '🗑️', title: 'Deleting your data', text: <>You can ask us to delete your account and data by emailing {mailLink}.</> },
          { icon: '🧒', title: 'Children', text: "The game is for a general audience, and we don't knowingly collect data from children under 13." }
        ]}
      />
    </main>
  );
}
