import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'hired';

export interface IApplication extends Document {
  gigId: mongoose.Types.ObjectId;
  gigTitle: string;
  workerId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  businessName: string;
  businessColor: string;
  status: ApplicationStatus;
  // Hire verification — the code is shown ONLY to the worker. The business
  // must get it from the worker in person, which proves the right person showed up.
  hireCode?: string;
  hireCodeExpiry?: Date;
  hireCodeAttempts: number;
  hiredAt?: Date;
  // Chat summary (denormalized so inbox lists don't scan the messages collection)
  lastMessage?: string;
  lastMessageAt?: Date;
  workerLastReadAt?: Date;
  businessLastReadAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    gigId:         { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
    gigTitle:      { type: String, required: true },
    workerId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName:  { type: String, required: true },
    businessColor: { type: String, default: '#7B61FF' },
    status:        { type: String, enum: ['pending', 'accepted', 'rejected', 'hired'], default: 'pending' },
    hireCode:         { type: String },
    hireCodeExpiry:   { type: Date },
    hireCodeAttempts: { type: Number, default: 0 },
    hiredAt:          { type: Date },
    lastMessage:        { type: String },
    lastMessageAt:      { type: Date },
    workerLastReadAt:   { type: Date },
    businessLastReadAt: { type: Date },
  },
  { timestamps: true }
);

// One worker can only apply to each gig once
ApplicationSchema.index({ gigId: 1, workerId: 1 }, { unique: true });
ApplicationSchema.index({ workerId: 1, createdAt: -1 });
ApplicationSchema.index({ businessId: 1, createdAt: -1 });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
