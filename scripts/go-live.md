# Yanımda Türkiye — Canlıya geçiş kontrol listesi

> **Güvenlik sınırı:** Bu belge yalnızca operatörün elle uygulayacağı adımları tarif eder. PR hazırlığı sırasında canlı D1'e bağlanılmaz, migration çalıştırılmaz, webhook kurulmaz, merge veya deploy yapılmaz.
>
> **Sıralama zorunludur:** Webhook'u deploy'dan **ÖNCE kurmayın**. Önce PR #32'yi elle merge edin ve Cloudflare deploy'un tamamlandığını doğrulayın; ancak bundan sonra `telegram-webhook.sh set` çalıştırın.

## Betik statik kontrolü

- GitHub Actions CI, `scripts/telegram-webhook.sh` dosyasını ShellCheck ile denetler.
- Yerel olarak da `shellcheck --shell=bash scripts/telegram-webhook.sh` komutuyla aynı kontrolü çalıştırabilirsiniz. ShellCheck yerelde kurulu değilse, PR dalının CI kontrolündeki ShellCheck adımının başarılı olmasını bekleyin.
- Bu hazırlık oturumunda betik çalıştırılmadı; yalnızca Bash sözdizimi `bash -n` ile kontrol edildi.

> **Telegram API güvenliği:** `TELEGRAM_API_BASE_URL` yalnızca `http://127.0.0.1` veya `http://localhost` loopback adresleriyle yerel testte kullanılabilir. Harici/HTTPS adresleri yok sayılır ve `https://api.telegram.org` kullanılır. **`TELEGRAM_API_BASE_URL` değişkenini Cloudflare'a eklemeyin.** Üretimde Telegram tokeni yalnızca resmi Telegram API adresine gönderilmelidir.

## 0. Ön koşullar ve BotFather token kontrolü

- [ ] BotFather'da eski bot tokeninin `/revoke` komutuyla iptal edildiğini doğrulayın.
- [ ] Yeni tokenin yalnızca Cloudflare secret `TELEGRAM_BOT_TOKEN` içinde kayıtlı olduğunu doğrulayın. Tokeni sohbete, repoya, terminal komut satırı geçmişine veya loglara yazmayın.
- [ ] Cloudflare Worker'ın doğru üretim projesi ve D1 binding'i kullandığını doğrulayın.
- [ ] Bakım penceresi, erişim ve geri dönüş sorumlusu belirleyin.

**Doğrulama:** BotFather'da eski token artık geçerli olmamalı; yeni token ile gizli değeri göstermeden Cloudflare secret kaydının mevcut olduğunu kontrol edin. Tokeni test amacıyla buraya yapıştırmayın.

## 1. Canlı D1 yedeğini alın

Komutları repo kök dizininde, doğru Cloudflare hesabına giriş yapmış operatör çalıştırır:

```bash
mkdir -p backups
npx wrangler d1 export yaninda-turkiye-db --remote --output ./backups/yaninda-turkiye-db-before-pr32.sql --config ./wrangler.jsonc
```

- [ ] Komutun başarılı bittiğini doğrulayın.
- [ ] Yedek dosyasının sıfırdan büyük olduğunu kontrol edin.
- [ ] Yedeği repo dışında, erişimi kısıtlı güvenli bir konuma ikinci kez kopyalayın.
- [ ] Yedek dosyasını repoya eklemeyin. `/backups/` yolu `.gitignore` içindedir.

**Doğrulama:**

```bash
test -s ./backups/yaninda-turkiye-db-before-pr32.sql
ls -lh ./backups/yaninda-turkiye-db-before-pr32.sql
git check-ignore -v ./backups/yaninda-turkiye-db-before-pr32.sql
```

Dosyanın boyutu ve `git check-ignore` çıktısı doğrulanmadan devam etmeyin.

## 2. Canlı D1 migration denetimi — uygulama YASAK

**Önce yalnızca salt-okunur denetim yapın.** Migration numaraları, main/feature branch geçmişi ve canlı D1 durumu doğrulanmadan canlıya migration uygulamayın.

Repo kökünde:

```bash
bash scripts/d1-readonly-audit.sh
```

Bu betik yalnızca migration listesini, `d1_migrations` adlarını, `sqlite_master` nesne adlarını ve her nesne için şema amaçlı `PRAGMA table_info` çıktısını alır. Rapor `d1-audit-report.txt` dosyasına yazılır; kullanıcı verisi satırları sorgulanmaz.

