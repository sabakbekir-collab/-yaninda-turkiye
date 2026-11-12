# Telegram bot kurulumu

Bu belge yalnızca operatör talimatıdır. Bot tokenini sohbete, Git deposuna, ekran görüntüsüne veya komut geçmişine yapıştırmayın.

## 1. Eski tokeni iptal et

1. Telegram'da doğrulanmış **@BotFather** sohbetini açın.
2. `/revoke` komutunu gönderin ve `@YanindaTurkiyeBot` botunu seçin.
3. Eski tokenin artık çalışmadığını BotFather'dan doğrulayın.
4. Yeni token üretildiyse yalnızca kendi güvenli parola yöneticinizde saklayın.

## 2. Cloudflare gizli değerlerini ekle

Cloudflare Dashboard → Workers & Pages → Yanımda Türkiye → Settings → Variables and Secrets → Production:

- `TELEGRAM_BOT_TOKEN` — BotFather'ın verdiği yeni bot tokeni (**Secret**).
- `TELEGRAM_WEBHOOK_SECRET` — En az 32 karakterlik, tahmin edilemez rastgele değer (**Secret**). Telegram secret token karakter kümesine uygun olarak yalnızca A-Z, a-z, 0-9, alt çizgi ve tire kullanın.
- `TELEGRAM_ADMIN_CHAT_IDS` — Yönetici Telegram sohbet kimlikleri, virgülle ayrılmış liste (ör. `123456789,-1001234567890`). Bu değer gizli değişken olarak saklanmalıdır.

Önceki/yanlış bot tokeni veya secret değerini tekrar kullanmayın. Değişiklikleri kaydetmeden önce Production ortamının seçili olduğunu doğrulayın. Bu PR kendi kendine deploy yapmaz; değişkenleri eklemek canlı deploy başlatabilir. Deploy düğmesine basmadan önce değişiklik penceresini ve onayını ayrıca değerlendirin.

## 3. Webhook'u kendi terminalinizden ayarla

Tokeni terminal komut satırına düz metin olarak yazmayın. Aşağıdaki örnek Bash oturumunda token ve webhook secret etkileşimli olarak gizli okunur; komut geçmişine girmez. Bu işlemi yalnızca Worker sürümü ve gerekli Production secret'ları bilinçli olarak etkinleştirildikten sonra yapın.

```bash
read -rsp "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
read -rsp "Telegram webhook secret: " TELEGRAM_WEBHOOK_SECRET; echo
WEBHOOK_URL="https://yaninda-turkiye.sabakbekir.workers.dev/api/telegram"
curl --fail-with-body --silent --show-error \
  --request POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'
unset TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
```

Yanıt içinde `"ok":true` ve `"result":true` görmelisiniz. Terminal çıktısını paylaşırken hassas alanları maskeleyin.

## 4. Webhook'u doğrula

Aynı gizli okuma yöntemini kullanarak tokeni tekrar girin:

```bash
read -rsp "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
curl --fail-with-body --silent --show-error \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
unset TELEGRAM_BOT_TOKEN
```

`url` alanı `https://yaninda-turkiye.sabakbekir.workers.dev/api/telegram` olmalı; `last_error_message` alanı bulunmamalı. Yanıtı herkese açık paylaşmayın.

## 5. Yönetici sohbetini test et

1. Botla özel sohbet açıp **Başlat** düğmesine basın.
2. Yönetici sohbet kimliğinin `TELEGRAM_ADMIN_CHAT_IDS` içinde olduğundan emin olun.
3. `/yardim`, ardından `/durum` gönderin.
4. Yönetici listesinde olmayan başka bir sohbetten komut gönderildiğinde botun cevap vermediğini doğrulayın.
5. Yeni işletme başvurusu ve hatalı bildirim oluşturulduğunda yönetici sohbetine yalnızca genel, kişisel veri içermeyen bildirim geldiğini kontrol edin.

## Bilinen sınırlar

- Bot komutları ve bildirimler yalnızca Worker'da ilgili Production secret'ları ve webhook etkinleştirildikten sonra çalışır.
- /durum, mevcut D1 tablolarındaki son 24 saat olay/hata sayılarını ve bekleyen başvuru/açık hatalı bildirim sayılarını okur.
- Telegram erişilemezse bildirimler kaybolabilir; ana uygulama akışı etkilenmez.
- Tekrarlayan istemci hatası uyarısı yalnızca genel hata kodu parmak izini kullanır; IP, oturum kimliği veya serbest metin göndermez.
- Bu PR canlı D1 migration'ı, merge veya deploy yapmaz.
