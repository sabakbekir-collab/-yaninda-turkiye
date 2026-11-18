# Canlıya geçiş notları

## Telegram yönetim komutları

Bu PR merge edilip Worker ayrıca dağıtıldıktan sonra aşağıdaki adımları uygulayın. PR aşamasında bu dosyadaki komutları çalıştırmayın.

1. Önce mevcut smoke testini çalıştırın: `bash scripts/smoke.sh`.
2. Telegram komut menüsünü kaydedin: `TELEGRAM_BOT_TOKEN` ortam değişkenini güvenli biçimde tanımlayıp `bash scripts/telegram-commands.sh` çalıştırın. Betik token'ı ekrana yazmaz; bot komut açıklamalarını Türkçe kaydeder.
3. Yönetici özel sohbetinde elle deneyin:
   - `/start`, `/yardim`, `/durum`
   - `/basvurular`, `/basvuru <id>`
   - `/onayla <id>` ve 60 saniye içinde `/evet <id>`
   - `/reddet <id> <kısa neden>` ve `/evet <id>`
   - `/bildirimler`, `/rapor`, `/sessiz 5`, `/ac`, `/saglik`
4. Yetkisiz bir özel hesaptan ve bir gruptan komut gönderin; ikisinden de sessiz 200 davranışı beklenir.
5. Onay ve ret testlerini yalnızca test başvurularıyla yapın. Gerçek başvurularda karar vermeden önce ayrıntıları yönetim panelinden kontrol edin.
6. Geri dönüş gerekirse Cloudflare Workers Deployments ekranından önceki başarılı deployment'a dönün. Ardından Telegram webhook'unu kaldırmak için token'ı güvenli ortam değişkeninden kullanan `deleteWebhook` Bot API çağrısını çalıştırın. Token'ı URL veya log olarak paylaşmayın.

## Güvenlik ve D1

- Bu PR canlıya otomatik geçiş yapmaz. Canlı D1'e erişmez ve migration uygulamaz.
- Yeni bir migration eklenirse yalnızca eklemeli/idempotent olacak ve canlıda elle uygulanacaktır.
- `scripts/local-e2e.sh` yalnızca Wrangler yerel D1 kullanır; canlı/uzak D1 seçeneği yoktur.

## Nöbetçi eczane

1. Canlı D1 yedeğini al.
2. `scripts/live/apply-duty.sql` dosyasını `wrangler d1 execute yaninda-turkiye-db --remote --file scripts/live/apply-duty.sql` ile elle uygula. PR/CI aşamasında bu komutu çalıştırma.
3. `scripts/live/verify-duty.sql` ile tabloları doğrula.
4. Cloudflare Worker Secrets'a gerekirse `DUTY_API_KEY` ekle; mevcut açık API anahtarsız. Secret paylaşma.
5. PR'ı merge et ve Worker'ı deploy et.
6. Telegram'da `/nobetsenk`, ardından 60 saniye içinde `/evet nobet` ile elle senkron iste.
7. `/nobetrapor` ve `/nobet İstanbul` test et.
8. Geri dönüş: önceki Worker deployment'a dön; veri silme gerekiyorsa yedek kontrolünden sonra `scripts/live/rollback-duty.md` yönergesini elle uygula.

**Kaynak:** Eczane Adresi API, CC BY 4.0, ticari kullanıma açık ve atıf gerekli. Diğer probe kaynaklarının koşulları doğrulanamadığı için otomatik bağlanmadı; CSV elle yükleme yedek yoldur; Eczane Adresi API'si için açık lisans ve atıf şartı bulunduğundan otomatik bağlayıcı kullanılabilir.

## Nöbet CSV yedek yükleme (birincil yol, kaynak payload doğrulanana kadar)

1. Güncel CSV'yi `scripts/duty-example.csv` biçiminde hazırla (il, ilçe, ad, telefon, adres, tarih).
2. Yerel bilgisayarda `node scripts/duty-import.mjs <csv-dosyası> <çıktı.sql` çalıştır. Betik yalnızca SQL dosyası üretir; D1 bağlantısı kurmaz.
3. Üretilen SQL'i kontrol et, canlı D1 yedeğini al ve elle uygula. Bu PR'da remote D1 komutu çalıştırılmayacak.
4. Otomatik Eczane Adresi senkronu `DUTY_SYNC_ENABLED=true` olmadan çalışmaz. API docs response shape `district` alanını kesin doğrulamadığı için varsayılan kapalıdır; payload doğrulanıp kaynak koşulları tekrar incelenmeden açma.
