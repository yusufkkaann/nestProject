# Media Library API

NestJS ve MongoDB Atlas ile yazılmış bir medya yönetim servisi. Kullanıcılar JPEG görsel yükler, kendi dosyalarına erişir, isterlerse başka kullanıcılara görüntüleme izni verir.

Dosyalar `uploads/` klasöründe tutulur ama statik olarak yayınlanmaz. Her erişim controller ve guard üzerinden geçer.

## Kurulum

Node.js 20 veya üstü ve bir MongoDB Atlas hesabı gerekiyor.

```bash
git clone <repo-url>
cd nestProject
npm install
cp .env.example .env
```

### Atlas bağlantısı

Atlas'ta ücretsiz M0 cluster açtıktan sonra:

1. **Database Access** → bir kullanıcı oluşturun. Parolada `@ : / ? #` karakterleri kullanmayın, bağlantı adresini bozarlar.
2. **Network Access** → geliştirme için `0.0.0.0/0` ekleyin.
3. **Connect → Drivers** → adresi kopyalayın.

Kopyaladığınız adreste veritabanı adı yer almaz, elle eklemeniz gerekiyor:

```
mongodb+srv://<KULLANICI>:<PAROLA>@<CLUSTER>.mongodb.net/media_library?retryWrites=true&w=majority
```

`media_library` kısmını yazmazsanız Mongoose varsayılan olarak `test` veritabanına kaydeder.

Ardından JWT anahtarlarını üretip `.env` dosyasına yazın:

```bash
openssl rand -base64 48
```

Uygulama açılırken `.env` içeriğini doğruluyor. Eksik ya da hatalı bir değer varsa sunucu başlamıyor, hangi değişkenin sorunlu olduğunu söylüyor.

### Çalıştırma

```bash
npm run dev          # geliştirme, dosya değişince yeniden başlar
npm run build
npm run start:prod
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Sağlık kontrolü: http://localhost:3000/health

`uploads/` klasörü açılışta otomatik oluşuyor.

### Admin kullanıcı (isteğe bağlı)

```bash
npm run seed:admin -- admin@example.com Passw0rd1   # yeni kullanıcı oluşturur
npm run seed:admin -- mevcut@example.com            # var olanı admin yapar
```

### Swagger'dan deneme

`POST /auth/register` ile kayıt olun, `POST /auth/login` ile giriş yapın, dönen `accessToken` değerini sağ üstteki Authorize butonuna yapıştırın. Sonrasında tüm uçları arayüzden deneyebilirsiniz.

Access token 15 dakika geçerli. Süresi dolduğunda 401 alırsınız; `POST /auth/refresh` çağırıp yeni token'ı Authorize'a yapıştırmanız gerekir. Swagger'ın kendiliğinden token yenileme özelliği yok, o istemcinin işi.

## Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MONGO_URI` | — | Atlas bağlantı adresi (zorunlu) |
| `JWT_ACCESS_SECRET` | — | Access token anahtarı, en az 16 karakter (zorunlu) |
| `JWT_REFRESH_SECRET` | — | Refresh token anahtarı, en az 16 karakter (zorunlu) |
| `JWT_ACCESS_TTL` | `15m` | Access token ömrü |
| `JWT_REFRESH_TTL` | `7d` | Refresh token ömrü |
| `UPLOAD_DIR` | `./uploads` | Dosyaların saklanacağı klasör |
| `MAX_FILE_SIZE` | `5242880` | Dosya boyutu sınırı (5MB) |
| `PORT` | `3000` | Sunucu portu |
| `NODE_ENV` | `development` | `production` cookie'leri HTTPS'e zorlar |

`.env` repoya dahil değil. Şablon için `.env.example` dosyasına bakın.

## Proje Yapısı

```
src/
├── config/          .env doğrulama, tipli config, Mongo bağlantı ayarları
├── common/          birden fazla modülün paylaştığı decorator'lar
├── scripts/         seed-admin
└── modules/
    ├── health/
    ├── auth/        register, login, refresh, logout
    ├── users/       /users/me, User şeması
    └── media/       yükleme, indirme, yetki yönetimi
```

