import mongoose, { Schema, Document } from 'mongoose';

interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export type WorkMode = 'onsite' | 'remote';

export interface IGig extends Document {
  businessId: mongoose.Types.ObjectId;
  title: string;
  businessName: string;
  businessColor: string;
  pay: string;
  hours: string;
  description: string;
  category: string;
  workMode: WorkMode;
  location: string; // human-readable label, e.g. "Downtown Seattle, WA" — only meaningful for onsite gigs
  geo?: GeoPoint;    // real coordinates, used for $geoNear queries — never set for remote gigs
}

const GigSchema = new Schema<IGig>(
  {
    businessId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:         { type: String, required: true, trim: true },
    businessName:  { type: String, required: true, trim: true },
    businessColor: { type: String, default: '#7B61FF' },
    pay:           { type: String, trim: true },
    hours:         { type: String, trim: true },
    description:   { type: String, trim: true },
    category:      { type: String, trim: true },
    workMode:      { type: String, enum: ['onsite', 'remote'], required: true, default: 'onsite' },
    location:      { type: String, trim: true },
    geo: {
      type:        { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
  },
  { timestamps: true }
);

// Powers $geoNear "nearby gigs" queries — the same geospatial index pattern
// ride-hailing apps use to find nearby drivers, applied to fixed addresses
// instead of moving vehicles. Docs without `geo` are simply excluded from
// $geoNear results (handled explicitly in the feed route).
GigSchema.index({ geo: '2dsphere' });

export default mongoose.model<IGig>('Gig', GigSchema);
