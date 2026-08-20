# Media Library API

NestJS + MongoDB Atlas + JWT tabanlı medya yönetim servisi. Kullanıcılar JPEG görsel yükler, yalnızca kendi dosyalarına erişir ve dilerlerse başka kullanıcılara görüntüleme izni verebilir.

Dosyalar `uploads/` klasöründe saklanır ancak **statik olarak yayınlanmaz** — her erişim controller ve guard kontrolünden geçer.

---

## İçindekiler

- [Teknolojiler](#teknolojiler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Proje Yapısı](#proje-yapısı)
- [Veri Modeli](#veri-modeli)
- [Kimlik Doğrulama](#kimlik-doğrulama)
- [Yetkilendirme Modeli](#yetkilendirme-modeli)
- [Dosya İşleme](#dosya-i̇şleme)
- [API Uç Noktaları](#api-uç-noktaları)
- [Hata Kodları](#hata-kodları)
- [cURL Örnekleri](#curl-örnekleri)
- [Tasarım Kararları](#tasarım-kararları)
- [Bilinen Sınırlar](#bilinen-sınırlar)

---

## Teknolojiler

| Katman | Seçim |
|---|---|
| Framework | NestJS 11 (Express platformu) |
| Dil | TypeScript |
| Veritabanı | MongoDB Atlas (Mongoose 9) |
| Kimlik doğrulama | JWT (access + refresh), Passport |
| Parola hash | Argon2id |
| Dosya yükleme | Multer (disk storage) |
| Doğrulama | class-validator + global ValidationPipe |
| Dokümantasyon | Swagger / OpenAPI |
| Güvenlik | Helmet, @nestjs/throttler (rate limit) |

---

## Kurulum

**Gereksinimler:** Node.js 20+ (geliştirme Node 23 ile yapıldı), bir MongoDB Atlas hesabı.

### 1. Bağımlılıklar

```bash
git clone <repo-url>
cd nestProject
npm install
```

### 2. MongoDB Atlas

1. [cloud.mongodb.com](https://cloud.mongodb.com) üzerinden ücretsiz **M0** cluster oluşturun
2. **Database Access** → yeni kullanıcı ekleyin (parolada `@ : / ? #` karakterleri bulunmasın, bağlantı adresini bozar)
3. **Network Access** → geliştirme için `0.0.0.0/0` ekleyin
4. **Connect → Drivers** ile bağlantı adresini kopyalayın

### 3. Ortam değişkenleri

```bash
cp .env.example .env
```

`.env` dosyasında `MONGO_URI` değerini doldurun. Veritabanı adını adresin içine yazmayı unutmayın:

```
mongodb+srv://<KULLANICI>:<PAROLA>@<CLUSTER>.mongodb.net/media_library?retryWrites=true&w=majority
                                                        └─ veritabanı adı: elle eklenmeli
```

> Atlas'ın verdiği adreste veritabanı adı bulunmaz (`.../?retryWrites=...` şeklinde gelir). `media_library` kısmını eklemezseniz Mongoose varsayılan olarak `test` veritabanına yazar.

JWT secret'larını üretin:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET için
openssl rand -base64 48   # JWT_REFRESH_SECRET için
```

> Uygulama açılışta `.env` dosyasını doğrular. Eksik veya geçersiz bir değişken varsa sunucu **başlamaz** ve hangi değişkenin hatalı olduğunu bildirir.

### 4. Çalıştırma

```bash
npm run dev          # geliştirme (watch mode)
npm run build        # production derlemesi
npm run start:prod   # derlenmiş kodu çalıştır
```

| Adres | Açıklama |
|---|---|
| http://localhost:3000 | API |
| http://localhost:3000/docs | Swagger arayüzü |
| http://localhost:3000/health | Sağlık kontrolü |

`uploads/` klasörü uygulama açılışında otomatik oluşturulur, elle oluşturmanıza gerek yoktur.

### 5. (İsteğe bağlı) Admin kullanıcı

```bash
npm run seed:admin -- admin@example.com Passw0rd1
```

Admin rolünün yetkileri için [Admin rolü](#admin-rolü) bölümüne bakın.

### 6. Swagger üzerinden hızlı deneme

1. `POST /auth/register` → yeni kullanıcı oluşturun
2. `POST /auth/login` → dönen `accessToken` değerini kopyalayın
3. Sağ üstteki **Authorize** butonuna token'ı yapıştırın
4. `POST /media/upload` → bir JPEG dosyası seçip yükleyin

---

## Ortam Değişkenleri

| Değişken | Zorunlu | Varsayılan | Açıklama |
|---|---|---|---|
| `MONGO_URI` | ✅ | — | MongoDB Atlas bağlantı adresi |
| `JWT_ACCESS_SECRET` | ✅ | — | Access token imza anahtarı (min. 16 karakter) |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token imza anahtarı (min. 16 karakter) |
| `JWT_ACCESS_TTL` | — | `15m` | Access token ömrü |
| `JWT_REFRESH_TTL` | — | `7d` | Refresh token ömrü |
| `UPLOAD_DIR` | — | `./uploads` | Dosyaların saklanacağı klasör |
| `MAX_FILE_SIZE` | — | `5242880` | Maksimum dosya boyutu (byte, 5MB) |
| `PORT` | — | `3000` | Sunucu portu |
| `NODE_ENV` | — | `development` | `production` değeri cookie'leri HTTPS'e zorlar |

`.env` dosyası `.gitignore` içindedir ve repoya dahil edilmez. Şablon için `.env.example` dosyasına bakın.

---

## Proje Yapısı

```
src/
├── config/
│   ├── configuration.ts          .env değerlerinin tipli hâli
│   ├── database.config.ts        Mongo bağlantı politikası (havuz, timeout, index)
│   └── env.validation.ts         Açılışta .env doğrulaması (fail fast)
├── common/
│   └── decorators/
│       └── current-user.decorator.ts    request.user → controller parametresi
├── scripts/
│   └── seed-admin.ts             ilk admin ataması (REST dışı)
└── modules/
    ├── health/                   GET /health
    ├── auth/                     register / login / refresh / logout
    │   ├── strategies/           Passport JWT stratejisi
    │   ├── guards/               JwtAuthGuard
    │   ├── auth.cookies.ts       httpOnly cookie yönetimi
    │   ├── password.ts           Argon2id hash/doğrulama yardımcıları
    │   └── dto/
    ├── users/                    GET /users/me, User şeması
    └── media/                    yükleme, indirme, yetkilendirme
        ├── guards/               MediaAccessGuard + erisim politikalari
        ├── decorators/           request.media → controller parametresi
        ├── media-upload.config.ts   Multer politikası (tip, boyut, dosya adı)
        └── schemas/
```

**Katmanlar:** controller (HTTP) → service (iş mantığı) → Mongoose model (veri erişimi). Controller'lar iş mantığı içermez; servisler HTTP'den habersizdir.

---

## Veri Modeli

### `users`

| Alan | Tip | Not |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | **unique index**, küçük harfe çevrilir |
| `passwordHash` | string | Argon2id, `select: false` |
| `role` | `'user'` \| `'admin'` | varsayılan `user`; admin tüm medyaya erişebilir |
| `refreshTokenHash` | string \| null | SHA-256, `select: false` |
| `createdAt`, `updatedAt` | Date | otomatik |

### `media`

| Alan | Tip | Not |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId` | ObjectId | `users` referansı |
| `fileName` | string | kullanıcının yüklediği orijinal ad |
| `filePath` | string | diskteki yol, API cevaplarında **gösterilmez** |
| `mimeType` | string | `image/jpeg` |
| `size` | number | byte |
| `allowedUserIds` | ObjectId[] | görüntüleme izni verilen kullanıcılar |
| `createdAt` | Date | otomatik |

**Index'ler:** `users.email` (unique), `media.{ownerId: 1, createdAt: -1}` (compound — `GET /media/my` sorgusunun hem filtresini hem sıralamasını karşılar).

`allowedUserIds` alanına bilinçli olarak index eklenmemiştir: yetki kontrolü, belge `_id` üzerinden çekildikten sonra bellekte yapılır (`canAccess`), bu alan hiçbir sorguda filtre olarak kullanılmaz. Kullanılmayan bir index yazma maliyeti ve depolama getirir. "Bana paylaşılan dosyalar" gibi `find({ allowedUserIds: userId })` sorgusu gerektiren bir uç eklenirse multikey index o zaman gerekli olur.

`passwordHash`, `refreshTokenHash` ve `filePath` alanları şema seviyesindeki `toJSON` dönüşümüyle API cevaplarından temizlenir.

`allowedUserIds` alanı `GET /media/:id` cevabında **yalnızca dosya sahibine ve admine** döner. İzinli bir kullanıcı dosyayı görüntüleyebilir ancak dosyanın başka kimlerle paylaşıldığını göremez — aksi hâlde `GET /media/:id/permissions` ucuna konan sahip kısıtı yan kapıdan aşılmış olurdu.

---

## Kimlik Doğrulama

### Token çifti

| Token | Ömür | Nerede kullanılır |
|---|---|---|
| **Access** | 15 dakika | Her korumalı istekte |
| **Refresh** | 7 gün | Yalnızca `POST /auth/refresh` |

İki token **ayrı secret'larla** imzalanır. Access secret sızarsa saldırgan yalnızca 15 dakikalık token üretebilir; kalıcı erişim sağlayamaz.

Token'lar iki şekilde birden döner:

- **`httpOnly` cookie** — tarayıcı istemcileri için. JavaScript okuyamaz, dolayısıyla XSS ile çalınamaz.
- **Cevap gövdesi** — cURL, Postman ve mobil istemciler için.

Guard önce `Authorization: Bearer <token>` başlığına, bulamazsa cookie'ye bakar.

| Cookie | Path | Ömür |
|---|---|---|
| `access_token` | `/` | Token'ın `exp` değerinden hesaplanır |
| `refresh_token` | `/auth` | Token'ın `exp` değerinden hesaplanır |

`refresh_token` yalnızca `/auth` yoluna gönderilir; `/media/upload` gibi isteklerde ağda dolaşmaz. Cookie ömrü sabit yazılmaz, token'ın kendi son kullanma tarihinden türetilir — böylece `.env`'deki TTL değişse bile cookie ile token asla ayrışmaz.

CSRF koruması `sameSite` ile sağlanır: production'da `strict`, development'ta `lax`.

### Refresh token rotation

Refresh token uzun ömürlüdür; çalınırsa saldırgan günlerce yeni access token üretebilir. Bu riski üç katmanla karşılıyoruz:

**1. Hash'lenerek saklanır.** Veritabanında ham token değil, SHA-256 özeti tutulur. Veritabanı sızsa bile token'lar kullanılamaz.

**2. Rotation.** Her `POST /auth/refresh` çağrısı **yeni bir çift** üretir ve eski refresh token'ı anında geçersizleştirir.

**3. Reuse detection.** Kullanılmış bir refresh token tekrar gelirse sistem bunu ihlal olarak değerlendirir ve **oturumun tamamını kapatır**.

Saldırı senaryosu:

```
1. Saldırgan refresh token'ı çaldı — artık ikisinde de aynı token var
2. Saldırgan kullandı → yeni çift aldı, veritabanındaki özet onunkiyle güncellendi
3. Gerçek kullanıcı refresh yapmak istedi → elindeki token artık eşleşmiyor
   → sistem anormalliği fark etti, refreshTokenHash null'a çekildi
4. Saldırganın yeni token'ı da geçersiz oldu — ikisi de dışarı atıldı
5. Gerçek kullanıcı parolasıyla tekrar girer, saldırgan giremez
```

Rotation olmasaydı çalınmış bir token 7 gün boyunca sessizce kullanılabilirdi.

`POST /auth/logout` hem veritabanındaki `refreshTokenHash` alanını temizler hem cookie'leri siler. Yalnızca birini yapmak yetersizdir: cookie silinip veritabanı temizlenmezse saldırgandaki kopya çalışmaya devam eder.

### Parola güvenliği

- **Argon2id**, OWASP önerilen parametrelerle: `m=19MiB, t=2, p=1`
- Bellek maliyeti sayesinde GPU/ASIC ile paralel deneme ekonomik olmaktan çıkar
- Parametreler hash'in içine gömülür; ileride sertleştirme yapılsa eski parolalar doğrulanmaya devam eder
- Parola kuralı: en az 8 karakter, en az bir harf ve bir rakam

**Timing attack koruması:** `POST /auth/login` isteğinde kullanıcı bulunamasa bile sabit bir sahte hash ile doğrulama çalıştırılır. Böylece "bu e-posta kayıtlı mı?" bilgisi cevap süresinden çıkarılamaz. Aynı sebeple hatalı parola ve olmayan kullanıcı **aynı** mesajı ve aynı status kodunu döner.

**Rate limit:** `register` ve `login` uçları IP başına dakikada 5 istekle sınırlıdır (genel limit: dakikada 100).

---

## Yetkilendirme Modeli

Erişim kontrolü **dosya bazındadır** ve `MediaAccessGuard` içinde, controller'a girilmeden uygulanır.

| Rol | Görüntüle / İndir | Sil | İzin yönetimi |
|---|:---:|:---:|:---:|
| **Sahip** (`ownerId`) | ✅ | ✅ | ✅ |
| **İzinli** (`allowedUserIds`) | ✅ | — | — |
| **Admin** (`role: 'admin'`) | ✅ | ✅ | ✅ |
| **Diğer** | — | — | — |

Yetkisiz her erişim **403** döner.

### Admin rolü

Veri modelinde `role: 'user' | 'admin'` alanı tanımlıdır ancak case dokümanı admin davranışını belirtmez. Bu projede admin **tüm medya uçlarında yetkilidir**: her dosyayı görüntüleyebilir, indirebilir, silebilir ve izinlerini yönetebilir.

Gerekçe: rol alanının davranışsal bir karşılığı olmadığında admin ile normal kullanıcı arasında hiçbir fark kalmaz ve alan işlevsizleşir. Yönetici rolünün klasik anlamı — moderasyon ve destek — kaynak sahipliğinden bağımsız erişim gerektirir.

> **Ödünleşim:** Case, erişimi "sahibi ve yetkilendirilmiş kullanıcılar" ile sınırlar. Admin'e kapsayıcı yetki vermek bu kısıtı yönetici rolü lehine genişletir. Daha muhafazakâr bir alternatif, admin'i yalnızca izin yönetimiyle sınırlamak olurdu; böylece admin bir dosyaya erişmek için kendini `allowedUserIds` listesine eklemek zorunda kalır ve bu işlem iz bırakırdı. Bu proje, rolün işlevsel olması yönünde tercih yapmıştır.

Admin kontrolü politikalardan bağımsız olarak guard'ın en başında uygulanır:

```ts
private isAllowed(ownerOnly, media, user): boolean {
  // Admin tum medya uclarinda yetkilidir; kaynak sahipligi aranmaz
  if (user.role === UserRole.Admin) {
    return true;
  }

  return ownerOnly
    ? this.mediaService.isOwner(media, user.userId)
    : this.mediaService.canAccess(media, user.userId);
}
```

Rol bilgisi JWT payload'ında taşındığı için bu kontrol ek veritabanı sorgusu gerektirmez.

### Admin nasıl oluşturulur?

Rol ataması **bilinçli olarak REST API dışında** tutulmuştur; bunun için bir seed komutu vardır:

```bash
# Yeni bir admin kullanıcı oluşturur
npm run seed:admin -- admin@example.com Passw0rd1

# Mevcut bir kullanıcıyı admin yapar (parola gerekmez)
npm run seed:admin -- mevcut@example.com
```

Komut idempotenttir: kullanıcı zaten admin ise değişiklik yapmaz. Parola, uygulamanın kullandığı Argon2id yardımcılarıyla hash'lenir (`src/modules/auth/password.ts`) — seed ile oluşturulan kullanıcı doğrudan `POST /auth/login` ile giriş yapabilir.

**Neden REST ucu yok?** Rol yükseltme, bir sistemdeki en kritik işlemdir. Bunun için bir uç bulundurmak, o ucun yetkilendirmesindeki tek bir hatanın tüm erişim modelini çökertmesi anlamına gelir. Ayrıca `register` isteğinde `role` alanı gönderilemez — global `ValidationPipe`'ın `forbidNonWhitelisted` ayarı mass assignment yoluyla kendini admin yapma girişimini 400 ile reddeder.

İlk admin altyapı seviyesinde (deploy sırasında çalıştırılan seed komutu) atanır; uygulama çalışırken ayrıcalık yükseltmenin bir yolu yoktur. Çok sayıda yöneticinin bulunduğu büyük bir sistemde bunun yerine, yalnızca mevcut adminlerin çağırabildiği ve her çağrısı denetim kaydına yazılan bir yönetim ucu tercih edilirdi.

Guard sırasıyla şunları yapar:

1. `:id` geçerli bir ObjectId mi? → değilse **400**
2. Kayıt var mı? → yoksa **404**
3. Endpoint `@OwnerOnly()` ile işaretli mi? (metadata okunur)
4. Yetki kontrolü → başarısızsa **403**
5. Kayıt `request.media`'ya iliştirilir; controller aynı kaydı tekrar sorgulamaz

Politikalar `SetMetadata` ile endpoint'e işaretlenir, guard `Reflector` ile bu işareti okur. Üç politika tek guard içinde yönetilir:

| Decorator | Kim geçebilir | Kullanıldığı uçlar |
|---|---|---|
| _(işaretsiz)_ | Sahip, izinli kullanıcı veya admin | `GET /media/:id`, `GET /media/:id/download` |
| `@OwnerOnly()` | Sahip veya admin | `DELETE /media/:id`, `GET` ve `POST /media/:id/permissions` |

İzin ekleme/çıkarma MongoDB'nin atomik `$addToSet` ve `$pull` operatörleriyle yapılır; eşzamanlı isteklerde yarış durumu oluşmaz.

---

## Dosya İşleme

**Yalnızca JPEG** kabul edilir ve doğrulama üç katmanlıdır:

| Katman | Kontrol | Reddedilirse |
|---|---|---|
| 1. Multer `fileFilter` | MIME type (`image/jpeg`) ve uzantı (`.jpg`, `.jpeg`) | **415** |
| 2. Boyut sınırı | 5MB, tek dosya | **413** |
| 3. Magic byte | Dosyanın ilk 3 baytı `FF D8 FF` mi? | **422** |

İlk iki katman ucuzdur ancak yeterli değildir: MIME type istemcinin beyanıdır, taklit edilebilir. Üçüncü katman dosyanın kendi içeriğini okur — uzantı ve MIME yalan söyleyebilir, içerik söyleyemez. Dosyanın tamamı belleğe alınmaz, yalnızca ilk 3 bayt okunur.

> `.jpg` ve `.jpeg` aynı formatın iki uzantısıdır; ikisinin de MIME type'ı `image/jpeg`'dir. Case dokümanındaki örnek cURL komutunda `image.png` yazsa da gereksinim JPEG olduğu için PNG kabul edilmez.

**Dosya adlandırma:** Diskteki ad sunucuda `randomUUID()` ile üretilir; kullanıcının verdiği ad yalnızca veritabanında saklanır ve indirmede `Content-Disposition` başlığıyla geri verilir. Böylece path traversal (`../../etc/passwd`) saldırısı ve dosya adı çakışması mümkün değildir.

**İndirme:** Dosya `createReadStream` ile parça parça gönderilir, belleğe tamamı alınmaz. 100 eşzamanlı indirmede bellek kullanımı yaklaşık 500MB yerine birkaç MB'ta kalır.

**Tutarlılık:** JPEG doğrulaması başarısız olursa veya veritabanı kaydı oluşturulamazsa diske yazılmış dosya silinir; sahipsiz dosya bırakılmaz. `DELETE /media/:id` hem kaydı hem fiziksel dosyayı siler.

**Statik servis yoktur.** `uploads/` klasörü HTTP üzerinden erişilebilir değildir; tek erişim yolu guard korumasındaki `GET /media/:id/download` ucudur.

---

## API Uç Noktaları

🔒 = `Authorization: Bearer <accessToken>` başlığı (veya `access_token` cookie'si) gerektirir.

### Auth

| Metot | Yol | Açıklama | Başarı | Olası hatalar |
|---|---|---|---|---|
| POST | `/auth/register` | Kullanıcı oluşturur. **Token dönmez**, ayrıca login gerekir. | 201 | 400, 409, 429 |
| POST | `/auth/login` | Token çifti üretir, cookie'leri set eder | 200 | 400, 401, 429 |
| POST | `/auth/refresh` | Rotation ile yeni token çifti üretir | 200 | 400, 401 |
| POST | `/auth/logout` 🔒 | Refresh token'ı geçersizleştirir, cookie'leri siler | 204 | 401 |

### Users

| Metot | Yol | Açıklama | Başarı | Olası hatalar |
|---|---|---|---|---|
| GET | `/users/me` 🔒 | Oturum açan kullanıcının profili | 200 | 401, 404 |

### Media

Tüm uçlar kimlik doğrulama gerektirir.

| Metot | Yol | Erişim | Başarı | Olası hatalar |
|---|---|---|---|---|
| POST | `/media/upload` 🔒 | — | 201 | 400, 401, 413, 415, 422 |
| GET | `/media/my` 🔒 | Kendi dosyaları | 200 | 400, 401 |
| GET | `/media/:id` 🔒 | Sahibi, izinli veya admin | 200 | 400, 401, 403, 404 |
| GET | `/media/:id/download` 🔒 | Sahibi, izinli veya admin | 200 | 400, 401, 403, 404 |
| DELETE | `/media/:id` 🔒 | Sahibi veya admin | 204 | 400, 401, 403, 404 |
| GET | `/media/:id/permissions` 🔒 | Sahibi veya admin | 200 | 400, 401, 403, 404 |
| POST | `/media/:id/permissions` 🔒 | Sahibi veya admin | 200 | 400, 401, 403, 404 |

`GET /media/my` sorgu parametreleri **opsiyoneldir**: `page` (varsayılan `1`), `limit` (varsayılan `20`, en fazla `100`).

Cevap her zaman aynı zarf yapısındadır — parametre verilip verilmemesi gövdenin şeklini değiştirmez:

```json
{ "items": [ ... ], "total": 42, "page": 1, "limit": 20 }
```

`POST /media/:id/permissions` gövdesi:

```json
{ "userId": "66c1f2a7b3d4e5f6a7b8c9d0", "action": "add" }
```

`action` yalnızca `add` veya `remove` olabilir.

### Health

| Metot | Yol | Açıklama | Başarı |
|---|---|---|---|
| GET | `/health` | Servis ve veritabanı durumu | 200 |

```json
{ "status": "ok", "database": "connected", "uptime": 42.1, "timestamp": "..." }
```

Sağlık kontrolü yalnızca sürecin ayakta olduğunu değil, MongoDB bağlantısının canlı olduğunu da bildirir.

---

## Hata Kodları

Tüm hatalar tutarlı bir gövdeyle döner:

```json
{
  "message": "Bu dosyaya erisim yetkiniz yok",
  "error": "Forbidden",
  "statusCode": 403
}
```

Doğrulama hatalarında `message` bir dizidir ve ihlal edilen tüm kuralları içerir:

```json
{
  "message": ["Parola en az 8 karakter olmali", "Parola en az bir harf ve bir rakam icermeli"],
  "error": "Bad Request",
  "statusCode": 400
}
```

| Kod | Anlamı | Ne zaman döner |
|---|---|---|
| **200** | OK | Başarılı okuma/işlem |
| **201** | Created | Kullanıcı kaydı, dosya yükleme |
| **204** | No Content | Silme, çıkış |
| **400** | Bad Request | DTO doğrulama hatası, geçersiz ObjectId, tanımsız alan gönderimi |
| **401** | Unauthorized | Token yok, geçersiz veya süresi dolmuş; hatalı e-posta/parola |
| **403** | Forbidden | Kimlik doğru ancak kaynağa erişim yetkisi yok |
| **404** | Not Found | Medya veya kullanıcı bulunamadı |
| **409** | Conflict | E-posta zaten kayıtlı |
| **413** | Payload Too Large | Dosya 5MB sınırını aşıyor |
| **415** | Unsupported Media Type | MIME type veya uzantı JPEG değil |
| **422** | Unprocessable Entity | Dosya içeriği geçerli bir JPEG değil (magic byte) |
| **429** | Too Many Requests | Rate limit aşıldı |

**401 ile 403 ayrımı:** 401 "kim olduğunu doğrulayamadım", 403 "kim olduğunu biliyorum ancak bu kaynağa erişemezsin" anlamına gelir. Başkasına ait bir dosyaya geçerli token ile erişmeye çalışmak 403 döner.

**Mass assignment koruması:** DTO'da tanımlı olmayan bir alan gönderilirse istek 400 ile reddedilir. Örneğin `register` isteğine `"role": "admin"` eklemek `property role should not exist` hatası verir.

Tüm bu kodlar Swagger arayüzünde her endpoint için ayrı ayrı belgelenmiştir.

---

## cURL Örnekleri

### Kayıt

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.com","password":"Passw0rd1"}'
```

```json
{
  "message": "Kayit basarili, giris yapabilirsiniz",
  "user": { "id": "66c1...", "email": "x@y.com" }
}
```

### Giriş

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.com","password":"Passw0rd1"}'
```

```json
{ "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi..." }
```

Cookie'lerle çalışmak için `-c cookies.txt` ekleyin; sonraki isteklerde `-b cookies.txt` kullanarak `Authorization` başlığına gerek kalmaz.

### Token yenileme

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

Cookie kullanıyorsanız gövde boş bırakılabilir: `-b cookies.txt -d '{}'`

### Profil

```bash
curl http://localhost:3000/users/me \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

### Yükleme

```bash
curl -X POST http://localhost:3000/media/upload \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -F 'file=@/path/to/image.jpg'
```

### Listeleme

```bash
# varsayılan: ilk sayfa, 20 kayıt
curl http://localhost:3000/media/my \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

# sayfalama
curl 'http://localhost:3000/media/my?page=2&limit=50' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

### İndirme

```bash
curl -X GET http://localhost:3000/media/<MEDIA_ID>/download \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -OJ
```

### İzin verme / kaldırma

```bash
curl -X POST http://localhost:3000/media/<MEDIA_ID>/permissions \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<USER_ID>","action":"add"}'
```

```json
{ "ownerId": "66c1...", "allowedUserIds": ["66c2..."] }
```

`"action":"remove"` ile izin geri alınır.

### Silme

```bash
curl -X DELETE http://localhost:3000/media/<MEDIA_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

---

## Tasarım Kararları

### Güvenlik

| Karar | Gerekçe |
|---|---|
| Argon2id (bcrypt yerine) | Memory-hard; GPU/ASIC ile paralel denemeyi ekonomik olmaktan çıkarır. bcrypt yalnızca CPU-hard ve 72 byte sınırı var. |
| Ayrı access/refresh secret | Bir secret sızdığında diğerinin sağladığı yetki korunur |
| Refresh token'ın hash'lenmesi | Veritabanı sızıntısında token'lar kullanılamaz |
| Refresh için SHA-256 (Argon2 değil) | Token zaten yüksek entropili; brute force riski yok. Her refresh isteğinde 50ms harcamak gereksiz olurdu. |
| `timingSafeEqual` ile karşılaştırma | Eşleşen karakter sayısının süreden çıkarılmasını engeller |
| Sahte hash ile timing koruması | E-posta kayıt durumunun cevap süresinden sızmasını engeller |
| `httpOnly` cookie | XSS ile token çalınmasını engeller |
| `sameSite` cookie | CSRF koruması |
| `whitelist` + `forbidNonWhitelisted` | Mass assignment saldırısını kapıda keser |
| Magic byte doğrulaması | MIME type ve uzantı taklit edilebilir, dosya içeriği edilemez |
| İzin listesinin cevaptan gizlenmesi | İzinli kullanıcı, dosyanın başka kimlerle paylaşıldığını göremez; sosyal graf sızıntısı önlenir |
| Sunucu tarafında dosya adı üretimi | Path traversal saldırısını imkânsız kılar |
| Helmet + rate limit | Güvenlik başlıkları ve brute force koruması |
| `.env` doğrulaması | Eksik yapılandırmayla çalışmak yerine açılışta durur |
| Rol atamasının REST dışında olması | Ayrıcalık yükseltme için bir uç bulunmaması saldırı yüzeyini daraltır; ilk admin deploy sırasında seed ile atanır |

### Performans

| Karar | Gerekçe |
|---|---|
| `maxPoolSize: 10` | Mongoose varsayılanı 100; bu API için gereksiz kaynak tüketimi |
| `minPoolSize: 1` | Boşta kalan bağlantı kapanmasın, sonraki ilk istek TLS el sıkışmasını ödemesin |
| `serverSelectionTimeoutMS: 5000` | Varsayılan 30 saniye çok uzun; erişilemeyen veritabanında hızlı hata |
| Compound index | `GET /media/my` sorgusunun filtresi ve sıralaması tek index'le karşılanır, in-memory sort olmaz |
| `lean()` (salt-okunur sorgularda) | Mongoose doküman sarmalamasını atlar; bellek ve CPU maliyetini düşürür |
| Stream ile indirme | Dosya belleğe alınmaz; eşzamanlı indirmelerde bellek sabit kalır |
| `Promise.all` ile paralel sorgu | Sayfa ve toplam sayı aynı anda çekilir |
| JWT doğrulamada DB sorgusu yok | Her istekte veritabanına gidilmez; access token kısa ömürlü tutularak dengelenir |
| Guard'ın kaydı isteğe iliştirmesi | Controller aynı kaydı tekrar sorgulamaz — 5 uçta birer sorgu tasarrufu |
| `countDocuments().limit(1)` | Varlık kontrolünde belge gövdesi ağdan geçmez |
| Sadece 3 bayt okuyarak JPEG kontrolü | 5MB'lık dosya belleğe alınmaz |
| Atomik `$addToSet` / `$pull` | Oku-değiştir-yaz döngüsü ve yarış durumu ortadan kalkar |
| Duplicate key hatasının yakalanması | Ön kontrol sorgusu yapılmaz; tek sorgu, yarış durumuna bağışık |

### Case dokümanına ek olarak yapılanlar

- **`POST /auth/logout`** — refresh rotation'ın doğal tamamlayıcısı; cookie kullanıldığı için gerekli
- **`GET /media/my` üzerinde sayfalama** — case dokümanı belirtmiyor; sınırsız liste ucu ölçekte hem sunucuyu hem istemciyi zorlar. Ayrı bir uç yerine aynı uca opsiyonel `page`/`limit` eklendi
- **httpOnly cookie desteği** — Bearer başlığı ile birlikte, XSS koruması için
- **Magic byte doğrulaması** — case yalnızca "jpeg kabul edilir" diyor, uzantı kontrolü yeterli sayılabilirdi
- **Rate limiting ve Helmet** — brute force ve yaygın başlık tabanlı saldırılara karşı
- **Admin rolünün işlevselleştirilmesi** — case veri modelinde `role` alanı tanımlı ancak davranışı belirtilmemiş; yönetici rolüne tüm medya uçlarında yetki tanımlandı
- **`.env` doğrulaması** — eksik yapılandırmanın çalışma anında değil açılışta yakalanması

---

## Bilinen Sınırlar

Bunlar bilinçli ödünleşimlerdir; production ortamı için nasıl ele alınacakları aşağıdadır.

**Tek aktif oturum.** `refreshTokenHash` kullanıcı belgesinde tek bir alandır; ikinci bir cihazdan giriş yapmak ilk oturumu düşürür. Bankacılık gibi senaryolarda istenen davranıştır, genel kullanım için kısıtlayıcıdır. Çoklu cihaz desteği için ayrı bir `refresh_tokens` koleksiyonu (her cihaz için bir kayıt, TTL index ile otomatik temizlik) gerekir.

**Admin denetim kaydı yok.** Admin başkasının dosyasına eriştiğinde veya sildiğinde bu işlem ayrıca kaydedilmez. Yönetici yetkisinin bulunduğu bir sistemde erişim ve silme işlemlerinin denetim kaydına (audit log) yazılması gerekir; kim, ne zaman, hangi kaynağa eriştiği izlenebilir olmalıdır.

**403 ile bilgi sızıntısı.** Var olan ancak erişim izni bulunmayan bir kaynak için 403 dönmek, "bu id'de bir kayıt var" bilgisini açığa çıkarır; kaynak numaralandırma saldırısına zemin hazırlar. Katı güvenlik yaklaşımı 404 dönmeyi tercih eder. Case dokümanı açıkça 403 istediği için gereksinime uyulmuştur.

**Yerel disk depolama.** Yatay ölçeklemede iki sunucu örneği aynı dosyalara erişemez. Production'da S3 benzeri bir nesne deposu kullanılmalı; depolama katmanı bir arayüz arkasına alınırsa uygulama kodu değişmeden geçiş yapılabilir.

**Bellek içi rate limit.** Sayaçlar süreç belleğinde tutulur; birden fazla örnek çalıştığında gerçek limit örnek sayısı kadar katlanır. Redis tabanlı depolamaya geçilmelidir.

**Otomatik test yok.** Zaman kısıtı nedeniyle kapsam dışı bırakılmıştır. Öncelik sırası: `AuthService` için unit testler (rotation ve reuse detection senaryoları), ardından `MediaAccessGuard` için uçtan uca test (iki kullanıcı ile 403 senaryosu). Doğrulama Swagger ve cURL ile manuel olarak yapılmıştır.

**Virüs taraması ve EXIF temizliği yok.** Gerçek bir medya servisinde yüklenen dosyalar ClamAV benzeri bir tarayıcıdan geçirilmeli ve EXIF metadata'sı (GPS konumu içerebilir) temizlenmelidir.

**Yapılandırılmış loglama yok.** NestJS'in varsayılan logger'ı kullanılmaktadır. Production'da JSON formatlı bir logger (Pino), istek kimliği korelasyonu ve bir APM aracı eklenmelidir.

**Ağ erişimi `0.0.0.0/0`.** Atlas Network Access ayarı geliştirme kolaylığı için tüm IP'lere açıktır. Production'da yalnızca uygulama sunucularının IP aralığı tanımlanmalıdır.
