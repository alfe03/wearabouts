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
  fileName?: string;
  height?: number;
  mimeType?: string;
  source?: "upload" | "camera";
  uri: string;
  width?: number;
};

export type ClothingAnalysisSuggestion = {
  name?: string;
  category: ClothingCategory;
  type: string;
  primaryColor: string;
  brand?: string;
  confidence?: number;
  brandConfidence?: number;
  notes?: string;
};

export type Wardrobe = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordVersion?: number;
  createdAt: string;
  lastSignedInAt: string;
};

export type LocalUserRegistrationInput = {
  name: string;
  email: string;
  password: string;
};

export type LocalUserLoginInput = {
  email: string;
  password: string;
};

export type ClothingItem = {
  id: string;
  userId: string;
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
  userId: string;
  name: string;
  description?: string;
};

export type ClothingItemInput = {
  userId: string;
  wardrobeId: string;
  name: string;
  category: ClothingCategory;
  type: string;
  primaryColor: string;
  brand?: string;
  notes?: string;
  image?: ClothingImageInfo;
  dataSource?: ClothingDataSource;
};
