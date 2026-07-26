import type { ClothingItem } from "@/lib/types";

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function sortByNewest<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function countItemsByWardrobe(items: ClothingItem[]) {
  return items.reduce<Map<string, number>>((counts, item) => {
    counts.set(item.wardrobeId, (counts.get(item.wardrobeId) ?? 0) + 1);
    return counts;
  }, new Map());
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const colorMap: Record<string, string> = {
  beyaz: "#f8fafc",
  siyah: "#111827",
  gri: "#6b7280",
  lacivert: "#172554",
  mavi: "#2563eb",
  yeşil: "#16a34a",
  kırmızı: "#dc2626",
  bordo: "#7f1d1d",
  pembe: "#ec4899",
  mor: "#7c3aed",
  sarı: "#facc15",
  turuncu: "#f97316",
  kahverengi: "#92400e",
  bej: "#d6c4a7",
};

export function colorToSwatch(color: string) {
  return colorMap[color.trim().toLocaleLowerCase("tr-TR")] ?? "#0f766e";
}
