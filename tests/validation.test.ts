import { describe, expect, it } from "vitest";
import {
  countItemsByWardrobe,
  normalizeOptionalText,
  sortByNewest,
} from "../src/lib/data-utils";
import type { ClothingItem } from "../src/lib/types";
import {
  clothingItemFormSchema,
  localUserLoginFormSchema,
  localUserRegistrationFormSchema,
  wardrobeFormSchema,
} from "../src/lib/validation";

describe("form doğrulama", () => {
  it("gardırop adını zorunlu tutar", () => {
    const result = wardrobeFormSchema.safeParse({ name: " ", description: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Gardırop adı zorunludur.");
    }
  });

  it("manuel kıyafet için zorunlu alanları doğrular", () => {
    const result = clothingItemFormSchema.safeParse({
      wardrobeId: "wardrobe_1",
      name: "Beyaz gömlek",
      category: "Üst giyim",
      type: "Gömlek",
      primaryColor: "Beyaz",
      brand: "",
      notes: "  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("yerel kullanıcı girişini doğrular ve e-postayı normalize eder", () => {
    const result = localUserRegistrationFormSchema.safeParse({
      name: " Cemil ",
      email: " CEMIL@EXAMPLE.COM ",
      password: "123456",
      passwordConfirmation: "123456",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Cemil");
      expect(result.data.email).toBe("cemil@example.com");
    }

    expect(
      localUserLoginFormSchema.safeParse({ email: "yanlış", password: "123456" })
        .success,
    ).toBe(false);
    expect(
      localUserRegistrationFormSchema.safeParse({
        name: "Cemil",
        email: "cemil@example.com",
        password: "123456",
        passwordConfirmation: "abcdef",
      }).success,
    ).toBe(false);
  });
});

describe("veri yardımcıları", () => {
  it("boş opsiyonel metinleri undefined yapar", () => {
    expect(normalizeOptionalText("  ")).toBeUndefined();
    expect(normalizeOptionalText(" Mavi ")).toBe("Mavi");
  });

  it("gardırop başına kıyafet sayar ve yeni kayıtları öne alır", () => {
    const items: ClothingItem[] = [
      {
        id: "item_1",
        userId: "user_1",
        wardrobeId: "wardrobe_1",
        name: "Pantolon",
        category: "Alt giyim",
        type: "Pantolon",
        primaryColor: "Siyah",
        dataSource: "manual",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "item_2",
        userId: "user_1",
        wardrobeId: "wardrobe_1",
        name: "Ayakkabı",
        category: "Ayakkabı",
        type: "Sneaker",
        primaryColor: "Beyaz",
        dataSource: "manual",
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-01T10:00:00.000Z",
      },
    ];

    expect(countItemsByWardrobe(items).get("wardrobe_1")).toBe(2);
    expect(sortByNewest(items)[0].id).toBe("item_2");
  });
});
