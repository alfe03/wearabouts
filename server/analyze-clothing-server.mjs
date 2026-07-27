import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";

const defaultPort = 8787;
const analyzerPath = "/api/analyze-clothing";
const categories = ["Üst giyim", "Alt giyim", "Dış giyim", "Ayakkabı"];
const geminiTimeoutMs = 75_000;

function loadLocalEnv() {
  for (const filePath of [".env", ".env.local", "server/.env", "server/.env.local"]) {
    if (!existsSync(filePath)) {
      continue;
    }

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let body = "";
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      const error = new Error("Fotoğraf isteği çok büyük.");
      error.statusCode = 413;
      throw error;
    }
    body += chunk;
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("İstek JSON formatında olmalıdır.");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeAnalysis(rawAnalysis) {
  if (!rawAnalysis || typeof rawAnalysis !== "object") {
    const error = new Error("AI yanıtı JSON nesnesi içermiyor.");
    error.statusCode = 502;
    throw error;
  }

  const analysis = {
    name: typeof rawAnalysis.name === "string" ? rawAnalysis.name.trim() : undefined,
    category: categories.includes(rawAnalysis.category) ? rawAnalysis.category : "Üst giyim",
    type: typeof rawAnalysis.type === "string" ? rawAnalysis.type.trim() : "",
    primaryColor:
      typeof rawAnalysis.primaryColor === "string" ? rawAnalysis.primaryColor.trim() : "",
    brand: typeof rawAnalysis.brand === "string" ? rawAnalysis.brand.trim() : undefined,
    confidence:
      typeof rawAnalysis.confidence === "number"
        ? Math.max(0, Math.min(1, rawAnalysis.confidence))
        : undefined,
    brandConfidence:
      typeof rawAnalysis.brandConfidence === "number"
        ? Math.max(0, Math.min(1, rawAnalysis.brandConfidence))
        : undefined,
    notes: typeof rawAnalysis.notes === "string" ? rawAnalysis.notes.trim() : undefined,
  };

  if (!analysis.type || !analysis.primaryColor) {
    const error = new Error("AI yanıtı eksik alan içeriyor.");
    error.statusCode = 502;
    throw error;
  }

  return analysis;
}

function parseAnalysisText(outputText) {
  const normalized = outputText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch {
    const error = new Error("AI yanıtı JSON formatında değil.");
    error.statusCode = 502;
    throw error;
  }
}

function extractDataUrlParts(imageDataUrl) {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    const error = new Error("imageDataUrl alanı data:image/...;base64 formatında olmalıdır.");
    error.statusCode = 400;
    throw error;
  }

  return {
    data: match[2],
    mimeType: match[1],
  };
}

function extractGeminiText(payload) {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim().length > 0) {
        return part.text;
      }
    }
  }

  return undefined;
}

function getGeminiErrorMessage(payload) {
  return typeof payload?.error?.message === "string"
    ? payload.error.message
    : "Gemini servisi yanıt veremedi.";
}

function createSchema() {
  return {
    additionalProperties: false,
    properties: {
      name: {
        description: "Kullanıcının düzenleyebileceği kısa Türkçe kıyafet adı.",
        type: "string",
      },
      category: {
        enum: categories,
        type: "string",
      },
      type: {
        description: "Tişört, gömlek, pantolon, sneaker gibi sade Türkçe tür.",
        type: "string",
      },
      primaryColor: {
        description: "Baskın rengin sade Türkçe adı.",
        type: "string",
      },
      brand: {
        description: "Yalnızca logo veya yazı açıkça görünüyorsa marka, aksi halde null.",
        type: ["string", "null"],
      },
      confidence: {
        maximum: 1,
        minimum: 0,
        type: "number",
      },
      brandConfidence: {
        maximum: 1,
        minimum: 0,
        type: "number",
      },
      notes: {
        description: "Kısa belirsizlik notu veya null.",
        type: ["string", "null"],
      },
    },
    required: [
      "name",
      "category",
      "type",
      "primaryColor",
      "brand",
      "confidence",
      "brandConfidence",
      "notes",
    ],
    type: "object",
  };
}

async function requestGeminiAnalysis(imageDataUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY tanımlı değil.");
    error.statusCode = 500;
    throw error;
  }

  const { data, mimeType } = extractDataUrlParts(imageDataUrl);
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), geminiTimeoutMs);
  let geminiResponse;

  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  data,
                  mime_type: mimeType,
                },
              },
              {
                text:
                  "Fotoğraftaki tek baskın kıyafet veya ayakkabıyı analiz et. " +
                  "Yalnızca geçerli JSON döndür. Markdown veya açıklama yazma. " +
                  "JSON alanları: name, category, type, primaryColor, brand, confidence, brandConfidence, notes. " +
                  `category yalnızca şu değerlerden biri olmalı: ${categories.join(", ")}. ` +
                  "Markayı yalnızca logo, etiket veya yazı açıkça görünüyorsa ver; tahmin etme, görünmüyorsa null döndür. " +
                  "Renkleri ve türü Türkçe döndür.",
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          maxOutputTokens: 350,
          responseJsonSchema: createSchema(),
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      method: "POST",
      signal: controller.signal,
    },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error("Gemini isteği zaman aşımına uğradı.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await geminiResponse.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = undefined;
  }

  if (!geminiResponse.ok) {
    const error = new Error(getGeminiErrorMessage(payload));
    error.statusCode = 502;
    throw error;
  }

  const outputText = extractGeminiText(payload);
  if (!outputText) {
    const error = new Error("AI yanıtında metin çıktısı bulunamadı.");
    error.statusCode = 502;
    throw error;
  }

  return normalizeAnalysis(parseAnalysisText(outputText));
}

async function handleAnalyzeClothing(request, response) {
  const body = await readJsonBody(request);
  const imageDataUrl = body.imageDataUrl;

  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    sendJson(response, 400, {
      error: "imageDataUrl alanı data:image/... formatında olmalıdır.",
    });
    return;
  }

  const analysis = await requestGeminiAnalysis(imageDataUrl);
  sendJson(response, 200, { analysis });
}

loadLocalEnv();

const maxBodyBytes = Number(process.env.CLOTHING_ANALYZER_MAX_BODY_BYTES ?? 12_000_000);

const server = createServer((request, response) => {
  void (async () => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && request.url === analyzerPath) {
      await handleAnalyzeClothing(request, response);
      return;
    }

    sendJson(response, 404, { error: "Endpoint bulunamadı." });
  })().catch((error) => {
    const statusCode = Number(error.statusCode) || 500;
    console.error(error);
    sendJson(response, statusCode, {
      error:
        error instanceof Error && error.message
          ? error.message
          : "Beklenmeyen backend hatası.",
    });
  });
});

const port = Number(process.env.PORT ?? defaultPort);
server.listen(port, "0.0.0.0", () => {
  console.log(`Clothing analyzer backend listening on http://0.0.0.0:${port}`);
});
