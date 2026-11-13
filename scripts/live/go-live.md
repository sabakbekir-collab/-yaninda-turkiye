# PR #32 — canlı geçiş rehberi
Canlı D1 yazımı, deploy ve merge bu PR hazırlığı kapsamında yapılmaz.

1. **CI:** PR #32'nin en güncel run'ında verify, Additive D1 schema smoke + Worker E2E ve Local Worker E2E başarılı olmalı. Geri dönüş: kırmızı job varsa dur, logu düzeltip CI'ı yeniden çalıştır.
2. **Preflight:** `DB_TARGET=remote bash scripts/live/go-live.sh preflight`; yedeği repo dışına güvenli kopyala. Geri dönüş: hata varsa apply/merge/deploy etme, yedek ve login sorununu çöz.
3. **Apply:** `DB_TARGET=remote bash scripts/live/go-live.sh apply`; preflight tekrar edilir ve EVET onayı istenir. Geri dönüş: hata anında dur, preflight ile durumu incele; scripts/live/rollback.md'yi izle.
4. **Verify:** `DB_TARGET=remote bash scripts/live/go-live.sh verify`; 27 kontrol PASS olmalı. Geri dönüş: eksik varsa merge/deploy etme, rollback.md'yi izle.
5. **Merge/deploy:** operatör PR'ı merge eder ve Cloudflare deploy'u bekler. Geri dönüş: önceki başarılı deployment'a dön; kolonları elle düşürme.
6. **Smoke:** `SITE_URL=https://yaninda-turkiye.sabakbekir.workers.dev bash scripts/live/smoke.sh`. Geri dönüş: FAIL olursa önceki deploy'a dön.
7. **Cloudflare secrets:** TELEGRAM_WEBHOOK_SECRET ve TELEGRAM_ADMIN_CHAT_IDS tanımla; TELEGRAM_API_BASE_URL EKLENMEZ. Secret sonrası yeniden deploy et. Geri dönüş: webhook set etme; secret/deploy sorununu çöz veya önceki deploy'a dön.
8. **Webhook:** TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET ve SITE_URL yalnızca güvenli ortamdan verilsin. `bash scripts/telegram-webhook.sh set`, sonra `bash scripts/telegram-webhook.sh info`. Geri dönüş: sorun varsa `bash scripts/telegram-webhook.sh delete`; tokenı loglama.
9. **Komut testi:** yetkili hesaptan /durum ve /yardim; yetkisiz hesaptan sessizlik. Geri dönüş: webhook delete, allowlist kontrolü, önceki deploy.
10. **BotFather:** /setcommands ile durum ve yardim tanımla; eski tokenı yeni token doğrulandıktan sonra /revoke et. Geri dönüş: yeni token çalışmadan eskisini iptal etme.
11. **İlk 24 saat:** health, hata oranı, analytics, webhook pending updates ve yetkisiz chat sessizliğini izle. Geri dönüş: önceki deploy'a dön ve webhook delete et; D1 için rollback.md.
