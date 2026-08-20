import { ConfigService } from '@nestjs/config';
import { MongooseModuleFactoryOptions } from '@nestjs/mongoose';

/** Havuz boyutlari ve timeout degerleri icin gerekceler README'de. */
export function createMongooseOptions(
  config: ConfigService,
): MongooseModuleFactoryOptions {
  return {
    uri: config.getOrThrow<string>('mongoUri'),
    maxPoolSize: 10, // Mongoose varsayilani 100, bu API icin gereksiz
    minPoolSize: 1, // bosta kalinca baglanti kapanmasin
    serverSelectionTimeoutMS: 5000,
    // Buyuk koleksiyonlarda index olusturmak acilisi bloklar, production'da migration ile yapilir
    autoIndex: config.get<string>('nodeEnv') !== 'production',
  };
}