Akış controller → service → Mongoose model şeklinde. Controller'larda iş mantığı yok, servisler HTTP'den bağımsız.

Bir şeyi tek modül kullanıyorsa o modülün içinde duruyor, iki veya daha fazla modül kullanıyorsa `common/` altına çıkıyor. Şu an orada yalnızca `@CurrentUser()` var.

## Veri Modeli

**users**

| Alan | Tip | Not |
|---|---|---|
| `email` | string | unique index, küçük harfe çevrilir |
| `passwordHash` | string | Argon2id, sorgularda varsayılan olarak gelmez |
| `role` | `user` \| `admin` | varsayılan `user` |
| `refreshTokenHash` | string \| null | SHA-256, sorgularda varsayılan olarak gelmez |
| `createdAt`, `updatedAt` | Date | |

**media**

| Alan | Tip | Not |
|---|---|---|
| `ownerId` | ObjectId | users referansı |
| `fileName` | string | kullanıcının yüklediği orijinal ad |
| `filePath` | string | diskteki yol, API cevaplarında dönmez |
| `mimeType` | string | `image/jpeg` |
| `size` | number | byte |
| `allowedUserIds` | ObjectId[] | erişim izni verilen kullanıcılar |
| `createdAt` | Date | |

Index olarak `users.email` (unique) ve `media.{ownerId: 1, createdAt: -1}` var. İkincisi compound: `/media/my` sorgusu hem `ownerId`'ye göre filtreliyor hem `createdAt`'e göre sıralıyor, tek index ikisini de karşılıyor.

`allowedUserIds` için index eklemedim. Yetki kontrolü belge `_id` üzerinden çekildikten sonra bellekte yapılıyor, bu alan hiçbir sorguda filtre olarak kullanılmıyor. Kullanılmayan index her yazmada güncellenmesi gereken bir maliyet. "Bana paylaşılanlar" gibi bir uç eklenirse multikey index o zaman gerekir.

`passwordHash`, `refreshTokenHash` ve `filePath` şema seviyesindeki `toJSON` dönüşümünde temizleniyor, hiçbir cevapta görünmüyor.

## Kimlik Doğrulama

Access token 15 dakika, refresh token 7 gün geçerli. İkisi ayrı secret'la imzalanıyor; access secret sızarsa saldırgan 15 dakikalık token üretebilir ama kalıcı erişim sağlayamaz.

Token'lar hem cevap gövdesinde dönüyor hem httpOnly cookie olarak set ediliyor. Guard önce `Authorization: Bearer` başlığına bakıyor, bulamazsa cookie'ye. Böylece cURL ve Postman gövdedeki token'ı, tarayıcı istemcileri cookie'yi kullanabiliyor.

