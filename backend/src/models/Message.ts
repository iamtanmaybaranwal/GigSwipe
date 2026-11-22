import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from './User';

export interface IMessage extends Document {
  applicationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: UserRole;
  text: string;
}

const MessageSchema = new Schema<IMessage>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    senderId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName:    { type: String, required: true },
    senderRole:    { type: String, enum: ['worker', 'business'], required: true },
    text:          { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id.toString();
        ret.timestamp = ret.createdAt?.toISOString(); // match existing frontend field name
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

MessageSchema.index({ applicationId: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
