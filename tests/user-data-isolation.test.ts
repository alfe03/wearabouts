import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClothingItemRecord,
  createWardrobeRecord,
  listClothingItems,
  listWardrobes,
} from "../src/lib/storage/database";
import {
  clearLocalUserSession,
  getLocalUserSession,
  registerLocalUserSession,
  signInLocalUserSession,
} from "../src/lib/storage/user-session";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256",
  },
  digestStringAsync: vi.fn((_algorithm: string, value: string) =>
    Promise.resolve(`hash:${value}`),
  ),
  getRandomBytes: vi.fn((byteCount: number) =>
    Uint8Array.from({ length: byteCount }, (_value, index) => index + 1),
  ),
}));

beforeEach(() => {
  storage.clear();
});

describe("yerel kullanıcı veri ayrımı", () => {
  it("aynı e-posta aynı profili açar ve çıkış sadece aktif oturumu kapatır", async () => {
    const firstLogin = await registerLocalUserSession({
      name: "Cemil",
      email: "CEMIL@example.com",
      password: "123456",
    });

    await clearLocalUserSession();

    const secondLogin = await signInLocalUserSession({
      email: "cemil@example.com",
      password: "123456",
    });

    expect(secondLogin.id).toBe(firstLogin.id);
    expect(secondLogin.name).toBe("Cemil");
    expect(await getLocalUserSession()).toEqual(secondLogin);
  });

  it("hatalı şifreyi reddeder ve aynı e-posta ile ikinci kayıt açmaz", async () => {
    await registerLocalUserSession({
      name: "Cemil",
      email: "cemil@example.com",
      password: "123456",
    });

    await expect(
      signInLocalUserSession({
        email: "cemil@example.com",
        password: "abcdef",
      }),
    ).rejects.toThrow("Şifre hatalı.");

    await expect(
      registerLocalUserSession({
        name: "Cemil",
        email: "cemil@example.com",
        password: "123456",
      }),
    ).rejects.toThrow("Bu e-posta ile yerel profil zaten var.");
  });

  it("gardırop ve kıyafetleri kullanıcıya göre ayırır", async () => {
    const firstUser = await registerLocalUserSession({
      name: "Cemil",
      email: "cemil@example.com",
      password: "123456",
    });
    const firstWardrobe = await createWardrobeRecord({
      userId: firstUser.id,
      name: "Ev",
    });
    await createClothingItemRecord({
      userId: firstUser.id,
      wardrobeId: firstWardrobe.id,
      name: "Beyaz gömlek",
      category: "Üst giyim",
      type: "Gömlek",
      primaryColor: "Beyaz",
    });

    const secondUser = await registerLocalUserSession({
      name: "Ayşe",
      email: "ayse@example.com",
      password: "abcdef",
    });
    await createWardrobeRecord({
      userId: secondUser.id,
      name: "Yazlık",
    });

    expect((await listWardrobes(firstUser.id)).map((wardrobe) => wardrobe.name)).toEqual([
      "Ev",
    ]);
    expect((await listWardrobes(secondUser.id)).map((wardrobe) => wardrobe.name)).toEqual([
      "Yazlık",
    ]);
    expect(await listClothingItems(secondUser.id)).toEqual([]);
  });
});
