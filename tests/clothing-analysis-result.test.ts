import { describe, expect, it } from "vitest";
import {
  isClothingCategory,
  normalizeAnalysisSuggestion,
} from "../src/lib/clothing-analysis-result";

describe("fotoğraf analiz sonucu", () => {
  it("geçerli AI önerisini forma uygun hale getirir", () => {
    const result = normalizeAnalysisSuggestion({
      name: " Beyaz tişört ",
      category: "Üst giyim",
      type: " Tişört ",
      primaryColor: " Beyaz ",
      brand: null,
      confidence: 1.4,
      brandConfidence: -1,
      notes: " Marka görünmüyor. ",
    });

    expect(result).toEqual({
      name: "Beyaz tişört",
      category: "Üst giyim",
      type: "Tişört",
      primaryColor: "Beyaz",
      brand: undefined,
      confidence: 1,
      brandConfidence: 0,
      notes: "Marka görünmüyor.",
    });
  });

  it("kategori, tür veya renk eksikse öneriyi reddeder", () => {
    expect(isClothingCategory("Ayakkabı")).toBe(true);
    expect(isClothingCategory("Aksesuar")).toBe(false);
    expect(
      normalizeAnalysisSuggestion({
        category: "Aksesuar",
        type: "Şapka",
        primaryColor: "Siyah",
      }),
    ).toBeUndefined();
  });
});
