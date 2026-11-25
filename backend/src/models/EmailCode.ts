import mongoose, { Schema, Document } from 'mongoose';

export type EmailCodePurpose = 'reset' | 'verify';

/**
 * A one-time code sent by email. Only an HMAC of the code is stored, so a
 * database leak doesn't expose usable codes. Documents delete themselves
 * (TTL index) once expired.
 */
export interface IEmailCode extends Document {
  email: string;
  purpose: EmailCodePurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  sentAt: Date;   // last time a code was emailed (resend limit)
}

const EmailCodeSchema = new Schema<IEmailCode>(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    purpose:   { type: String, enum: ['reset', 'verify'], required: true },
    codeHash:  { type: String, required: true },
    attempts:  { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    sentAt:    { type: Date, required: true },
  }
);

EmailCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });
EmailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IEmailCode>('EmailCode', EmailCodeSchema);
