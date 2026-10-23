# MKC Ofis — Paylaşımlı Hosting Kurulumu

Bu paket, Word/Excel/PowerPoint belgelerini (Kelime İşlemci, Elektronik Tablo, Sunum) tarayıcıda düzenleyen ve dosyaları
sunucuda saklayan Office uygulamasıdır. Giriş yalnızca portal
(portal.mkcaglar.com) üzerinden, tek kullanımlık imzalı bağlantıyla yapılır.

## Gereksinimler

- Apache veya LiteSpeed (cPanel, Plesk, DirectAdmin gibi panellerin çoğu)
- PHP 7.4 veya üstü (önerilen: 8.1+). `json` ve `session` eklentileri gerekli, `mbstring` önerilir.
- **HTTPS** (oturum çerezi `Secure` olarak yalnızca HTTPS'te gönderilir; AutoSSL / Let's Encrypt yeterli)
- Office ayrı bir alan adının veya alt alan adının **kökünde** çalışmalıdır
  (örnek: `https://office.mkcaglar.com/`). `site.com/office/` gibi bir alt klasörde çalışmaz.
- Yaklaşık 900 MB disk alanı (editör dosyaları dahil) ve ~8.000 dosya (inode)

## Paketin içeriği

```
public_html/     → web kökü (site dosyaları, PHP arka ucu)
office-data/     → web kökünün DIŞINDA kalır: .env, kullanıcı dosyaları, oturumlar
  .env.example
  araclar/uid-tasima.php
KURULUM.md
```

## Kurulum adımları

1. **Zip'i hesabın ev klasörüne açın** (`/home/KULLANICI/`). Sonuçta
   `public_html/` ile yan yana bir `office-data/` klasörü oluşur.
   - Office bir alt alan adında çalışacaksa (`office.mkcaglar.com`), panelde o
     alt alan adının belge kökünü (document root) gösterin ve `public_html/`
     içeriğini oraya taşıyın. `office-data/` klasörü o kökün **bir üst
     klasöründe** durmalı. Farklı bir yer kullanacaksanız
     `public_html/api/config.php` içindeki `data_dir` değerini değiştirin.

2. **Gizli anahtarı ayarlayın.** `office-data/.env.example` dosyasını
   `office-data/.env` olarak kopyalayın ve doldurun:

   ```
   PORTAL_SSO_ANAHTAR=<portaldaki OFFICE_ANAHTAR ile birebir aynı değer>
   PORTAL_ADRES=https://portal.mkcaglar.com
   ```

   Yeni bir anahtar gerekiyorsa `openssl rand -hex 32` ile üretin ve **aynı
   değeri** portalın `.env` dosyasındaki `OFFICE_ANAHTAR` alanına da yazın.
   Anahtar koda veya GitHub'a eklenmez.

3. **İzinler.** `office-data/` klasörü PHP tarafından yazılabilir olmalı
   (çoğu panelde varsayılan olarak öyledir; değilse 700 veya 755 verin).

4. **Portalı güncelleyin.** Office'in adresi değiştiyse portalın `.env`
   dosyasındaki `OFFICE_ADRES` değerini yeni adresle değiştirin
   (örnek: `https://office.mkcaglar.com`).

5. **Yükleme sınırları (isteğe bağlı).** `public_html/api/.user.ini` ve
   `.htaccess` yükleme sınırını 128 MB'a çıkarmayı dener. Panel buna izin
   vermiyorsa PHP ayarlarından `upload_max_filesize` ve `post_max_size`
   değerlerini yükseltin.

## Canlı kontrol listesi

1. `https://OFFICE_ADRESİ/` adresini açın → "Portaldan giriş yapın" ekranı görünmeli.
2. `https://OFFICE_ADRESİ/giris.php` (token olmadan) → "Portaldan giriş yapın" mesajı.
3. `https://OFFICE_ADRESİ/api/auth.php?action=status` → `{"ok":true,"user":null,...}` JSON'u.
   Bunun yerine PHP kodu veya hata görünüyorsa PHP çalışmıyordur.
4. `office-data/` klasörünün web kökünün (`public_html/` veya alt alan adının belge
   kökü) **içinde olmadığını** dosya yöneticisinden kontrol edin.
5. Portalda **öğretmen** hesabıyla giriş yapın, Office simgesine tıklayın →
   Office'te "Dosyalarım" açılmalı ve adres çubuğunda token kalmamalı.
6. **Anahtar eşleşmesi:** öğretmen oturumuyla
   - portalda `/office-git.php?tani=1`
   - Office'te `/giris.php?tani=1`

   sayfalarını açın. İki sayfadaki SHA-256 parmak izinin ilk 8 karakteri
   **aynıysa** anahtarlar eşleşiyor demektir.