- [ ] Denetim raporu eksiksiz oluştu.
- [ ] Canlıda uygulanmış en yüksek migration numarası belirlendi.
- [ ] Repoda bulunmayan uygulanmış migration varsa dosya eksikliği ve canlı şema çıktısı kaydedildi.
- [ ] PR #32'nin henüz uygulanmamış analitik migration'ları, denetim sonucuna göre sonraki uygun numaralara taşındı.
- [ ] Uygulanmış migration dosyalarının adı/içeriği değiştirilmedi.
- [ ] CI, `PRAGMA table_info` ile `ALTER TABLE ADD COLUMN` hedeflerinin migration öncesinde mevcut olmadığını doğruladı.

**Bu maddeler tamamlanmadan canlı D1 için migration apply komutu çalıştırmayın.** Migration numaralandırma kararı için `scripts/d1-migration-resequence.md` belgesini izleyin. Canlıya yazma, yedek, migration, deploy ve merge işlemleri bu PR hazırlık çalışmasının kapsamı dışındadır.

## 2A. PR #32 izole test ortamı

Gerçek cihaz testi için yalnızca `env.pr32-test` ve `yaninda-turkiye-pr32-test` D1 veritabanı kullanılmalıdır. Kurulum sırası ve her komutun güvenlik gerekçesi `scripts/pr32-test-setup.md` içindedir. Eski preview ve canlı DB kullanılmaz.

## 3. Cloudflare Telegram secret'larını kontrol edin

Cloudflare Dashboard → Workers & Pages → `yaninda-turkiye` → Settings → Variables and Secrets:

- [ ] `TELEGRAM_BOT_TOKEN` zaten kayıtlı; yalnızca varlığını doğrulayın.
- [ ] `TELEGRAM_WEBHOOK_SECRET` secret olarak kayıtlı.
- [ ] `TELEGRAM_ADMIN_CHAT_IDS` secret veya uygun korumalı değişken olarak kayıtlı; yalnızca izin verilen yönetici chat ID'leri, virgülle ayrılmış biçimde girilmiş.
- [ ] Değerleri ekrana, sohbete veya loglara kopyalamayın.

**Doğrulama:** Üç değişkenin doğru Worker ortamında mevcut olduğunu Cloudflare arayüzünden, değerlerini açığa çıkarmadan kontrol edin. Secret ekleme/değiştirme işlemi deploy başlatıyorsa bu adımı PR merge/deploy sırasıyla koordine edin.

## 4. PR #32'yi elle merge edin ve deploy'u bekleyin

- [ ] PR #32'nin en son commit'inde CI `success` olmalı.
- [ ] PR #32'yi operatör elle merge etmeli.
- [ ] Cloudflare deploy workflow'unun tamamlanmasını bekleyin.
- [ ] Worker'ın son commit ile güncellendiğini doğrulayın.

**Doğrulama:** GitHub PR #32 merge durumu ve Actions deploy run sonucu başarılı olmalı. Worker health endpoint'i ve commit bilgisini kontrol edin. Bu adım tamamlanmadan webhook kurmayın.

## 5. Deploy sonrasında webhook'u kurun ve kontrol edin

Repo kökünde, güvenli yerel terminal oturumunda ortam değişkenlerini önceden ayarlayın. Değerleri komuta doğrudan yazmayın; shell history'ye düşürmeyin.

```bash
export TELEGRAM_BOT_TOKEN
export TELEGRAM_WEBHOOK_SECRET
export SITE_URL
bash scripts/telegram-webhook.sh set
bash scripts/telegram-webhook.sh info
```

`SITE_URL` üretim Worker adresi olmalı: `https://yaninda-turkiye.sabakbekir.workers.dev`.

- [ ] `set` başarılı dönüyor.
- [ ] `info` sonucunda webhook URL'si `/api/telegram` ile bitiyor.
- [ ] `allowed_updates` içinde `message` görünüyor.
- [ ] `pending_update_count` art arda yükselmiyor ve `last_error_message` yok.

**Gizli bilgi:** Betik tokeni yalnızca ortam değişkeninden okur; hata çıktısında gizli değerleri göstermez. Komut satırına tokeni argüman olarak vermeyin.

## 6. Telegram bot komutunu doğrulayın

- [ ] Yetkili yönetici Telegram hesabından bota `/durum` gönderin.
- [ ] Botun son 24 saat olay/hata sayısı, bekleyen işletme başvurusu ve açık bildirim sayılarını döndürdüğünü kontrol edin.
- [ ] Yetkisiz bir chat ID'den komut gönderildiğinde botun yanıt vermediğini doğrulayın.

**Doğrulama:** Yetkili hesapta beklenen yanıt görünmeli; Worker loglarında token, webhook secret veya kullanıcıya ait kişisel veri bulunmamalı.

