# Yanımda Türkiye — Konum/İlçe Düzeltmesi

Bu sürüm aşağıdaki sorunları düzeltir:

- `Konumumu Kullan` artık Capacitor native uygulamada `@capacitor/geolocation`, web/PWA'da browser Geolocation API kullanır.
- Konum izni isteme, loading, timeout, permission denied ve fallback durumları ele alınır.
- Başarılı GPS konumu doğrudan Nearby sayfasına gönderilir; tekrar il/ilçe seçtirmez.
- Manuel il → ilçe seçimi artık offline çalışır.
- 81 il ve 973 ilçe yerel veri olarak eklendi.
- İl değişince ilçe sıfırlanır; yanlış ile ait ilçe seçilemez.
- Nearby sayfasındaki il/ilçe araması düzeltildi.
- Nearby isteklerinde yarış durumları azaltıldı.
- İşletme başvuru formundaki ilçe alanı da dinamik dropdown oldu.
- Places cache anahtarı daha hassas hale getirildi; farklı kullanıcıların yaklaşık 1 km aralıkla aynı eski mesafeyi görmesi engellendi.

## Test notu

Bu çalışma ortamında projenin `node_modules` klasörü bulunmadığı ve dış ağdan npm paketleri indirilemediği için tam `npm run build` çalıştırılamadı. TypeScript sözdizimi ve yerel il/ilçe veri dosyası ayrı olarak kontrol edildi. Deploy ortamında normal `npm ci && npm run build` akışı kullanılmalıdır.
