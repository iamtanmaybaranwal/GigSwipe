import mongoose, { Schema, Document } from 'mongoose';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

/** A job giver asking a specific job seeker to apply to one of their gigs. */
export interface IInvite extends Document {
  gigId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  message?: string;
  status: InviteStatus;
  applicationId?: mongoose.Types.ObjectId; // set once accepted
  createdAt: Date;
  updatedAt: Date;
}

const InviteSchema = new Schema<IInvite>(
  {
    gigId:      { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message:    { type: String, trim: true, maxlength: 300 },
    status:     { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
  },
  { timestamps: true }
);

InviteSchema.index({ gigId: 1, workerId: 1 }, { unique: true });
InviteSchema.index({ workerId: 1, status: 1, createdAt: -1 });

export default mongoose.model<IInvite>('Invite', InviteSchema);
