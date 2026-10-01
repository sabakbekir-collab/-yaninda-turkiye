# Yanımda Türkiye

Türkiye genelinde kullanıcıların yakınındaki eczane, hastane, ATM, acil birimler ve günlük hizmetleri gerçek açık veri kaynaklarıyla bulmasını sağlayan ücretsiz web, PWA ve Android uygulaması.

## Teknolojiler

- React, TypeScript ve Vite
- Netlify Functions, Netlify Database (Postgres/Drizzle) ve Netlify Identity
- OpenStreetMap, Nominatim ve Overpass API
- Leaflet haritası ve cihaz içi favoriler
- PWA service worker ve Capacitor 7 Android (target SDK 35)

## Yerel geliştirme

Node.js 22 kullanın. `.env.example` dosyasını `.env` olarak kopyalayıp isteğe bağlı değerleri doldurun.

```bash
npm install
netlify dev --port 8889
```

Android projesini web çıktısıyla eşitlemek için `npm run android:sync`, imzalı AAB üretim altyapısı için `npm run android:aab` kullanılabilir. Release imza bilgileri güvenli CI/yerel Gradle yapılandırmasından sağlanmalıdır; depoda anahtar tutulmaz.

İlk admin hesabı Netlify Identity panelinden davet edilip `admin` rolü verilerek oluşturulur. Veritabanı migrasyonları deploy sırasında otomatik uygulanır.

## Veri ilkeleri

Uygulama sahte işletme üretmez. Açık veri yanıtı yoksa boş durum gösterir. OSM sorguları sunucu tarafında önbelleğe alınır. Konum geçmişi saklanmaz; yalnızca anonim ürün event’leri ve inceleme bekleyen işletme başvuruları kalıcıdır.


## Cloudflare Worker kurulumu

Bu proje Cloudflare Workers üzerinde çalışır. API'lerin kalıcı veri tutması için Cloudflare D1 veritabanı **DB** adıyla Worker'a bağlanmalıdır.

Gerekli Worker secrets:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- İsteğe bağlı: `OSM_CONTACT_EMAIL`

Şema ayrıca ilk API isteğinde otomatik oluşturulur. Dağıtımdan sonra `/api/health` adresi `{ ok: true, database: true }` döndürüyorsa Worker ve D1 bağlantısı hazırdır.

Özel alan adı, uygulama ve yönetim panelinin fonksiyonları doğrulandıktan sonra bağlanmalıdır.
