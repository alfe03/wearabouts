import { clothingCategories } from "@/lib/types";
import type { ClothingAnalysisSuggestion, ClothingCategory } from "@/lib/types";

type RawAnalysisRecord = Record<string, unknown>;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : undefined;
}

export function isClothingCategory(value: unknown): value is ClothingCategory {
  return (
    typeof value === "string" &&
    clothingCategories.includes(value as ClothingCategory)
  );
}

export function normalizeAnalysisSuggestion(
  value: unknown,
): ClothingAnalysisSuggestion | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as RawAnalysisRecord;
  const category = isClothingCategory(record.category)
    ? record.category
    : undefined;
  const type = textValue(record.type);
  const primaryColor = textValue(record.primaryColor);

  if (!category || !type || !primaryColor) {
    return undefined;
  }

  return {
    name: textValue(record.name),
    category,
    type,
    primaryColor,
    brand: textValue(record.brand),
    confidence: numberValue(record.confidence),
    brandConfidence: numberValue(record.brandConfidence),
    notes: textValue(record.notes),
  };
}
