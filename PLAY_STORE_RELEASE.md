# Google Play Store yayın hazırlığı

## Mevcut otomasyon

- `.github/workflows/android-verify.yml`: Android debug APK derlemesini doğrular ve test APK'sını Actions artifact olarak verir.
- `.github/workflows/android-release.yml`: imzalı Play Store AAB üretir. Workflow manuel başlatılır.
- Android uygulama kimliği: `tr.yaninda.turkiye`
- Sürüm: `1.0.1 (versionCode 2)`
- Hedef SDK: Android 16 / API 36.
- Release imzası repoya eklenmez; GitHub Actions secrets üzerinden alınır.

## Bir defalık imzalama anahtarı

Play App Signing kullanılsa bile ilk yükleme için upload key gerekir. Bir bilgisayarda Android Studio/Java ile bir upload keystore üret ve güvenli bir yerde yedekle. Keystore dosyasını, parolalarını veya private key'i GitHub'a normal dosya olarak commit etme.

GitHub deposu → Settings → Secrets and variables → Actions bölümüne şu dört secret eklenmelidir:

1. `ANDROID_KEYSTORE_BASE64`: keystore dosyasının Base64 içeriği.
2. `ANDROID_KEYSTORE_PASSWORD`: keystore parolası.
3. `ANDROID_KEY_ALIAS`: anahtar takma adı.
4. `ANDROID_KEY_PASSWORD`: anahtar parolası.

Keystore Base64 değeri, dosyanın Base64 kodlanmış içeriğidir. Anahtar ve parolaları kaybedersen sonraki güncellemeler zorlaşır; güvenli çevrimdışı yedek tut.

## AAB üretme

GitHub → Actions → **Build signed Android App Bundle** → Run workflow.

Dört imzalama secret'ı doğruysa workflow `yaninda-turkiye-play-store-aab` adlı artifact üretir. Artifact içindeki `app-release.aab`, Play Console'a yüklenecek dosyadır. Bu workflow henüz Play Console'a otomatik yayın yapmaz.

## Play Console'da tamamlanması gerekenler

- Geliştirici hesabı ve uygulama kaydı.
- Uygulama adı, kısa/tam açıklama, 512×512 uygulama simgesi ve 1024×500 özellik grafiği.
- Gerçek cihazlardan alınmış telefon ekran görüntüleri; boş `store-listing/screenshots` klasörleri ekran görüntüsü yerine geçmez.
- Herkese açık, çalışan gizlilik politikası URL'si ve uygulama içi gizlilik/iletişim bilgileri.
- Data safety formu: konumun kullanımını, ağ isteklerini, analiz olaylarını ve üçüncü taraf veri sağlayıcılarını doğru beyan et.
- Reklam beyanı: sponsorlu işletme kartları/reklam alanları bulunduğundan reklam içerir olarak işaretle.
- İçerik derecelendirmesi, hedef kitle, uygulama erişim bilgileri ve gerekli politika beyanları.
- Android 16 / API 36 hedefi ve imzalı AAB.
- Yeni kişisel geliştirici hesaplarında üretim erişiminden önce kapalı testte en az 12 test kullanıcısının kesintisiz 14 gün katılım şartı uygulanabilir; Play Console hesabının türüne göre ekrandaki şartları takip et.

## Yayın öncesi ürün kontrolü

- Nöbetçi eczane verisi güncellik/doğrulama uyarısıyla gösterilmeli; eczane sonuçlarında reklam gösterilmemeli.
- Telefon, yol tarifi, konum izni, favoriler, başvuru ve raporlama akışları gerçek Android cihazda denenmeli.
- Admin panelinde örnek/uydurma istatistikler gerçekmiş gibi gösterilmemeli.
- Uygulama içindeki gizlilik metni ve Play Console Data safety yanıtları gerçek uygulama davranışıyla aynı olmalı.
- Erişilebilirlik, ekran boyutları, geri tuşu ve çevrimdışı/hata durumları test edilmeli.

## Yayın sınırı

GitHub Actions AAB dosyasını üretebilir; Google Play Console geliştirici hesabına erişim, upload key secret'larının kurulması, mağaza görselleri, Data safety beyanları ve Google inceleme/onayı olmadan uygulama herkese açık Play Store'da görünmez.
