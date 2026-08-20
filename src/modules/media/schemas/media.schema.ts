import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from '../../users/schemas/user.schema';

export type MediaDocument = HydratedDocument<Media>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'media',
})
export class Media {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  ownerId: Types.ObjectId;

  /** Kullanicinin yukledigi ad; indirmede Content-Disposition ile geri veriliyor */
  @Prop({ required: true })
  fileName: string;

  /** Diskteki yol; dosya adi sunucuda uretiliyor */
  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ type: [Types.ObjectId], ref: User.name, default: [] })
  allowedUserIds: Types.ObjectId[];

  createdAt: Date;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

// /media/my hem ownerId'ye gore filtreliyor hem createdAt'e gore siraliyor
MediaSchema.index({ ownerId: 1, createdAt: -1 });

MediaSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.filePath;
    return ret;
  },
});
