
import { GoogleGenAI } from "@google/genai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Urutan model: 2.5-flash-preview prioritas utama (akurasi tertinggi), fallback ke yang lain
const MODEL_CHAIN = [
  "gemini-3-flash-preview",         // Prioritas utama — Flash 3 terbaru
  "gemini-2.5-flash-preview-05-20", // Cadangan 1
  "gemini-2.5-flash",               // Cadangan 2
  "gemini-2.5-flash-lite",          // Cadangan 3
  "gemini-1.5-flash",               // Cadangan terakhir
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { fileUri, mimeType, systemInstruction, promptText } = JSON.parse(
      event.body || "{}"
    );

    if (!fileUri || !mimeType) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "fileUri dan mimeType diperlukan." }),
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
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Key tidak terkonfigurasi." }),
      };
    }

    let lastError: any = null;

    // Loop semua API key, tiap key coba semua model
    for (const apiKey of apiKeys) {
      for (const modelName of MODEL_CHAIN) {
        let retries503 = 0;

        while (retries503 <= 2) {
          try {
            const genAI = new GoogleGenAI({ apiKey });

            console.log(
              `[Transcribe] Mencoba ${modelName} dengan fileUri...`
            );

            const requestPayload: any = {
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [
                    // Referensi file via URI — persis seperti AI Studio
                    { fileData: { mimeType, fileUri } },
                    {
                      text:
                        promptText ||
                        "Transkripsikan audio ini secara verbatim.",
                    },
                  ],
                },
              ],
            };

            if (systemInstruction) {
              requestPayload.config = { systemInstruction };
            }

            const result = await genAI.models.generateContent(requestPayload);

            let text = "";
            if (result.text) {
              text = result.text;
            } else if (result.candidates?.[0]?.content?.parts) {
              text = result.candidates[0].content.parts
                .filter((p: any) => p.text && !p.thought)
                .map((p: any) => p.text)
                .join("");
            }

            if (!text)
              throw new Error(
                `Respons kosong (${result.candidates?.[0]?.finishReason})`
              );

            console.log(`[Transcribe] Berhasil! ${text.length} karakter.`);

            return {
              statusCode: 200,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            };
          } catch (err: any) {
            lastError = err;
            const errMsg = err?.message || "";
            const is503 =
              errMsg.includes("503") ||
              errMsg.includes("overloaded") ||
              errMsg.includes("high demand") ||
              errMsg.includes("UNAVAILABLE");
            const is429 =
              errMsg.includes("429") ||
              errMsg.includes("quota") ||
              errMsg.includes("exhausted");

            console.warn(
              `[Transcribe] ${modelName} gagal (attempt ${retries503 + 1}): ${errMsg.substring(0, 100)}`
            );

            if (is503 && retries503 < 2) {
              // Server sibuk — tunggu dan coba lagi dengan model yang sama
              retries503++;
              console.log(
                `[Transcribe] 503 High Demand. Retry ${retries503}/2 tunggu 5 detik...`
              );
              await sleep(5000);
              continue;
            }

            if (is429) {
              // Quota habis untuk model ini di key ini — ganti model
              console.log(
                `[Transcribe] Quota habis di ${modelName}. Ganti model...`
              );
              break; // keluar dari while, lanjut ke model berikutnya
            }

            // Error lain — ganti model langsung
            break;
          }
        }
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("[Transcribe] Error:", error?.message);
    const errMsg = error?.message || "Internal Server Error";
    const is429 = errMsg.includes("429");
    const is503 =
      errMsg.includes("503") || errMsg.includes("overloaded");

    return {
      statusCode: is429 ? 429 : is503 ? 503 : 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: errMsg }),
    };
  }
};
