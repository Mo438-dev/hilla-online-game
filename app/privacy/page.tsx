import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — حُلّة',
  description: 'سياسة الخصوصية للعبة حُلّة · Hulla Privacy Policy',
  alternates: { canonical: '/privacy' }
};

// Public, static privacy policy (Google sign-in needs one). Formal wording, one document per
// language. Follows the theme the player picked in the game: the layout script sets
// data-hilla-theme and the colours are the game's --h-* variables. Arabic first, English below.
const mail = 'hulla-support@googlegroups.com';

const css = `
/* one background layer (the page's own) so the rug never shows a seam on a long page */
body { background: transparent !important; }
.pv { min-height: 100vh; color: var(--h-ink); font-family: var(--font-plex), "IBM Plex Sans Arabic", system-ui, sans-serif;
  padding: max(14px, env(safe-area-inset-top)) 16px max(44px, env(safe-area-inset-bottom)); }
.pv-bar { max-width: 760px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pv-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 999px; font-weight: 600; font-size: 14px;
  color: var(--h-ink); background: var(--h-surf); text-decoration: none; letter-spacing: .01em;
  box-shadow: 0 0 0 1px #B98A2E, 0 8px 18px -10px rgba(40,20,10,.5); }
.pv-btn:active { transform: scale(.97); }
.pv-lang { font-size: 13px; font-weight: 600; color: var(--h-gold-t); text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 1px; }
.pv-doc { max-width: 760px; margin: 0 auto; background: var(--h-surf); border-radius: 6px; padding: 10px;
  box-shadow: 0 0 0 1px #B98A2E, 0 30px 60px -30px rgba(40,20,10,.65); }
.pv-in { border: 1px solid color-mix(in srgb, #B98A2E 55%, transparent); border-radius: 2px; padding: 38px 26px 30px; position: relative; }
.pv-in::before, .pv-in::after { content: ""; position: absolute; width: 9px; height: 9px; background: #B98A2E; transform: rotate(45deg); top: -5px; }
.pv-in::before { inset-inline-start: 50%; margin-inline-start: -4.5px; }
.pv-in::after { top: auto; bottom: -5px; inset-inline-start: 50%; margin-inline-start: -4.5px; }
.pv-head { text-align: center; }
.pv-mark { display: block; margin: 0 auto 14px; height: 46px; width: 104px; background: var(--h-brand-t);
  -webkit-mask: url(/hilla-art/wordmark.webp) center / contain no-repeat; mask: url(/hilla-art/wordmark.webp) center / contain no-repeat; }
.pv-kicker { font-size: 11.5px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--h-gold-t); }
.pv-h1 { font-family: var(--font-markazi), "Markazi Text", serif; font-weight: 700; font-size: 44px; line-height: 1.1; margin: 8px 0 10px; color: var(--h-brand-t); }
.pv-date { font-size: 12.5px; color: color-mix(in srgb, var(--h-ink) 60%, transparent); }
.pv-orn { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 22px auto 24px; max-width: 280px; }
.pv-orn::before, .pv-orn::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #B98A2E); }
.pv-orn::after { background: linear-gradient(270deg, transparent, #B98A2E); }
.pv-orn i { width: 7px; height: 7px; background: #B98A2E; transform: rotate(45deg); display: block; }
.pv-orn i + i { width: 5px; height: 5px; opacity: .7; }
.pv-intro { font-size: 15.5px; line-height: 2; margin: 0 0 8px; text-align: start; }
.pv-sec { display: grid; grid-template-columns: 40px 1fr; gap: 0 14px; padding: 20px 0; border-top: 1px solid color-mix(in srgb, #B98A2E 30%, transparent); }
.pv-sec:first-of-type { border-top: none; }
.pv-num { font-family: var(--font-markazi), "Markazi Text", serif; font-size: 30px; line-height: 1; font-weight: 700; color: #B98A2E; padding-top: 2px; }
.pv-sec h2 { font-family: var(--font-markazi), "Markazi Text", serif; font-size: 25px; line-height: 1.2; font-weight: 700; margin: 0 0 8px; color: var(--h-brand-t); }
.pv-sec p, .pv-sec li { font-size: 15.5px; line-height: 1.95; margin: 0; text-align: start; }
.pv-sec ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.pv-sec li { position: relative; padding-inline-start: 18px; }
.pv-sec li::before { content: ""; position: absolute; inset-inline-start: 1px; top: .85em; width: 6px; height: 6px; background: #B98A2E; transform: rotate(45deg); }
.pv-mail { color: var(--h-brand-t); font-weight: 600; text-decoration: none; border-bottom: 1px solid color-mix(in srgb, currentColor 40%, transparent); word-break: break-all; }
.pv-gap { height: 26px; }
.pv-foot { text-align: center; margin-top: 26px; }
@media (max-width: 420px) {
  .pv-in { padding: 30px 16px 24px; }
  .pv-h1 { font-size: 36px; }
  .pv-sec { grid-template-columns: 30px 1fr; gap: 0 10px; }
  .pv-num { font-size: 25px; }
  .pv-sec h2 { font-size: 22px; }
}
`;

type Section = { title: string; items?: string[]; text?: React.ReactNode };