## 7. Sorun olursa geri dönüş

1. Webhook'u durdurun:

   ```bash
   bash scripts/telegram-webhook.sh delete
   bash scripts/telegram-webhook.sh info
   ```

   `info` çıktısında webhook URL'si boş olmalı.

2. Önceki çalışan Worker sürümüne Cloudflare Deployments ekranından geri dönün.
3. D1 geri yüklemesini yalnızca bakım penceresinde ve açıkça onaylanmış kurtarma planıyla yapın. Yedek SQL'i doğrudan mevcut veritabanına körlemesine import etmeyin.
4. Önce yedeği ayrı/geçici bir D1 veritabanına yükleyip tablo ve kayıt sayılarını doğrulayın. Ardından doğru veritabanına geri yükleme kararını verin.

Örnek geri yükleme komutu **yalnızca doğrulanmış hedef veritabanı için**:

```bash
npx wrangler d1 execute <RESTORE_DATABASE_NAME> --remote --file ./backups/yaninda-turkiye-db-before-pr32.sql
```

**Doğrulama:** Geri yüklenen DB'de beklenen tabloları ve kritik kayıt sayılarını karşılaştırın; Worker'ın doğru DB binding'ine döndüğünü kontrol edin. Orijinal DB'yi doğrulama tamamlanmadan silmeyin veya üzerine yazmayın.

## 8. İlk 24 saat izleme

- [ ] Cloudflare Worker loglarında `/api/track` ve `/api/telegram` hatalarını izleyin.
- [ ] `/api/delete-request` için 4xx/5xx ve rate-limit yanıtlarını izleyin.
- [ ] Admin analitik ekranında kart, grafik, ısı haritası ve olay sayılarını kontrol edin.
- [ ] Telegram'a yeni işletme başvurusu, hatalı yer bildirimi ve tekrarlayan istemci hatası bildirimlerinin geldiğini kontrol edin.
- [ ] Bildirimlerde kişisel veri veya gizli anahtar olmadığını doğrulayın.
- [ ] İlk gün sonunda webhook `pending_update_count` ve son hata alanını tekrar kontrol edin.

---

## iPhone / preview adresi — elle test listesi

Bu liste gerçek cihazda, preview adresinde elle uygulanmalıdır. Bu hazırlık sırasında iPhone/preview üzerinde etkileşim testi yapılmadı.

### İzin bandı ve gizlilik
- [ ] Onay bandında **Reddet**: tercih kaydediliyor; analitik izleme isteği gönderilmiyor.
- [ ] **Kabul et**: izin sonrası beklenen analitik olaylar gönderiliyor.
- [ ] İzni geri çek: oturum/izin verileri temizleniyor.
- [ ] Geri çekme sonrasında Network panelinde yeni `/api/track` isteği oluşmadığını doğrulayın.
- [ ] Gizlilik sayfasından silme talebi gönderin.
- [ ] Yanıttaki `deleted` sayısını kontrol edin; preview D1'de aynı `session_id` için `events` satırı kalmadığını ve iptal kaydının oluştuğunu doğrulayın.

### Uygulama gezinmesi
- [ ] Arama ve sonuçların yüklenmesi.
- [ ] Kategori seçimi ve kategori değişimi.
- [ ] Yer kartı açma/kapatma ve kart içeriği.
- [ ] Telefonla arama bağlantısı.
- [ ] Yol tarifi bağlantısı.
- [ ] Liste kaydırma ve sayfa içinde gezinme.
- [ ] Reklam alanı ve reklam tıklaması; tıklama hedefinin doğru açılması.

### Admin analitik ekranı
- [ ] Özet kartlarının yüklenmesi ve sayılarının makul olması.
- [ ] Grafiklerin veriyle çizilmesi.
- [ ] Isı haritasının yüklenmesi.
- [ ] CSV dışa aktarımının indirilmesi ve içeriğinin doğru olması.

### Rate limit kontrolü — kod incelemesi ve preview testi

Kod incelemesinde:
- `/api/delete-request`: aynı-origin kontrolü ve `rateLimited(..., 'delete-request', 5, 3600)` mevcut.
- `/api/telegram`: webhook secret doğrulamasından sonra `rateLimited(..., 'telegram-webhook', 60, 60)` mevcut.
- `/api/track`: aynı-origin kontrolü ve `rateLimited(..., 'track', 90, 60)` mevcut.
- Ortak `rateLimited` fonksiyonu D1/limit kontrolünde hata olursa fail-closed davranıyor.