Cookie tercihi XSS içindi: `httpOnly` olduğu için JavaScript token'ı okuyamıyor, `localStorage`'daki gibi çalınamıyor. Bunun karşılığında CSRF yüzeyi açılıyor, onu da `sameSite` ile kapattım (production'da `strict`, geliştirmede `lax`). `refresh_token` cookie'sine `path=/auth` verdim, diğer isteklerde ağda dolaşmıyor.

Cookie ömrünü sabit yazmak yerine token'ın kendi `exp` değerinden hesaplıyorum. `.env`'deki TTL değişse bile cookie ile token birbirinden ayrışmıyor.

### Refresh token rotation

Refresh token uzun ömürlü olduğu için çalınması ciddi bir risk. Üç önlem var.

Token veritabanında ham olarak değil SHA-256 özeti olarak tutuluyor, sızıntı durumunda kullanılamaz.

Her `POST /auth/refresh` çağrısı yeni bir çift üretiyor ve eski refresh token'ı geçersizleştiriyor.

Kullanılmış bir token tekrar gelirse sistem bunu ihlal sayıp oturumun tamamını kapatıyor. Senaryo şöyle işliyor: saldırgan token'ı çalıp kullanır, veritabanındaki özet onunkiyle güncellenir. Gerçek kullanıcı refresh yapmak istediğinde elindeki token artık eşleşmez, sistem durumu fark eder ve `refreshTokenHash` alanını `null`'a çeker. İkisi de dışarı atılır; kullanıcı parolasıyla tekrar girer, saldırgan giremez.

`POST /auth/logout` hem veritabanındaki özeti siliyor hem cookie'leri temizliyor. Sadece cookie silinseydi saldırgandaki kopya çalışmaya devam ederdi.

### Parolalar

Argon2id kullanıyorum, OWASP'ın önerdiği parametrelerle (`m=19MiB, t=2, p=1`). bcrypt yerine tercih etmemin sebebi memory-hard olması: bcrypt yalnızca CPU'yu yorar ve GPU'da binlerce paralel deneme yapılabilir, Argon2id'de her denemenin 19 MiB bellek maliyeti var. Ayrıca bcrypt'in 72 byte sınırı gibi bir tuzağı yok.

Login'de kullanıcı bulunamasa bile sabit bir hash ile doğrulama çalıştırıyorum. Aksi hâlde kayıtlı olmayan e-posta anında, kayıtlı olan ~50ms sonra cevap dönerdi; saldırgan cevap sürelerini ölçerek hangi e-postaların sistemde olduğunu çıkarabilirdi. Aynı sebeple hatalı parola ile olmayan kullanıcı aynı mesajı alıyor.

`register` ve `login` uçlarında dakikada 5 istek sınırı var, diğerlerinde 100.

## Yetkilendirme

Erişim kontrolü dosya bazında, `MediaAccessGuard` içinde yapılıyor. Guard sırasıyla id formatını doğruluyor (400), kaydı çekiyor (yoksa 404), yetkiyi kontrol ediyor (yoksa 403) ve kaydı `request` nesnesine iliştiriyor. Son adım sayesinde controller aynı kaydı tekrar sorgulamıyor.

| | Görüntüle / indir | Sil | İzin yönetimi |
|---|:---:|:---:|:---:|
| Sahip | var | var | var |
| İzin verilen kullanıcı | var | — | — |
| Admin | var | var | var |
| Diğer | — | — | — |

`@OwnerOnly()` ile işaretlenen uçlara izin verilen kullanıcılar giremiyor; işaretsiz uçlarda sahip, izinli kullanıcı ve admin geçebiliyor. Bu işaret `SetMetadata` ile konuyor, guard `Reflector` ile okuyor. İki ayrı guard yazmak yerine bu yolu seçtim, kodun büyük kısmı zaten ortaktı.

İzin ekleme ve kaldırma MongoDB'nin `$addToSet` ve `$pull` operatörleriyle yapılıyor. Diziyi okuyup değiştirip kaydetseydim eşzamanlı iki istekte biri diğerinin yazdığını ezebilirdi.

`GET /media/:id` cevabında `allowedUserIds` yalnızca dosya sahibine ve admine dönüyor. İzin verilen bir kullanıcı dosyayı görebiliyor ama başka kimlerle paylaşıldığını göremiyor, aksi hâlde `/permissions` ucuna koyduğumuz sahip kısıtının bir anlamı kalmazdı.

### Admin

Veri modelinde `role` alanı var ama doküman bu rolün ne yapacağını söylemiyor. Admin'i tüm medya uçlarında yetkili yaptım: her dosyayı görüntüleyebiliyor, indirebiliyor, silebiliyor ve izinlerini yönetebiliyor. Davranışı olmayan bir rol alanı işlevsiz kalırdı, yönetici rolünün klasik anlamı da (moderasyon, destek) kaynak sahipliğinden bağımsız erişim gerektiriyor.

Bunun bir bedeli var: doküman erişimi "sahibi ve yetkilendirilmiş kullanıcılar" ile sınırlıyor, admin bu sınırın dışında kalıyor. Daha muhafazakâr bir yorum admin'i yalnızca izin yönetimiyle sınırlamak olurdu; o durumda admin bir dosyaya erişmek için kendini izin listesine eklemek zorunda kalır ve bu işlem listede iz bırakırdı.

Rol ataması API üzerinden yapılamıyor, bunun için `npm run seed:admin` komutu var. Ayrıcalık yükseltme için bir uç bulundurmamak saldırı yüzeyini daraltıyor. Kayıt sırasında da `role` gönderilemiyor; `ValidationPipe` tanımsız alanları reddettiği için `{"role":"admin"}` denemesi 400 alıyor.

## Dosya İşleme

Yalnızca JPEG kabul ediliyor, doğrulama üç aşamalı.

Multer'ın `fileFilter`'ı MIME type ve uzantıyı kontrol ediyor, dosya diske yazılmadan çalışıyor (415). Boyut sınırı 5MB ve tek dosya; Multer bunu akış sırasında uyguluyor, büyük dosyayı sonuna kadar okumuyor (413). Son olarak dosyanın ilk üç baytı okunup `FF D8 FF` imzasıyla karşılaştırılıyor (422).

Üçüncü aşama gerekli çünkü MIME type istemcinin beyanı. cURL ile `;type=image/jpeg` yazıp herhangi bir dosyayı JPEG diye gönderebilirsiniz, içerik kontrolü bunu yakalıyor. Dosyanın tamamı belleğe alınmıyor, sadece üç bayt okunuyor.

`.jpg` ve `.jpeg` aynı formatın iki uzantısı, ikisinin de MIME type'ı `image/jpeg`. Dokümandaki örnek cURL komutunda `image.png` yazıyor ama gereksinim JPEG olduğu için PNG kabul edilmiyor.

Diskteki dosya adı sunucuda `randomUUID()` ile üretiliyor, kullanıcının verdiği ad sadece veritabanında duruyor ve indirmede `Content-Disposition` başlığıyla geri veriliyor. Kullanıcı girdisi dosya sistemine hiç geçmediği için path traversal mümkün değil, aynı adlı dosyalar da birbirini ezmiyor.

İndirme `createReadStream` ile yapılıyor. Dosya belleğe alınsaydı 100 eşzamanlı indirme yaklaşık 500MB tutardı, stream'de bellek sabit kalıyor ve ilk bayt hemen gidiyor.

JPEG doğrulaması başarısız olursa ya da veritabanı kaydı oluşturulamazsa diske yazılmış dosya siliniyor. `DELETE /media/:id` hem kaydı hem dosyayı kaldırıyor.

## API Uç Noktaları

Kilit işaretli uçlar `Authorization: Bearer <accessToken>` başlığı (ya da `access_token` cookie'si) istiyor.

**Auth**

| Metot | Yol | Açıklama | Başarı | Hatalar |
|---|---|---|---|---|
| POST | `/auth/register` | Kullanıcı oluşturur, token dönmez | 201 | 400, 409, 429 |
| POST | `/auth/login` | Token çifti üretir | 200 | 400, 401, 429 |
| POST | `/auth/refresh` | Rotation ile yeni çift üretir | 200 | 400, 401 |
| POST | `/auth/logout` 🔒 | Oturumu kapatır | 204 | 401 |

**Users**

| Metot | Yol | Açıklama | Başarı | Hatalar |
|---|---|---|---|---|
| GET | `/users/me` 🔒 | Profil bilgisi | 200 | 401, 404 |

**Media** — hepsi kimlik doğrulama istiyor.

| Metot | Yol | Erişim | Başarı | Hatalar |
|---|---|---|---|---|
| POST | `/media/upload` | — | 201 | 400, 401, 413, 415, 422 |
| GET | `/media/my` | Kendi dosyaları | 200 | 400, 401 |
| GET | `/media/:id` | Sahibi, izinli veya admin | 200 | 400, 401, 403, 404 |
| GET | `/media/:id/download` | Sahibi, izinli veya admin | 200 | 400, 401, 403, 404 |
| DELETE | `/media/:id` | Sahibi veya admin | 204 | 400, 401, 403, 404 |
| GET | `/media/:id/permissions` | Sahibi veya admin | 200 | 400, 401, 403, 404 |
| POST | `/media/:id/permissions` | Sahibi veya admin | 200 | 400, 401, 403, 404 |

**Health**

`GET /health` servis ve veritabanı durumunu döner:

```json
{ "status": "ok", "database": "connected", "uptime": 42.1, "timestamp": "..." }
```

Yalnızca sürecin ayakta olduğunu değil, Mongo bağlantısının canlı olduğunu da bildiriyor.

### Listeleme ve sayfalama

`GET /media/my` sorgu parametreleri opsiyonel: `page` (varsayılan 1), `limit` (varsayılan 20, en fazla 100). Cevap her zaman aynı yapıda:

```json
{ "items": [ ... ], "total": 42, "page": 1, "limit": 20 }
```

Doküman bu uçta sayfalama istemiyordu ama sınırsız liste ucu, kullanıcının binlerce dosyası olduğunda hem sunucuyu hem istemciyi zorlar. Ayrı bir `/paginated` ucu açmak yerine aynı uca opsiyonel parametre ekledim. Parametre verilsin verilmesin cevabın şekli değişmiyor, istemci tarafında tip belirsizliği olmuyor.

### İzin yönetimi

`POST /media/:id/permissions` gövdesi:

```json
{ "userId": "66c1f2a7b3d4e5f6a7b8c9d0", "action": "add" }
```

`action` yalnızca `add` veya `remove` olabilir. Cevap güncel izin listesini döner.

## Hata Kodları

Hatalar tutarlı bir gövdeyle dönüyor:

```json
{ "message": "Bu dosyaya erisim yetkiniz yok", "error": "Forbidden", "statusCode": 403 }
```

Doğrulama hatalarında `message` bir dizi ve ihlal edilen tüm kuralları içeriyor:

```json
{ "message": ["Parola en az 8 karakter olmali"], "error": "Bad Request", "statusCode": 400 }
```

| Kod | Ne zaman |
|---|---|
| 200 | Başarılı okuma veya işlem |
| 201 | Kullanıcı kaydı, dosya yükleme |
| 204 | Silme, çıkış |
| 400 | Doğrulama hatası, geçersiz ObjectId, tanımsız alan gönderimi |
| 401 | Token yok, geçersiz veya süresi dolmuş; hatalı e-posta/parola |
| 403 | Kimlik doğru ama kaynağa erişim yetkisi yok |
| 404 | Medya veya kullanıcı bulunamadı |
| 409 | E-posta zaten kayıtlı |
| 413 | Dosya 5MB sınırını aşıyor |
| 415 | MIME type veya uzantı JPEG değil |
| 422 | Dosya içeriği geçerli bir JPEG değil |
| 429 | Rate limit aşıldı |

401 ile 403 arasındaki fark önemli: 401 "kim olduğunu doğrulayamadım", 403 "kim olduğunu biliyorum ama bu kaynağa erişemezsin" demek. Geçerli token'la başkasının dosyasına erişmeye çalışmak 403 dönüyor.

Tanımsız alan göndermek de 400 alıyor. `register` isteğine `"role": "admin"` eklerseniz `property role should not exist` cevabı geliyor, mass assignment bu şekilde engelleniyor.

Bütün kodlar Swagger'da uç uç dokümante edilmiş durumda.

## cURL Örnekleri

Kayıt:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.com","password":"Passw0rd1"}'
```

Giriş:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@y.com","password":"Passw0rd1"}'
```

Cookie ile çalışmak isterseniz `-c cookies.txt` ekleyin, sonraki isteklerde `-b cookies.txt` yeterli olur ve `Authorization` başlığına gerek kalmaz.

Token yenileme:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

Yükleme:

```bash
curl -X POST http://localhost:3000/media/upload \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -F 'file=@/path/to/image.jpg'
```

Listeleme:

```bash
curl http://localhost:3000/media/my \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

curl 'http://localhost:3000/media/my?page=2&limit=50' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

İndirme:

```bash
curl -X GET http://localhost:3000/media/<MEDIA_ID>/download \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' -OJ
```

İzin verme ve kaldırma:

```bash
curl -X POST http://localhost:3000/media/<MEDIA_ID>/permissions \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<USER_ID>","action":"add"}'
```

Silme:

```bash
curl -X DELETE http://localhost:3000/media/<MEDIA_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Performansla İlgili Notlar

Mongo bağlantısında `maxPoolSize` 10'a çekildi. Mongoose varsayılanı 100 ve bu API için gereksiz, free tier'ın bağlantı limitini de zorluyor. `minPoolSize` 1, böylece trafik kesildiğinde tüm bağlantılar kapanmıyor ve sonraki ilk istek TLS el sıkışmasını baştan ödemiyor. `serverSelectionTimeoutMS` 5 saniye, varsayılan 30 saniye erişilemeyen bir veritabanında çok uzun.

Listeleme sorgularında `lean()` kullanıyorum. Mongoose'un doküman sarmalaması `save()` ve `deleteOne()` gibi metotlar getiriyor, salt okunur listelemede bunlara ihtiyaç yok. Yazma yapılan yerlerde hydrated belge kullanmaya devam ediyorum.

Sayfa ve toplam sayı `Promise.all` ile paralel çekiliyor, sırayla çalıştırsaydım toplam süre ikisinin toplamı olurdu.

JWT stratejisinde her istekte veritabanına gitmiyorum, payload'daki bilgiyi kullanıyorum. Bunun bedeli silinen bir kullanıcının token ömrü boyunca (15 dakika) erişebilmesi; access token'ı kısa tutmamın sebebi bu. Dosya erişimi gibi kritik işlemlerde zaten guard veritabanından doğrulama yapıyor.

Guard'ın çektiği kaydı `request` nesnesine iliştirmesi beş uçta birer sorgu tasarrufu sağlıyor.

Kullanıcı varlığı kontrolünde `countDocuments().limit(1)` kullanıyorum, belge gövdesi ağdan geçmiyor. Kayıt sırasında e-posta çakışmasını önceden sorgulamak yerine unique index'in fırlattığı hatayı yakalayıp 409'a çeviriyorum; hem tek sorgu hem eşzamanlı isteklerde doğru sonuç.

## Bilinen Sınırlar

**Tek aktif oturum.** `refreshTokenHash` kullanıcı belgesinde tek alan, ikinci cihazdan giriş yapmak ilk oturumu düşürüyor. Çoklu cihaz için ayrı bir `refresh_tokens` koleksiyonu gerekir; her cihaz için bir kayıt ve TTL index ile otomatik temizlik.

**Testler yazılmadı.** Doğrulama Swagger ve cURL ile manuel yapıldı. Test eklenecek olsa öncelik `AuthService`'in rotation ve reuse detection senaryoları ile `MediaAccessGuard`'ın 403 davranışı olurdu.

**Yerel disk depolama.** Doküman böyle istiyor ama yatay ölçeklemede iki sunucu örneği aynı dosyalara erişemez. Production'da S3 benzeri bir nesne deposu gerekir; depolama katmanı bir arayüz arkasına alınırsa uygulama kodu değişmeden geçilebilir.

**Rate limit bellekte.** Sayaçlar süreç belleğinde tutuluyor, birden fazla örnek çalıştığında gerçek limit örnek sayısı kadar katlanıyor. Redis'e taşınmalı.

**Admin işlemleri kayıt altına alınmıyor.** Admin başkasının dosyasına eriştiğinde ya da sildiğinde bu ayrıca loglanmıyor. Bu yetkinin bulunduğu bir sistemde audit log şart.

**403 bilgi sızdırıyor.** Var olan ama erişilemeyen bir kayıt için 403 dönmek "bu id'de bir dosya var" bilgisini veriyor. Katı yaklaşım 404 dönmeyi tercih eder, doküman açıkça 403 istediği için gereksinime uyuldu.

**Virüs taraması ve EXIF temizliği yok.** Gerçek bir serviste yüklenen dosyalar taranmalı ve fotoğrafların EXIF verisi (GPS konumu içerebilir) temizlenmeli.

**Ağ erişimi herkese açık.** Atlas Network Access geliştirme kolaylığı için `0.0.0.0/0`. Production'da yalnızca uygulama sunucularının IP aralığı tanımlanmalı.
