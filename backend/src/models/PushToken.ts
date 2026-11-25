import mongoose, { Schema, Document } from 'mongoose';

/**
 * Where to send push notifications for a user's device.
 * - android: a Firebase Cloud Messaging registration token
 * - web:     a Web Push subscription (endpoint + keys), used by the PWA on
 *            Android, iPhone (Home Screen app, iOS 16.4+), Windows and Mac
 */
export interface IPushToken extends Document {
  userId: mongoose.Types.ObjectId;
  platform: 'android' | 'web';
  token: string; // FCM token, or the Web Push endpoint URL (unique per device)
  keys?: { p256dh: string; auth: string };
  lang: 'en' | 'hi';
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema = new Schema<IPushToken>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['android', 'web'], required: true },
    token:    { type: String, required: true },
    keys:     { p256dh: String, auth: String },
    lang:     { type: String, enum: ['en', 'hi'], default: 'en' },
  },
  { timestamps: true }
);

PushTokenSchema.index({ token: 1 }, { unique: true });
PushTokenSchema.index({ userId: 1 });

export default mongoose.model<IPushToken>('PushToken', PushTokenSchema);
