import mongoose, { Schema, Document } from 'mongoose';

/** A gig a job seeker bookmarked to decide on later. */
export interface ISavedGig extends Document {
  userId: mongoose.Types.ObjectId;
  gigId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SavedGigSchema = new Schema<ISavedGig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gigId:  { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SavedGigSchema.index({ userId: 1, gigId: 1 }, { unique: true });
SavedGigSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ISavedGig>('SavedGig', SavedGigSchema);