7. Öğretmen olarak yeni bir belge oluşturun, bir şey yazın, **Ctrl+S**'ye basın →
   "… olarak kaydedildi" bildirimi ve "Dosyalarım"da dosya görünmeli.
8. Portaldan bir **öğrenci** hesabıyla girin, bir belge kaydedin.
9. Öğretmen hesabında **Öğrenci Dosyaları** sayfasında öğrenci sınıfıyla birlikte
   listelenmeli. Belgesi açılmalı ama düzenlenememeli (salt okunur).
10. Office'te **Çıkış**'a tıklayın → portala dönülmeli; Office adresi tekrar
    açıldığında "Portaldan giriş yapın" görünmeli.
11. Portaldan alınan aynı giriş bağlantısını ikinci kez açın →
    "Bu giriş bağlantısı daha önce kullanılmış" mesajı görünmeli.

## Yetkiler

| | Kendi dosyaları | Öğrenci dosyaları |
| --- | --- | --- |
| Öğrenci | okuma + yazma | erişemez |
| Öğretmen | okuma + yazma | yalnızca okuma (liste, açma, indirme) |

Kontroller sunucuda (`api/files.php`) yapılır. Öğrenciler, Office'e en az bir
kez giriş yaptıktan sonra öğretmen listesinde görünür.

## Erişim günlükleri ve token

Giriş bağlantısı `giris.php?token=…` biçimindedir ve web sunucusunun erişim
günlüğüne sorgu parametresiyle birlikte yazılabilir. Office token'ı kendisi
hiçbir yere yazmaz. Paylaşımlı hostingde günlük biçimi `.htaccess` ile
değiştirilemez. Risk sınırlıdır, çünkü token 5 dakika geçerli ve **tek
kullanımlıktır**: günlüğe düşen bir token zaten kullanılmış olur. Daha sıkı bir
kontrol için:

- Panelde "ham erişim günlüklerini arşivle" seçeneğini kapatın veya günlük saklama süresini kısaltın.
- Kendi sunucunuz varsa (VPS) Apache'de şu biçimi kullanın; sorgu dizesi günlüğe yazılmaz:
  `LogFormat "%h %l %u %t \"%m %U %H\" %>s %b" notoken` ve `CustomLog ... notoken`.
  nginx için `log_format` içinde `$request` yerine `$request_method $uri` kullanın.

## Eski verilerin taşınması

Daha önce kullanıcı adıyla çalışan bir sistemde, kullanıcı başına bir klasör
olacak şekilde saklanmış belgeler varsa, bunları portal `uid`'lerine taşıyın:

1. Eşleme dosyası hazırlayın (`esleme.csv`):
   ```
   eski_kullanici,uid
   ayse,1234
   mehmet.hoca,ogretmen-7
   ```
2. Önce deneme çalıştırması yapın. Eşleşmeyen kullanıcılar listelenir, hiçbir şey taşınmaz:
   ```
   php office-data/araclar/uid-tasima.php ESKI/files esleme.csv
   ```
3. Listeyi kontrol ettikten sonra taşıyın:
   ```
   php office-data/araclar/uid-tasima.php ESKI/files esleme.csv --uygula
   ```

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| "Giriş anahtarının imzası geçersiz" | `.env`'deki `PORTAL_SSO_ANAHTAR` portaldaki `OFFICE_ANAHTAR` ile aynı değil. Kontrol listesinin 6. adımı. |
| "Office SSO anahtarı ayarlanmamış" | `office-data/.env` yok veya yanlış yerde. `api/config.php` → `data_dir`. |
| "Bağlantının süresi dolmuş" | Sunucu saatleri arasında 30 sn'den fazla fark var veya bağlantı 5 dk'dan eski. |
| Giriş sonrası tekrar giriş ekranı | Site HTTPS değil (çerez `Secure`) veya alt klasörde çalışıyor. |
| Belge açılmıyor, boş sayfa | `x2t-1/` ve `v9.3.1-1/` klasörleri eksik yüklenmiş olabilir; zip'i tekrar açın. |
| "Sunucu depolama klasörü oluşturulamadı" | `office-data/` yazılabilir değil veya `open_basedir` ev klasörüne izin vermiyor. Bu durumda `data_dir`'i izinli bir yola alın ve o klasöre `.htaccess` (`Require all denied`) koyun. |

## Güncelleme

Yeni sürümde yalnızca `public_html/` içeriğini değiştirin. `office-data/`
klasörüne dokunmayın; kullanıcı dosyaları ve `.env` oradadır.
