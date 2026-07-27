import { getClothingAnalyzerUrl } from "@/lib/app-config";
import { normalizeAnalysisSuggestion } from "@/lib/clothing-analysis-result";
import { readImageAsDataUrl } from "@/lib/photo-storage";
import type { ClothingAnalysisSuggestion, ClothingImageInfo } from "@/lib/types";

const analysisTimeoutMs = 90_000;
const maxImageDataUrlLength = 8_000_000;

function errorMessageFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message.trim().length > 0
      ? message.trim()
      : undefined;
  }

  return undefined;
}

async function parseJsonResponse(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

export async function analyzeClothingPhoto(
  image: ClothingImageInfo,
): Promise<ClothingAnalysisSuggestion> {
  const imageDataUrl = await readImageAsDataUrl(image.uri, image.mimeType);

  if (imageDataUrl.length > maxImageDataUrlLength) {
    throw new Error(
      "Fotoğraf analiz için çok büyük. Daha yakından ve tek kıyafeti kadraja alarak tekrar çekin.",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), analysisTimeoutMs);

  let response: Response;
  try {
    response = await fetch(getClothingAnalyzerUrl(), {
      body: JSON.stringify({
        imageDataUrl,
        imageMimeType: image.mimeType,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Fotoğraf analizi zaman aşımına uğradı. Daha net ve daha küçük bir kadrajla tekrar deneyin.",
      );
    }

    throw new Error(
      "Analiz servisine ulaşılamadı. Backend ve telefonun aynı ağda olduğunu kontrol edin.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      errorMessageFromPayload(payload) ??
        "Fotoğraf analizi tamamlanamadı. Backend çalışıyor mu kontrol edin.",
    );
  }

  const analysis = normalizeAnalysisSuggestion(
    (payload as { analysis?: unknown } | undefined)?.analysis,
  );

  if (!analysis) {
    throw new Error("Analiz sonucu beklenen formatta değil.");
  }

  return analysis;
}
