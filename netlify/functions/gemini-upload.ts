
import { GoogleGenAI } from "@google/genai";

// Netlify default body size limit ~6MB, tapi kita set via environment
// File audio dikirim sebagai multipart form data base64 dari client

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { audioBase64, mimeType } = JSON.parse(event.body || "{}");

    if (!audioBase64 || !mimeType) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "audioBase64 dan mimeType diperlukan." })
      };
    }

    const apiKeys = [
      process.env.GEMINI_API_KEY_1 || process.env.VITE_GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2 || process.env.VITE_GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3 || process.env.VITE_GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4 || process.env.VITE_GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5 || process.env.VITE_GEMINI_API_KEY_5,
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      return { statusCode: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "API Key tidak terkonfigurasi." }) };
    }

    let lastError: any = null;

    for (const apiKey of apiKeys) {
      try {
        const genAI = new GoogleGenAI({ apiKey });

        // Decode base64 ke Buffer untuk upload ke Files API
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const blob = new Blob([audioBuffer], { type: mimeType });

        console.log(`[Upload] Uploading file ke Gemini Files API... size=${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, mimeType=${mimeType}`);

        // Upload ke Gemini Files API — ini yang dilakukan AI Studio secara internal
        const uploadedFile = await (genAI.files as any).upload({
          file: blob,
          config: { mimeType },
        });

        console.log(`[Upload] Berhasil! File URI: ${uploadedFile.uri}`);

        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ fileUri: uploadedFile.uri, mimeType })
        };

      } catch (err: any) {
        lastError = err;
        console.warn(`[Upload] Gagal dengan key ini: ${err?.message?.substring(0, 100)}`);
        continue;
      }
    }

    throw lastError;

  } catch (error: any) {
    console.error("[Upload] Error:", error?.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error?.message || "Gagal mengupload file ke Gemini." })
    };
  }
};
