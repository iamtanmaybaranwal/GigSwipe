import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  gigId: mongoose.Types.ObjectId;
  gigTitle: string;
  workerId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  businessName: string;
  businessColor: string;
  status: 'pending' | 'accepted' | 'rejected';
  lastMessage?: string;
  lastMessageAt?: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    gigId:         { type: Schema.Types.ObjectId, ref: 'Gig', required: true },
    gigTitle:      { type: String, required: true },
    workerId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName:  { type: String, required: true },
    businessColor: { type: String, default: '#7B61FF' },
    status:        { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    lastMessage:   { type: String },
    lastMessageAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// One worker can only apply to each gig once
ApplicationSchema.index({ gigId: 1, workerId: 1 }, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
