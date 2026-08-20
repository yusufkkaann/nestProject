import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Normal sorgularda donmez, .select('+passwordHash') ile istenir
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.User })
  role: UserRole;

  // null ise aktif oturum yok
  @Prop({ type: String, select: false, default: null })
  refreshTokenHash: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  },
});
