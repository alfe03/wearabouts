export const clothingCategories = [
  "Üst giyim",
  "Alt giyim",
  "Dış giyim",
  "Ayakkabı",
] as const;

export type ClothingCategory = (typeof clothingCategories)[number];

export type ClothingDataSource = "manual" | "ai";

export type ClothingImageInfo = {
  assetId?: string;
  altText?: string;
  source?: "upload" | "camera";
};

export type Wardrobe = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClothingItem = {
  id: string;
  wardrobeId: string;
  name: string;
  category: ClothingCategory;
  type: string;
  primaryColor: string;
  brand?: string;
  notes?: string;
  image?: ClothingImageInfo;
  dataSource: ClothingDataSource;
  createdAt: string;
  updatedAt: string;
};

export type WardrobeInput = {
  name: string;
  description?: string;
};

export type ClothingItemInput = {
  wardrobeId: string;
  name: string;
  category: ClothingCategory;
  type: string;
  primaryColor: string;
  brand?: string;
  notes?: string;
};
