// One-time email codes for "forgot password" and "verify email".
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import EmailCodeModel, { type EmailCodePurpose } from '../models/EmailCode';
import { HttpError } from '../utils/http';
import { codeEmail, sendMail } from './mailer';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_AFTER_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

const hash = (email: string, purpose: string, code: string) =>
  createHmac('sha256', process.env.JWT_SECRET ?? 'gigswipe').update(`${purpose}:${email}:${code}`).digest('hex');

/**
 * Creates a fresh 6-digit code (replacing any older one) and emails it.
 * Throws 429 if a code was sent less than a minute ago.
 */
export async function issueCode(email: string, purpose: EmailCodePurpose, lang?: string) {
  const existing = await EmailCodeModel.findOne({ email, purpose });
  if (existing && Date.now() - existing.sentAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (Date.now() - existing.sentAt.getTime())) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before asking for a new code.`);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await EmailCodeModel.findOneAndUpdate(
    { email, purpose },
    { codeHash: hash(email, purpose, code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), sentAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
  try {
    await sendMail(codeEmail(email, code, purpose, lang));
  } catch (err) {
    console.error('[mail] failed to send code:', (err as Error).message);
    await EmailCodeModel.deleteOne({ email, purpose });
    throw new HttpError(502, "We couldn't send the email right now. Please try again in a minute.");
  }
}

/** Checks a code; on success the code is used up. Throws a friendly 400 otherwise. */
export async function consumeCode(email: string, purpose: EmailCodePurpose, code: string) {
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Please enter the 6-digit code.');
  const doc = await EmailCodeModel.findOne({ email, purpose });
  if (!doc || doc.expiresAt < new Date()) {
    if (doc) await doc.deleteOne();
    throw new HttpError(400, 'This code has expired. Please ask for a new one.');
  }
  const a = Buffer.from(doc.codeHash, 'hex');
  const b = Buffer.from(hash(email, purpose, code), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    doc.attempts += 1;
    if (doc.attempts >= MAX_ATTEMPTS) {
      await doc.deleteOne();
      throw new HttpError(400, 'Too many wrong codes. Please ask for a new one.');
    }
    await doc.save();
    const left = MAX_ATTEMPTS - doc.attempts;
    throw new HttpError(400, left === 1 ? 'Wrong code. 1 try left.' : `Wrong code. ${left} tries left.`);
  }
  await doc.deleteOne();
}
