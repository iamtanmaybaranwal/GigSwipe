// Sends transactional email (OTP codes).
//
// Configure in backend/.env:
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=<16-letter Gmail app password>
//   SMTP_FROM=GigSwipe <you@gmail.com>
// Optional for a non-Gmail provider (Brevo, Resend, Zoho…): SMTP_HOST, SMTP_PORT.
//
// Without SMTP settings (local dev / tests) emails are not sent: they're kept in
// `devOutbox` and the code is printed to the console instead.
import nodemailer, { type Transporter } from 'nodemailer';

export interface OutgoingMail { to: string; subject: string; text: string; html: string }
export const devOutbox: OutgoingMail[] = [];

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, '');
  if (!user || !pass) {
    transporter = null;
    return null;
  }
  const host = process.env.SMTP_HOST?.trim();
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
      })
    : nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return transporter;
}

export const mailConfigured = () => getTransporter() !== null;

export async function sendMail(mail: OutgoingMail) {
  const t = getTransporter();
  if (!t) {
    devOutbox.push(mail);
    if (devOutbox.length > 50) devOutbox.shift();
    if (process.env.NODE_ENV !== 'test') console.log(`[mail:dev] to=${mail.to} subject="${mail.subject}"`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...mail });
}

type Lang = 'en' | 'hi';
type Purpose = 'reset' | 'verify';

const COPY: Record<Lang, Record<Purpose, { subject: string; intro: string }> & { expires: string; ignore: string }> = {
  en: {
    reset: { subject: 'Your GigSwipe password reset code: {code}', intro: 'Use this code to reset your GigSwipe password:' },
    verify: { subject: 'Your GigSwipe verification code: {code}', intro: 'Use this code to verify your email on GigSwipe:' },
    expires: 'The code expires in 10 minutes.',
    ignore: "If you didn't ask for this, you can ignore this email. Never share this code with anyone.",
  },
  hi: {
    reset: { subject: 'GigSwipe पासवर्ड रीसेट कोड: {code}', intro: 'अपना GigSwipe पासवर्ड बदलने के लिए यह कोड डालें:' },
    verify: { subject: 'GigSwipe वेरिफ़िकेशन कोड: {code}', intro: 'GigSwipe पर अपना ईमेल वेरिफ़ाई करने के लिए यह कोड डालें:' },
    expires: 'यह कोड 10 मिनट में खत्म हो जाएगा।',
    ignore: 'अगर आपने यह नहीं माँगा था, तो इस ईमेल को अनदेखा करें। यह कोड किसी के साथ शेयर न करें।',
  },
};

/** The email that carries a one-time code. */
export function codeEmail(to: string, code: string, purpose: Purpose, lang: string | undefined): OutgoingMail {
  const c = COPY[lang === 'hi' ? 'hi' : 'en'];
  const p = c[purpose];
  const subject = p.subject.replace('{code}', code);
  const text = `${p.intro}\n\n${code}\n\n${c.expires}\n${c.ignore}\n\n— GigSwipe`;
  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:440px;background:#fff;border-radius:16px;border:1px solid #E2E8F0" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 8px"><div style="font-size:22px;font-weight:800;color:#FF5864">GigSwipe</div></td></tr>
<tr><td style="padding:8px 28px;font-size:15px;line-height:22px">${p.intro}</td></tr>
<tr><td style="padding:16px 28px"><div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#FFF1F2;color:#0F172A;border-radius:12px;padding:16px;text-align:center">${code}</div></td></tr>
<tr><td style="padding:4px 28px 28px;font-size:13px;line-height:19px;color:#64748B">${c.expires}<br/>${c.ignore}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}