function Doc({ id, dir, lang, kicker, title, date, intro, sections, num }: { id: string; dir: 'rtl' | 'ltr'; lang: string; kicker: string; title: string; date: string; intro: string; sections: Section[]; num: (n: number) => string }) {
  return (
    <article id={id} dir={dir} lang={lang} className="pv-doc">
      <div className="pv-in">
        <header className="pv-head">
          <span className="pv-mark" role="img" aria-label="حُلّة" />
          <div className="pv-kicker">{kicker}</div>
          <h1 className="pv-h1">{title}</h1>
          <div className="pv-date">{date}</div>
        </header>
        <div className="pv-orn" aria-hidden="true">
          <i />
          <i />
        </div>
        <p className="pv-intro">{intro}</p>
        {sections.map((s, i) => (
          <section key={s.title} className="pv-sec">
            <div className="pv-num" aria-hidden="true">{num(i + 1)}</div>
            <div>
              <h2>{s.title}</h2>
              {s.items ? (
                <ul>
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              ) : (
                <p>{s.text}</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

const arNum = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export default function PrivacyPage() {
  const mailLink = (
    <a className="pv-mail" href={`mailto:${mail}`} dir="ltr">
      {mail}
    </a>
  );
  return (
    <main className="pv">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className="pv-bar" dir="rtl">
        <a className="pv-btn" href="/" aria-label="العودة إلى اللعبة">
          <span aria-hidden="true">→</span> العودة إلى اللعبة
        </a>
        <a className="pv-lang" href="#en" lang="en">
          English
        </a>
      </nav>

      <Doc
        id="ar"
        dir="rtl"
        lang="ar"
        num={arNum}
        kicker="حُلّة"
        title="سياسة الخصوصية"
        date="آخر تحديث: ١٠ نوفمبر ٢٠٢٦"
        intro="«حُلّة» لعبة ورق مستوحاة من الأزياء السعودية التقليدية. توضّح هذه السياسة البيانات التي نجمعها عند استخدامك للعبة، والغرض من جمعها، وكيفية التعامل معها."
        sections={[
          {
            title: 'البيانات التي نجمعها',
            items: [
              'حساب مجهول الهوية يُنشأ تلقائيًا عند فتح اللعبة لأول مرة، لحفظ سجل مبارياتك.',
              'الاسم واسم المستخدم اللذان تختارهما، ويظهران للاعبين الآخرين وفي لوحة الترتيب.',
              'نتائج مبارياتك وحالة الغرف التي تشارك فيها.',
              'عنوان بريدك الإلكتروني عند تسجيل الدخول عبر Google أو البريد الإلكتروني، ويُستخدم حصرًا للتحقق من هويتك وإرسال رمز الدخول، ولا يُعرض لأي لاعب.',
              'إحصاءات استخدام عامة، مثل نوع الجهاز والمتصفح على وجه التقريب ومدة المباريات، بهدف تحسين اللعبة. ولا تتضمن هذه الإحصاءات عنوان IP أو بصمة الجهاز.'
            ]
          },
          { title: 'ما لا نقوم به', items: ['لا نبيع بياناتك، ولا نشاركها لأي أغراض إعلانية.', 'لا نعرض أي إعلانات داخل اللعبة.'] },
          {
            title: 'مزوّدو الخدمة',
            text: 'تُستضاف اللعبة على Vercel، وتُحفظ البيانات لدى Supabase، وتُرسَل رسائل رمز الدخول عبر Resend، ويتم تسجيل الدخول بحساب Google عبر Google. ولا تعالج هذه الجهات إلا البيانات اللازمة لتشغيل اللعبة.'
          },
          { title: 'حذف البيانات', text: <>يحق لك طلب حذف حسابك وجميع بياناتك في أي وقت، بمراسلتنا على البريد الإلكتروني: {mailLink}</> },
          { title: 'خصوصية الأطفال', text: 'اللعبة موجّهة للجمهور العام، ولا نجمع عن علمٍ أي بيانات من الأطفال دون سن الثالثة عشرة.' },
          { title: 'تحديث هذه السياسة', text: <>قد نُحدّث هذه السياسة من وقت لآخر، ويُشار إلى تاريخ آخر تحديث أعلى هذه الصفحة. ولأي استفسار، يُرجى التواصل معنا على: {mailLink}</> }
        ]}
      />

      <div className="pv-gap" />

      <Doc
        id="en"
        dir="ltr"
        lang="en"
        num={String}
        kicker="Hulla"
        title="Privacy Policy"
        date="Last updated: November 10, 2026"
        intro="Hulla is a card game inspired by traditional Saudi clothing. This policy explains what data we collect when you use the game, why we collect it, and how it is handled."
        sections={[
          {
            title: 'Data we collect',
            items: [
              'An anonymous account, created automatically when you first open the game, so that your game history is saved.',
              'The name and username you choose, which are visible to other players and on the leaderboard.',
              'Your game results and the state of the rooms you take part in.',
              'Your email address, if you sign in with Google or by email. It is used solely to verify your identity and send your sign-in code, and is never shown to other players.',
              'General usage statistics, such as approximate device and browser type and game length, used to improve the game. These statistics do not include IP addresses or device fingerprints.'
            ]
          },
          { title: 'What we do not do', items: ['We do not sell your data or share it for advertising purposes.', 'We do not show advertisements in the game.'] },
          {
            title: 'Service providers',
            text: 'The game is hosted on Vercel, data is stored with Supabase, sign-in emails are sent through Resend, and Google sign-in is handled by Google. These providers process only the data necessary to operate the game.'
          },
          { title: 'Deleting your data', text: <>You may request the deletion of your account and all associated data at any time by writing to {mailLink}.</> },
          { title: "Children's privacy", text: 'The game is intended for a general audience. We do not knowingly collect data from children under the age of 13.' },
          { title: 'Changes to this policy', text: <>We may update this policy from time to time; the date of the latest update is shown at the top of this page. For any questions, please contact us at {mailLink}.</> }
        ]}
      />

      <div className="pv-foot" dir="rtl">
        <a className="pv-btn" href="/">
          <span aria-hidden="true">→</span> العودة إلى اللعبة
        </a>
      </div>
    </main>
  );
}
