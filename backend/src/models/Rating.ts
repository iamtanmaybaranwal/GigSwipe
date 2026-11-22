import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from './User';

export interface IRating extends Document {
  rater: string;        // user ID of who is submitting the rating
  ratee: string;        // user ID of who is being rated
  applicationId: string;
  gigTitle: string;     // denormalized for display
  stars: number;        // 1–5
  review?: string;      // optional text review
  raterRole: UserRole;  // role of the person giving the rating
  raterName: string;    // denormalized for display
}

const RatingSchema = new Schema<IRating>(
  {
    // Stored as String so it works for both MongoDB ObjectId strings
    // and the in-memory seed data's plain-string IDs.
    rater:         { type: String, required: true },
    ratee:         { type: String, required: true },
    applicationId: { type: String, required: true },
    gigTitle:      { type: String, required: true },
    stars:         { type: Number, required: true, min: 1, max: 5 },
    review:        { type: String, trim: true, maxlength: 500 },
    raterRole:     { type: String, enum: ['worker', 'business'], required: true },
    raterName:     { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        ret.createdAt = ret.createdAt?.toISOString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// One rating per rater per application — prevents double-rating
RatingSchema.index({ rater: 1, applicationId: 1 }, { unique: true });

// Fast lookup of all ratings for a ratee
RatingSchema.index({ ratee: 1, createdAt: -1 });

export default mongoose.model<IRating>('Rating', RatingSchema);
