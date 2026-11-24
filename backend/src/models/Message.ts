import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from './User';

export interface IMessage extends Document {
  applicationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    senderId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName:    { type: String, required: true },
    senderRole:    { type: String, enum: ['worker', 'business'], required: true },
    text:          { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

MessageSchema.index({ applicationId: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
