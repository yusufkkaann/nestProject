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

  /** Kullanicinin yukledigi orijinal dosya adi (indirme sirasinda geri verilir) */
  @Prop({ required: true })
  fileName: string;

  /** Diskteki yol. Dosya adi rastgele uretilir; kullanici girdisi dosya sistemine hic dokunmaz */
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

// GET /media/my -> sahibe gore filtreleyip tarihe gore siralar; tek index ikisini de karsilar
MediaSchema.index({ ownerId: 1, createdAt: -1 });

MediaSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.filePath; // fiziksel yol disariya sizmamalidir
    return ret;
  },
});
