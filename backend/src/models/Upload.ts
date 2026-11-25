import mongoose, { Schema, Document } from 'mongoose';

/**
 * An uploaded image (profile photo or gig photo).
 * Images are resized on the phone before upload (max ~1280px), so they're
 * small enough to keep in MongoDB. That keeps hosting simple: there's no
 * separate file storage to set up. Swap for S3/Cloudinary when traffic grows.
 */
export interface IUpload extends Document {
  ownerId: mongoose.Types.ObjectId;
  contentType: string;
  size: number;
  data: Buffer;
  createdAt: Date;
}

const UploadSchema = new Schema<IUpload>(
  {
    ownerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contentType: { type: String, required: true },
    size:        { type: Number, required: true },
    data:        { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UploadSchema.index({ ownerId: 1, createdAt: -1 });

export default mongoose.model<IUpload>('Upload', UploadSchema);
