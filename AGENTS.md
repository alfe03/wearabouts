# Proje Notları

## Amaç

Dijital Gardırop, iPhone'da Expo Go ile çalışacak yerel-first bir React Native uygulamasıdır. Bu aşamada yalnızca kıyafet ve ayakkabı takibi vardır.

## Klasör Yapısı

- `App.tsx` ve `index.ts`: Expo uygulama girişi.
- `app.json`: Expo uygulama adı, ikon ve splash yapılandırması.
- `src/screens`: Mobil ekran akışları.
- `src/lib`: Tipler, Zod şemaları, veri yardımcıları ve yerel saklama.
- `tests`: Vitest birim testleri.
- `assets/images`: Expo ikon ve splash görselleri.

## Komutlar

- `npm start`: Expo geliştirme sunucusu ve QR kod.
- `npm run android`: Android hedefi için Expo başlatma.
- `npm run ios`: macOS'ta iOS simülatörü; Windows'ta iPhone için `npm start` ve Expo Go kullanılır.
- `npm run typecheck`: TypeScript kontrolü.
- `npm run lint`: Expo ESLint kontrolü.
- `npm run test`: Vitest birim testleri.

## Kodlama Kuralları

- TypeScript strict mode korunur.
- UI React Native bileşenleriyle yazılır; Next.js, DOM, web-only API veya PWA kodu eklenmez.
- Form doğrulama Zod şemaları üzerinden yapılır ve hata metinleri Türkçe tutulur.
- Kalıcı veri bu sürümde AsyncStorage içindedir.
- Kıyafet `id` değeri gardıroptan bağımsız ve kalıcıdır; ileride bavul kayıtları bu id üzerinden ilişkilendirilebilir.
- Çalışmayan placeholder buton, API anahtarı veya sahte AI akışı eklenmez.

## Test ve Tamamlanma Kriterleri

- Typecheck, lint ve birim testleri başarılı olmalıdır.
- Ana akış: gardırop oluşturma, gardırobu açma, manuel kıyafet ekleme ve listede görme.
- iPhone ekranında yatay taşma yaratacak sabit genişliklerden kaçınılmalıdır.

## Kapsam Dışı

Kullanıcı hesabı, backend, bulut veritabanı, ödeme, AI fotoğraf analizi, gerçek fotoğraf yükleme, seyahat, bavul, kombin, hava durumu, sosyal özellikler ve web/PWA bu sürümde yoktur.
