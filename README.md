# Dijital Gardırop

iPhone'da Expo Go ile çalışacak kişisel dijital gardırop uygulaması. Uygulama web/PWA değildir; React Native bileşenleriyle mobil çalışır.

Bu ilk sürümde backend, kullanıcı hesabı, bulut veritabanı, AI, fotoğraf yükleme, seyahat ve bavul özellikleri yoktur. Veriler telefondaki yerel AsyncStorage alanında saklanır.

## Kurulum

```bash
npm install
```

## iPhone'da Çalıştırma

```bash
npm start
```

Terminalde çıkan QR kodunu iPhone'daki Expo Go uygulamasıyla okutun. Bilgisayar ve telefon aynı Wi-Fi ağında olmalıdır. Ağ sorununda Expo arayüzünden `Tunnel` modunu seçebilirsiniz.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run test
```

## Temel Özellikler

- Gardırop oluşturma ve listeleme
- Toplam gardırop ve kıyafet sayıları
- Gardırop detayında kıyafet kartları
- Manuel kıyafet ekleme
- Kıyafet görüntüleme, düzenleme, başka gardıroba taşıma ve onaylı silme
- Telefonda kalıcı yerel saklama

## Veri Modeli

Ana varlıklar:

- `Wardrobe`: id, ad, açıklama, oluşturulma ve güncellenme tarihleri
- `ClothingItem`: id, wardrobeId, ad, kategori, tür, ana renk, marka, not, ileride fotoğraf için opsiyonel alan, dataSource, oluşturulma ve güncellenme tarihleri

Kıyafet id'si gardıroptan bağımsızdır. İleride bavul kayıtları kıyafetleri bu id ile referanslayabilir; kıyafeti bavula eklemek gardırop kaydını silmek anlamına gelmez.

## Notlar

Expo SDK 57 kullanılır. Yerel veri için `@react-native-async-storage/async-storage`, doğrulama için `zod`, birim testleri için `vitest` kullanılır.
