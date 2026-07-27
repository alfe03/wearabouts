import Constants from "expo-constants";

const analyzerPath = "/api/analyze-clothing";

function getConfiguredUrl() {
  const envUrl = process.env.EXPO_PUBLIC_CLOTHING_ANALYZER_URL?.trim();

  if (envUrl) {
    return envUrl;
  }

  const extraUrl = Constants.expoConfig?.extra?.clothingAnalyzerUrl;
  return typeof extraUrl === "string" && extraUrl.trim().length > 0
    ? extraUrl.trim()
    : undefined;
}

function getExpoHostUrl() {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return undefined;
  }

  const host = hostUri.split(":")[0];
  return host ? `http://${host}:8787${analyzerPath}` : undefined;
}

export function getClothingAnalyzerUrl() {
  return (
    getConfiguredUrl() ??
    getExpoHostUrl() ??
    `http://localhost:8787${analyzerPath}`
  );
}
