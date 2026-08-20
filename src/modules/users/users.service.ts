import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

const MONGO_DUPLICATE_KEY = 11000;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(email: string, passwordHash: string): Promise<UserDocument> {
    try {
      return await this.userModel.create({ email, passwordHash });
    } catch (error: any) {
      // Unique index ihlali: ayni anda iki kayit denemesinde de dogru sonucu verir
      if (error?.code === MONGO_DUPLICATE_KEY) {
        throw new ConflictException('Bu e-posta adresi zaten kayitli');
      }
      throw error;
    }
  }

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Login icin: passwordHash varsayilan olarak gelmedigi icin acikca isteniyor */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
  }

  /** Refresh icin: saklanan token hash'i acikca isteniyor */
  findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async setRefreshTokenHash(id: string | Types.ObjectId, hash: string | null): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { refreshTokenHash: hash }).exec();
  }

  /** Yetki verilecek kullanicinin varligini dogrulamak icin (Media modulu kullanacak) */
  async existsById(id: string | Types.ObjectId): Promise<boolean> {
    const count = await this.userModel.countDocuments({ _id: id }).limit(1).exec();
    return count > 0;
  }
}
