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

async function readStateForUser(userId: string) {
  const state = await readState();
  const wardrobeUserIds = new Map<string, string>();
  let didMigrate = false;

  const wardrobes = state.wardrobes.map((wardrobe) => {
    const ownerId = wardrobe.userId ?? userId;
    wardrobeUserIds.set(wardrobe.id, ownerId);

    if (!wardrobe.userId) {
      didMigrate = true;
      return { ...wardrobe, userId: ownerId };
    }

    return wardrobe;
  });

  const clothingItems = state.clothingItems.map((item) => {
    const ownerId = item.userId ?? wardrobeUserIds.get(item.wardrobeId) ?? userId;

    if (!item.userId) {
      didMigrate = true;
      return { ...item, userId: ownerId };
    }

    return item;
  });

  if (didMigrate) {
    await writeState({
      ...state,
      wardrobes,
      clothingItems,
    });

    return {
      ...state,
      wardrobes,
      clothingItems,
    };
  }

  return state;
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

export async function listWardrobes(userId: string) {
  const state = await readStateForUser(userId);
  return sortByNewest(
    state.wardrobes.filter((wardrobe) => wardrobe.userId === userId),
  );
}

export async function createWardrobeRecord(input: WardrobeInput) {
  const state = await readState();
  const now = timestamp();
  const wardrobe: Wardrobe = {
    id: createId("wardrobe"),
    userId: input.userId,
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

export async function listClothingItems(userId: string) {
  const state = await readStateForUser(userId);
  return sortByNewest(state.clothingItems.filter((item) => item.userId === userId));
}

async function ensureWardrobeExists(userId: string, wardrobeId: string) {
  const state = await readStateForUser(userId);
  const wardrobe = state.wardrobes.find(
    (record) => record.id === wardrobeId && record.userId === userId,
  );

  if (!wardrobe) {
    throw new Error("Seçilen gardırop bulunamadı.");
  }

  return { state, wardrobe };
}

export async function createClothingItemRecord(input: ClothingItemInput) {
  const { state } = await ensureWardrobeExists(input.userId, input.wardrobeId);
  const now = timestamp();
  const item: ClothingItem = {
    id: createId("item"),
    userId: input.userId,
    wardrobeId: input.wardrobeId,
    name: input.name,
    category: input.category,
    type: input.type,
    primaryColor: input.primaryColor,
    brand: input.brand,
    notes: input.notes,
    image: input.image,
    dataSource: input.dataSource ?? "manual",
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
  const { state } = await ensureWardrobeExists(input.userId, input.wardrobeId);
  const existing = state.clothingItems.find(
    (item) => item.id === id && item.userId === input.userId,
  );

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

export async function deleteClothingItemRecord(userId: string, id: string) {
  const state = await readState();
  await writeState({
    ...state,
    clothingItems: state.clothingItems.filter(
      (item) => !(item.id === id && item.userId === userId),
    ),
  });
}
