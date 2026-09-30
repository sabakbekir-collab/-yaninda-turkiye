# Ücretsiz yayınlama — Cloudflare Pages + D1

Yanımda Türkiye, Netlify kredi sınırına bağlı kalmadan ücretsiz katmanda çalışacak şekilde Cloudflare Pages Functions + D1 için hazırlandı.

## 1. Cloudflare hesabı

Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git.

GitHub'dan:
`sabakbekir-collab/-yaninda-turkiye`

Ayarlar:
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare Git entegrasyonu ile `main`e her push geldiğinde otomatik yayın yapılır.

## 2. D1 veritabanı

Workers & Pages → D1 → Create database.

Önerilen ad:
`yaninda-turkiye-db`

Oluşturduktan sonra Console/Query bölümünde bu depodaki `cloudflare/schema.sql` dosyasının tamamını çalıştır.

## 3. Pages'e D1 bağla

Pages projesi → Settings → Functions → D1 database bindings.

Binding variable name:
`DB`

Database:
`yaninda-turkiye-db`

## 4. Admin değişkenleri

Pages projesi → Settings → Environment variables → Production.

Şunları ekle:

`ADMIN_EMAIL` = kendi admin e-posta adresin

`ADMIN_PASSWORD` = güçlü bir admin şifresi

`ADMIN_SESSION_SECRET` = uzun rastgele gizli anahtar (en az 32 karakter)

İsteğe bağlı:
`OSM_CONTACT_EMAIL` = iletişim e-postan

Şifreleri GitHub'a veya kaynak koduna yazma.

## 5. İlk yayın

Environment variables ve D1 binding kaydedildikten sonra:
Deployments → Retry deployment.

Site ücretsiz `.pages.dev` adresinde açılır. Cloudflare Pages Git entegrasyonu GitHub'daki sonraki commit'leri otomatik yayınlar.

## 6. Admin

Site içinden:
Menü → Admin Girişi

`ADMIN_EMAIL` ve `ADMIN_PASSWORD` ile giriş yapılır.

Admin:
- başvuruları görür
- başvuruyu onaylar/reddeder
- onaylanan kaydı konumlandırır
- hatalı kayıt bildirimlerini çözer
- anonim kullanım istatistiklerini görür

## 7. Nöbetçi eczane

Nöbetçi eczane artık normal OSM eczane araması olarak gösterilmez. Günün nöbet verisi için Eczane Adresi'nin ücretsiz public API'si kullanılır. API anahtarı istemez ve CC BY 4.0 atfı gerektirir. Uygulamada veri kaynağı bağlantısı gösterilir.

## 8. Ücretsiz sınırlar

Cloudflare'ın ücretsiz katmanında Pages statik içerikleri ücretsizdir; Pages Functions Workers Free kullanımına, D1 ise ücretsiz günlük okuma/yazma ve depolama limitlerine tabidir. Limitler aşılırsa ilgili servis günlük limit sıfırlanana kadar sorguları reddedebilir.

Netlify'ın mevcut kredi durumu bu yeni yayın yöntemini etkilemez.
