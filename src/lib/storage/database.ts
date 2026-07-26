import AsyncStorage from "@react-native-async-storage/async-storage";
import { sortByNewest } from "@/lib/data-utils";
import type {
  ClothingItem,
  ClothingItemInput,
  Wardrobe,
  WardrobeInput,
} from "@/lib/types";

const STORAGE_KEY = "wearabouts:local-data:v1";

type StorageState = {
  version: 1;
  wardrobes: Wardrobe[];
  clothingItems: ClothingItem[];
};

const emptyState: StorageState = {
  version: 1,
  wardrobes: [],
  clothingItems: [],
};

async function readState(): Promise<StorageState> {
  const rawState = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    return emptyState;
  }

  try {
    const parsed = JSON.parse(rawState) as Partial<StorageState>;
    return {
      version: 1,
      wardrobes: Array.isArray(parsed.wardrobes) ? parsed.wardrobes : [],
      clothingItems: Array.isArray(parsed.clothingItems)
        ? parsed.clothingItems
        : [],
    };
  } catch {
    return emptyState;
  }
}

async function writeState(state: StorageState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix: string) {
  const randomId =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${randomId}`;
}

function timestamp() {
  return new Date().toISOString();
}

export async function listWardrobes() {
  const state = await readState();
  return sortByNewest(state.wardrobes);
}

export async function getWardrobe(id: string) {
  const state = await readState();
  return state.wardrobes.find((wardrobe) => wardrobe.id === id);
}

export async function createWardrobeRecord(input: WardrobeInput) {
  const state = await readState();
  const now = timestamp();
  const wardrobe: Wardrobe = {
    id: createId("wardrobe"),
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };

  await writeState({
    ...state,
    wardrobes: [wardrobe, ...state.wardrobes],
  });

  return wardrobe;
}

export async function listClothingItems() {
  const state = await readState();
  return sortByNewest(state.clothingItems);
}

export async function listClothingItemsByWardrobe(wardrobeId: string) {
  const state = await readState();
  return sortByNewest(
    state.clothingItems.filter((item) => item.wardrobeId === wardrobeId),
  );
}

export async function getClothingItem(id: string) {
  const state = await readState();
  return state.clothingItems.find((item) => item.id === id);
}

async function ensureWardrobeExists(wardrobeId: string) {
  const state = await readState();
  const wardrobe = state.wardrobes.find((record) => record.id === wardrobeId);

  if (!wardrobe) {
    throw new Error("Seçilen gardırop bulunamadı.");
  }

  return { state, wardrobe };
}

export async function createClothingItemRecord(input: ClothingItemInput) {
  const { state } = await ensureWardrobeExists(input.wardrobeId);
  const now = timestamp();
  const item: ClothingItem = {
    id: createId("item"),
    wardrobeId: input.wardrobeId,
    name: input.name,
    category: input.category,
    type: input.type,
    primaryColor: input.primaryColor,
    brand: input.brand,
    notes: input.notes,
    dataSource: "manual",
    createdAt: now,
    updatedAt: now,
  };

  await writeState({
    ...state,
    clothingItems: [item, ...state.clothingItems],
  });

  return item;
}

export async function updateClothingItemRecord(
  id: string,
  input: ClothingItemInput,
) {
  const { state } = await ensureWardrobeExists(input.wardrobeId);
  const existing = state.clothingItems.find((item) => item.id === id);

  if (!existing) {
    throw new Error("Kıyafet bulunamadı.");
  }

  const updated: ClothingItem = {
    ...existing,
    ...input,
    updatedAt: timestamp(),
  };

  await writeState({
    ...state,
    clothingItems: state.clothingItems.map((item) =>
      item.id === id ? updated : item,
    ),
  });

  return updated;
}

export async function deleteClothingItemRecord(id: string) {
  const state = await readState();
  await writeState({
    ...state,
    clothingItems: state.clothingItems.filter((item) => item.id !== id),
  });
}
