import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'worker' | 'business';

/** When a job seeker is usually free. Stored as keys; the app shows the labels. */
export const AVAILABILITY_SLOTS = [
  'weekday_mornings', 'weekday_afternoons', 'weekday_evenings', 'weekends', 'nights', 'flexible',
] as const;

interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface IUser extends Document {
  email: string;
  emailVerified?: boolean;
  role: UserRole;
  name: string;
  avatarColor?: string;
  photoUrl?: string;
  passwordHash?: string;
  // Business-only fields
  businessName?: string;
  industry?: string;
  location?: string;
  website?: string;
  phone?: string;
  // Worker-only fields
  university?: string;
  major?: string;
  year?: string;
  skills?: string[];
  bio?: string;
  sampleWork?: string[];
  availability?: string[];
  availabilityNote?: string;
  availableUntil?: Date;  // "Available now" is on until this time
  discoverable?: boolean; // job givers can find this person in worker search
  // Shared: comfortable working range (both roles)
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  geo?: GeoPoint; // mirror of latitude/longitude for $geoNear (worker search)
}

const UserSchema = new Schema<IUser>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    role:         { type: String, enum: ['worker', 'business'], required: true },
    name:         { type: String, required: true, trim: true },
    avatarColor:  { type: String },
    photoUrl:     { type: String },
    passwordHash: { type: String, select: false }, // never returned by default; use .select('+passwordHash') when needed
    // Business fields
    businessName: { type: String, trim: true },
    industry:     { type: String, trim: true },
    location:     { type: String, trim: true },
    website:      { type: String, trim: true },
    phone:        { type: String, trim: true },
    // Worker fields
    university:   { type: String, trim: true },
    major:        { type: String, trim: true },
    year:         { type: String, trim: true },
    skills:       [{ type: String }],
    bio:          { type: String, trim: true },
    sampleWork:   [{ type: String }],
    availability: [{ type: String, enum: AVAILABILITY_SLOTS }],
    availabilityNote: { type: String, trim: true },
    availableUntil:   { type: Date },
    discoverable:     { type: Boolean, default: true },
    // Shared: comfortable working range (both roles)
    locationLabel: { type: String, trim: true },
    latitude:       { type: Number },
    longitude:      { type: Number },
    radiusMiles:    { type: Number },
    geo: {
      type:        { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash; // second layer of protection — never leak the hash
      },
    },
  }
);

UserSchema.index({ geo: '2dsphere' }, { sparse: true });
UserSchema.index({ role: 1, discoverable: 1 });

export default mongoose.model<IUser>('User', UserSchema);
