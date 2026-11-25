import mongoose, { Schema, Document } from 'mongoose';

interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export type WorkMode = 'onsite' | 'remote';
export type PayUnit = 'hour' | 'day' | 'week' | 'month' | 'fixed';
/** open = taking applications · filled = every opening is hired · closed = closed by the job giver */
export type GigStatus = 'open' | 'filled' | 'closed';

export const PAY_UNITS: PayUnit[] = ['hour', 'day', 'week', 'month', 'fixed'];

export interface IGig extends Document {
  businessId: mongoose.Types.ObjectId;
  title: string;
  businessName: string;
  businessColor: string;
  businessPhotoUrl?: string;
  pay: string;          // display text, e.g. "₹800/day"
  payAmount?: number;   // numeric amount, used by the pay filter
  payUnit?: PayUnit;
  hours: string;        // free-text schedule notes, e.g. "Bring black shoes"
  startAt?: Date;       // when the work starts (optional: "flexible" gigs have none)
  endAt?: Date;         // when it ends; after this the gig expires from the feed
  openings: number;     // how many people are needed
  hiredCount: number;
  status: GigStatus;
  description: string;
  category: string;
  workMode: WorkMode;
  location: string; // human-readable label, e.g. "Downtown Seattle, WA" — only meaningful for onsite gigs
  geo?: GeoPoint;    // real coordinates, used for $geoNear queries — never set for remote gigs
  photos: string[];  // /api/uploads/<id> paths
  createdAt: Date;
  updatedAt: Date;
}

const GigSchema = new Schema<IGig>(
  {
    businessId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:         { type: String, required: true, trim: true },
    businessName:  { type: String, required: true, trim: true },
    businessColor: { type: String, default: '#7B61FF' },
    businessPhotoUrl: { type: String },
    pay:           { type: String, trim: true },
    payAmount:     { type: Number, min: 0 },
    payUnit:       { type: String, enum: PAY_UNITS },
    hours:         { type: String, trim: true, default: '' },
    startAt:       { type: Date },
    endAt:         { type: Date },
    openings:      { type: Number, default: 1, min: 1, max: 500 },
    hiredCount:    { type: Number, default: 0, min: 0 },
    status:        { type: String, enum: ['open', 'filled', 'closed'], default: 'open' },
    description:   { type: String, trim: true },
    category:      { type: String, trim: true },
    workMode:      { type: String, enum: ['onsite', 'remote'], required: true, default: 'onsite' },
    location:      { type: String, trim: true },
    geo: {
      type:        { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    photos:        { type: [String], default: [] },
  },
  { timestamps: true }
);

// Powers $geoNear "nearby gigs" queries — the same geospatial index pattern
// ride-hailing apps use to find nearby drivers, applied to fixed addresses
// instead of moving vehicles. Docs without `geo` are simply excluded from
// $geoNear results (handled explicitly in the feed route).
GigSchema.index({ geo: '2dsphere' });
GigSchema.index({ status: 1, endAt: 1 });
GigSchema.index({ businessId: 1, createdAt: -1 });

export default mongoose.model<IGig>('Gig', GigSchema);
