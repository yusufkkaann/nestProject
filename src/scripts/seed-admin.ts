/**
 * Ilk admin kullanicisini olusturur veya mevcut bir kullaniciyi admin yapar.
 * Rol atamasi icin API ucu yok; ayricalik yukseltme yuzeyini acmamak icin.
 *
 *   npm run seed:admin -- admin@example.com Passw0rd1
 */
import { connect, connection } from 'mongoose';

import { hashPassword } from '../modules/auth/password';

const [email, password] = process.argv.slice(2);

async function seedAdmin(): Promise<void> {
  if (!email) {
    throw new Error('Kullanim: npm run seed:admin -- <email> [parola]');
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI tanimli degil (.env dosyasini kontrol edin)');
  }

  await connect(uri);
  const users = connection.collection('users');
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await users.findOne({ email: normalizedEmail });

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`${normalizedEmail} zaten admin.`);
      return;
    }
    await users.updateOne(
      { _id: existing._id },
      { $set: { role: 'admin', updatedAt: new Date() } },
    );
    console.log(`${normalizedEmail} admin yapildi.`);
    return;
  }

  if (!password) {
    throw new Error(
      'Kullanici bulunamadi. Yeni admin olusturmak icin parola da verin.',
    );
  }

  const now = new Date();
  await users.insertOne({
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    role: 'admin',
    refreshTokenHash: null,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  });
  console.log(`${normalizedEmail} admin olarak olusturuldu.`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(`Seed basarisiz: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => connection.close());
