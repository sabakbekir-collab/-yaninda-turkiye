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
