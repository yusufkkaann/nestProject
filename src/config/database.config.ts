import { ConfigService } from '@nestjs/config';
import { MongooseModuleFactoryOptions } from '@nestjs/mongoose';

/**
 * Atlas baglanti politikasi.
 *
 * maxPoolSize  : Mongoose varsayilani 100; bu API icin gereksiz. Free tier'in
 *                baglanti limitini korumak ve kaynak israfini onlemek icin 10.
 * minPoolSize  : Varsayilan 0 (trafik yoksa tum baglantilar kapanir). En az bir
 *                baglantiyi sicak tutmak, bekleyisten sonraki ilk istekteki
 *                TLS el sikismasi gecikmesini ortadan kaldirir.
 * serverSelectionTimeoutMS: Varsayilan 30sn cok uzun; erisilemeyen veritabaninda
 *                istegi 5 saniyede sonlandirmak daha iyi bir kullanici deneyimi.
 * autoIndex    : Semadaki index tanimlarini uygulama acilisinda uygular.
 *                Production'da kapali; buyuk koleksiyonlarda index olusturmak
 *                acilisi bloklar, ayri bir migration adimi olmalidir.
 */
export function createMongooseOptions(
  config: ConfigService,
): MongooseModuleFactoryOptions {
  return {
    uri: config.getOrThrow<string>('mongoUri'),
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    autoIndex: config.get<string>('nodeEnv') !== 'production',
  };
}
