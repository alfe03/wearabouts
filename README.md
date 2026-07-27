# Dijital Gardırop

iPhone'da Expo Go ile çalışacak kişisel dijital gardırop uygulaması. Uygulama web/PWA değildir; React Native bileşenleriyle mobil çalışır.

Bu sürümde kıyafet ve ayakkabılar manuel veya fotoğraf analiziyle eklenebilir. Gardırop verileri yerel kullanıcı profiline göre ayrılır ve telefondaki AsyncStorage alanında saklanır; kıyafet fotoğrafları ise uygulamanın yerel dosya alanında kalır. Yerel profiller e-posta ve şifre ile açılır; şifre düz metin saklanmaz. AI analizi için ayrı bir yerel backend kullanılır; API anahtarı mobil uygulamaya gömülmez.

## Kurulum

```bash
npm install
```

AI analizi için `server/.env.local` dosyasında Gemini anahtarını tanımlayın:

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
```

## iPhone'da Çalıştırma

Backend'i ayrı bir terminalde başlatın:

```bash
npm run backend
```

Ardından Expo'yu başlatın:

```bash
npm start
```

Terminalde çıkan QR kodunu iPhone'daki Expo Go uygulamasıyla okutun. Bilgisayar ve telefon aynı Wi-Fi ağında olmalıdır. Uygulama geliştirme sırasında Expo'nun LAN IP'sinden `http://BILGISAYAR_IP:8787/api/analyze-clothing` adresini otomatik türetir.

Otomatik adres çalışmazsa Expo'yu şu ortam değişkeniyle başlatabilirsiniz:

```bash
$env:EXPO_PUBLIC_CLOTHING_ANALYZER_URL="http://BILGISAYAR_IP:8787/api/analyze-clothing"; npm start
```

## Kontroller

```bash
npm run typecheck
npm run lint
npm run test
```

## Temel Özellikler

- Gardırop oluşturma ve listeleme
- Yerel kullanıcı profiliyle şifreli giriş, kayıt ve çıkış; her profil kendi gardıroplarını görür
- Toplam gardırop ve kıyafet sayıları
- Gardırop detayında kıyafet kartları
- Manuel kıyafet ekleme
- Kamera veya galeriden fotoğraf seçerek AI destekli kıyafet önerisi alma
- Kıyafet görüntüleme, düzenleme, başka gardıroba taşıma ve onaylı silme
- Fotoğraf URI'siyle telefonda kalıcı yerel saklama

## Veri Modeli

Ana varlıklar:

- `LocalUser`: id, ad, e-posta, şifre hash bilgisi, oluşturulma ve son giriş tarihleri
- `Wardrobe`: id, userId, ad, açıklama, oluşturulma ve güncellenme tarihleri
- `ClothingItem`: id, userId, wardrobeId, ad, kategori, tür, ana renk, marka, not, opsiyonel fotoğraf bilgisi, dataSource, oluşturulma ve güncellenme tarihleri

Kıyafet id'si gardıroptan bağımsızdır. İleride bavul kayıtları kıyafetleri bu id ile referanslayabilir; kıyafeti bavula eklemek gardırop kaydını silmek anlamına gelmez.

## Notlar

Expo SDK 57 kullanılır. Yerel veri için `@react-native-async-storage/async-storage`, fotoğraf seçimi için `expo-image-picker`, dosya saklama için `expo-file-system`, doğrulama için `zod`, birim testleri için `vitest` kullanılır.

Backend `npm run backend` ile çalışan küçük bir Node HTTP servisidir. `POST /api/analyze-clothing` data URL formatında görsel alır, Gemini API ile analiz eder ve marka yalnızca fotoğrafta açıkça görünüyorsa döndürülür.