**Preview'da elle doğrulama:**
- [ ] `/api/delete-request` için aynı preview istemci/IP üzerinden bir saatlik pencere içinde sınırı aşan isteklerde HTTP 429 geldiğini doğrulayın. Testi yalnızca preview verisiyle yapın; canlıda denemeyin.
- [ ] `/api/telegram` için doğru secret header ile aynı IP'den dakikalık sınır aşıldığında HTTP 429 geldiğini doğrulayın. Test güncellemesi admin chat ID'si olmayan bir chat ile yapılmalı; canlı webhook'a test flood'u göndermeyin.
- [ ] Secret header eksik/yanlışken webhook'un HTTP 401 verdiğini doğrulayın.
- [ ] Bu testlerde response/log çıktılarında bot tokeni veya webhook secret bulunmadığını kontrol edin.

**Raporlama ayrımı:** Kodun rate limit arkasında olduğu kaynak kodundan doğrulandı; preview ortamında gerçek HTTP 429 testi henüz yapılmadı. iPhone görsel/etkileşim testleri de kullanıcı tarafından yapılmalıdır.


## Telegram bot duman testi (sahte verilerle yerel / gerçek botta operatör kontrolü)

Bu bölümdeki yerel testler sahte token/secret/chat ID kullanır ve Telegram API çağrısını mock'lar. Gerçek botta yapılacak adımlar yalnızca deploy sonrasında operatör tarafından uygulanır; tokeni sohbete veya loglara yazmayın.

### BotFather komutları

BotFather'da `/setcommands` seçin ve aşağıdaki iki satırı gönderin:

```text
durum - Sistem durumu
yardim - Komut listesi
```

### Yerel webhook duman testi

Yerel Worker/Pages ortamında yalnızca sahte değerler tanımlayın:

```bash
export TELEGRAM_BOT_TOKEN='fake-local-token'
export TELEGRAM_WEBHOOK_SECRET='fake-local-webhook-secret'
export TELEGRAM_ADMIN_CHAT_IDS='12345'
```

Telegram API çağrıları testlerde mock edilmelidir; bu testlerde gerçek Telegram ağına istek gönderilmez. Sahte webhook update senaryoları:

- [ ] Eksik veya yanlış `X-Telegram-Bot-Api-Secret-Token`: HTTP 401.
- [ ] İzin listesinde olmayan chat ID: HTTP 200, Telegram'a yanıt gönderilmez.
- [ ] Yetkili chat'ten `/yardim`: kısa Türkçe komut listesi.
- [ ] Yetkili chat'ten `/durum`: D1 tablolarından gelen olay, hata, bekleyen başvuru ve açık bildirim sayıları.
- [ ] Dakikada 60 isteği aşan webhook: HTTP 429.
- [ ] Boş mesaj ve komut dışı metin: yanıt gönderilmez.
- [ ] Bilinmeyen slash komutu: kısa yardım yönlendirmesi.
- [ ] Grup/süpergrup: yalnızca chat ID allowlist'te ise yanıt.
- [ ] Uzun metin: Telegram 4096 karakter sınırının altında tutulur.

### Deploy sonrasında gerçek bot doğrulaması

Bu adımlar PR hazırlığında çalıştırılmaz. Merge ve deploy sonrasında operatör uygular:

1. BotFather'da eski tokeni `/revoke` ile iptal edin. Yeni tokeni yalnızca Cloudflare secret olarak saklayın.
2. `getMe` ile bot kimliğini doğrulayın. Tokeni komut satırına sabit olarak yazmayın; `TELEGRAM_BOT_TOKEN` ortam değişkeninden kullanın. URL'yi veya ham cevabı ekrana/loga basmayın; yalnızca güvenli alanları seçin:

   ```bash
   curl --silent --show-error \
     "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \
     | jq '{ok, result: {id: .result.id, username: .result.username}}'
   ```

   Komut geçmişine tokeni yazmayın; shell history'de yalnızca değişken adı bulunan komut satırını tutun.
3. `scripts/telegram-webhook.sh set` sonrasında `info` veya Telegram `getWebhookInfo` sonucunda `pending_update_count` ve `last_error_message` alanlarını kontrol edin. Webhook URL'si doğru Worker adresinin `/api/telegram` yoluna gitmeli.
4. Yetkili hesaptan @YanindaTurkiyeBot'a `/durum` ve `/yardim` yazın; beklenen Türkçe yanıtları doğrulayın.
5. Yetkisiz hesaptan komut gönderin; botun yanıt vermediğini doğrulayın.
6. BotFather'da eski tokenin `/revoke` ile iptal edildiğini tekrar teyit edin.

Gerçek Telegram doğrulaması tamamlanmadan bu adımları tamamlandı olarak işaretlemeyin.
