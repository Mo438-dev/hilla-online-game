import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — حُلّة',
  description: 'وش نحفظ في حُلّة وليش · What Hulla stores and why'
};

// Public, static privacy policy (Google sign-in needs one). Always the light look, whatever theme
// the player picked in the game. Arabic first, English below.
const INK = '#231F20';
const BRAND = '#85152D';
const GOLD = '#DDAD55';
const CREAM = '#FCF3E2';

const page: React.CSSProperties = {
  minHeight: '100vh',
  background:
    '#F3E9D2 linear-gradient(135deg, #c9a2270d 25%, transparent 25%) 20px 0 / 40px 40px, linear-gradient(225deg, #c9a2270d 25%, transparent 25%) 20px 0 / 40px 40px',
  color: INK,
  padding: '32px 16px 48px',
  colorScheme: 'light'
};
const card: React.CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  background: CREAM,
  borderRadius: 24,
  boxShadow: `0 0 0 2px ${GOLD}, 0 18px 40px -18px rgba(60,30,10,.45)`,
  padding: '28px 22px'
};
const h1: React.CSSProperties = { fontFamily: 'var(--font-markazi), "Markazi Text", serif', fontWeight: 700, fontSize: 36, lineHeight: 1.15, color: BRAND, margin: 0 };
const h2: React.CSSProperties = { fontWeight: 700, fontSize: 17, color: BRAND, margin: '22px 0 6px' };
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, margin: '6px 0' };
const meta: React.CSSProperties = { fontSize: 13, color: '#231F2099', margin: '6px 0 14px' };
const ul: React.CSSProperties = { fontSize: 15, lineHeight: 1.8, margin: '4px 0', paddingInlineStart: 22 };
const mail = 'hulla-support@googlegroups.com';

export default function PrivacyPage() {
  return (
    <main style={{ ...page, fontFamily: 'var(--font-plex), "IBM Plex Sans Arabic", system-ui, sans-serif' }}>
      <article dir="rtl" lang="ar" style={card}>
        <h1 style={h1}>سياسة الخصوصية — حُلّة</h1>
        <p style={meta}>آخر تحديث: ١٠ نوفمبر ٢٠٢٦</p>
        <p style={p}>حُلّة لعبة ورق عن الأزياء السعودية التقليدية. هذي الصفحة توضح وش نحفظ وليش.</p>

        <h2 style={h2}>وش نحفظ</h2>
        <ul style={ul}>
          <li>حساب مجهول يُنشأ تلقائيًا أول ما تفتح اللعبة، عشان نحفظ مبارياتك.</li>
          <li>الاسم أو اسم المستخدم اللي تختاره، ويظهر للاعبين الثانيين وفي الترتيب.</li>
          <li>نتائج مبارياتك وحالة الغرف اللي تلعب فيها.</li>
          <li>إذا سجّلت بقوقل أو بالإيميل: عنوان إيميلك، نستخدمه بس لتسجيل دخولك وإرسال رمز الدخول. ما يظهر لأي لاعب.</li>
          <li>إحصاءات استخدام عامة (مثل نوع الجهاز والمتصفح بشكل تقريبي، ومدة المباريات) عشان نحسن اللعبة. ما نحفظ عنوان IP ولا بصمة الجهاز في هالإحصاءات.</li>
        </ul>

        <h2 style={h2}>وش ما نسويه</h2>
        <ul style={ul}>
          <li>ما نبيع بياناتك ولا نشاركها لأغراض إعلانية.</li>
          <li>ما نعرض إعلانات.</li>
        </ul>

        <h2 style={h2}>خدمات نعتمد عليها</h2>
        <p style={p}>
          نستضيف اللعبة على Vercel، ونحفظ البيانات في Supabase، ونرسل إيميلات رمز الدخول عبر Resend، وتسجيل الدخول بقوقل يتم عبر Google. هالخدمات تعالج البيانات اللازمة لتشغيل اللعبة فقط.
        </p>

        <h2 style={h2}>حذف بياناتك</h2>
        <p style={p}>
          تقدر تطلب حذف حسابك وبياناتك بمراسلتنا على{' '}
          <a href={`mailto:${mail}`} dir="ltr" style={{ color: BRAND, fontWeight: 600 }}>
            {mail}
          </a>
          .
        </p>

        <h2 style={h2}>الأطفال</h2>
        <p style={p}>اللعبة موجهة للعموم وما نجمع بيانات عن قصد من أطفال دون ١٣ سنة.</p>
      </article>

      <article dir="ltr" lang="en" style={{ ...card, marginTop: 20 }}>
        <h1 style={h1}>Privacy Policy — Hulla</h1>
        <p style={meta}>Last updated: November 10, 2026</p>
        <p style={p}>Hulla is a card game about traditional Saudi clothing. This page explains what we store and why.</p>

        <h2 style={h2}>What we store</h2>
        <ul style={ul}>
          <li>An anonymous account created automatically when you first open the game, so your games are saved.</li>
          <li>The name or username you choose, which other players and the leaderboard can see.</li>
          <li>Your game results and the state of rooms you play in.</li>
          <li>If you sign in with Google or email: your email address, used only to sign you in and send your sign-in code. It is never shown to other players.</li>
          <li>General usage statistics (approximate device and browser type, game length) to improve the game. We do not store IP addresses or device fingerprints in these statistics.</li>
        </ul>

        <h2 style={h2}>What we don&apos;t do</h2>
        <ul style={ul}>
          <li>We don&apos;t sell your data or share it for advertising.</li>
          <li>We don&apos;t show ads.</li>
        </ul>

        <h2 style={h2}>Services we use</h2>
        <p style={p}>
          The game is hosted on Vercel, data is stored in Supabase, sign-in emails are sent through Resend, and Google sign-in goes through Google. These services process only what is needed to run the game.
        </p>

        <h2 style={h2}>Deleting your data</h2>
        <p style={p}>
          You can ask us to delete your account and data by emailing{' '}
          <a href={`mailto:${mail}`} style={{ color: BRAND, fontWeight: 600 }}>
            {mail}
          </a>
          .
        </p>

        <h2 style={h2}>Children</h2>
        <p style={p}>The game is for a general audience, and we don&apos;t knowingly collect data from children under 13.</p>
      </article>
    </main>
  );
}
