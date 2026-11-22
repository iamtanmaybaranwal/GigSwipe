import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'worker' | 'business';

export interface IUser extends Document {
  email: string;
  role: UserRole;
  name: string;
  avatarColor?: string;
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
  // Shared: comfortable working range (both roles)
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}

const UserSchema = new Schema<IUser>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    role:         { type: String, enum: ['worker', 'business'], required: true },
    name:         { type: String, required: true, trim: true },
    avatarColor:  { type: String },
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
    // Shared: comfortable working range (both roles)
    locationLabel: { type: String, trim: true },
    latitude:       { type: Number },
    longitude:      { type: Number },
    radiusMiles:    { type: Number },
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

export default mongoose.model<IUser>('User', UserSchema);
