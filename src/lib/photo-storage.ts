import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import type { ClothingImageInfo } from "@/lib/types";

const photoDirectoryName = "clothing-photos";
const maxAnalysisImageSide = 1024;
const jpegCompression = 0.45;

function getPhotoDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Fotoğraf saklama alanı bulunamadı.");
  }

  return `${FileSystem.documentDirectory}${photoDirectoryName}/`;
}

function createImageFileName(extension: string) {
  const randomPart = Math.random().toString(16).slice(2);
  return `clothing_${Date.now()}_${randomPart}.${extension}`;
}

function inferExtension(uri: string) {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return match?.[1]?.toLocaleLowerCase("tr-TR") ?? "jpg";
}

function inferMimeType(uri: string, mimeType?: string) {
  if (mimeType) {
    return mimeType;
  }

  const extension = inferExtension(uri);
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

function getResizeAction(asset: ImagePickerAsset) {
  const largestSide = Math.max(asset.width, asset.height);

  if (!largestSide || largestSide <= maxAnalysisImageSide) {
    return undefined;
  }

  if (asset.width >= asset.height) {
    return { resize: { width: maxAnalysisImageSide } };
  }

  return { resize: { height: maxAnalysisImageSide } };
}

async function createAnalysisReadyImage(asset: ImagePickerAsset) {
  const actions = getResizeAction(asset);
  return ImageManipulator.manipulateAsync(asset.uri, actions ? [actions] : [], {
    compress: jpegCompression,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

export async function persistClothingPhoto(
  asset: ImagePickerAsset,
  source: ClothingImageInfo["source"],
): Promise<ClothingImageInfo> {
  const directory = getPhotoDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const optimizedImage = await createAnalysisReadyImage(asset);
  const mimeType = "image/jpeg";
  const fileName = createImageFileName("jpg");
  const uri = `${directory}${fileName}`;

  await FileSystem.copyAsync({
    from: optimizedImage.uri,
    to: uri,
  });

  return {
    assetId: asset.assetId ?? undefined,
    fileName,
    height: optimizedImage.height,
    mimeType,
    source,
    uri,
    width: optimizedImage.width,
  };
}

export async function readImageAsDataUrl(uri: string, mimeType?: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return `data:${inferMimeType(uri, mimeType)};base64,${base64}`;
}
