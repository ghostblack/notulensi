
import { GoogleGenAI } from "@google/genai";

// CORS headers untuk semua response
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // Hanya izinkan metode POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { action, payload } = JSON.parse(event.body);
    const apiKeys = [
      process.env.GEMINI_API_KEY_1 || process.env.VITE_GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2 || process.env.VITE_GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3 || process.env.VITE_GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4 || process.env.VITE_GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5 || process.env.VITE_GEMINI_API_KEY_5
    ].filter(Boolean);

    if (apiKeys.length === 0) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "API Key tidak terkonfigurasi." }) };
    }

    // Acak urutan API Key untuk Load Balancing (Round-Robin Acak)
    const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);
    
    let lastError: any = null;

    // Loop mencoba satu per satu API key. Kalau Key 1 mati/limit, otomatis ke Key 2.
    for (let i = 0; i < shuffledKeys.length; i++) {
      const apiKey = shuffledKeys[i];
      console.log(`[Proxy] Mencoba API Key ${i + 1}/${shuffledKeys.length}`);

      try {
        const genAI = new GoogleGenAI({ apiKey });
        let text = "";

        if (action === "generateContent") {
          const modelName = payload.model || "gemini-2.5-flash";
          console.log(`[Proxy] Memanggil model: ${modelName}`);

          const result = await genAI.models.generateContent({
            model: modelName,
            contents: payload.contents,
          });

          if (result.text) {
            text = result.text;
          } else if (result.candidates && result.candidates.length > 0) {
            const candidate = result.candidates[0];
            if (candidate.content && candidate.content.parts) {
              text = candidate.content.parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("");
            }
          }

          if (!text) throw new Error("Respons kosong (finishReason: " + result.candidates?.[0]?.finishReason + ")");
        } else {
          return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid Action" }) };
        }

        // Jika berhasil, langsung kembalikan ke client!
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ text })
        };
        
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || "";
        console.warn(`[Proxy] Kegagalan dengan Key ${i + 1}: ${errMsg.substring(0, 100)}...`);
        // Jika belum key terakhir, lanjut loop ke key berikutnya secara otomatis!
        if (i < shuffledKeys.length - 1) {
          console.log(`[Proxy] Beralih ke API Key cadangan secara mulus...`);
          continue; 
        }
      }
    }

    // Jika KETIGA API KEY gagal semua, barulah lempar error ke client
    throw lastError;
  } catch (error: any) {
    const errMsg = error?.message || "Internal Server Error";
    console.error("[Proxy] Error:", errMsg);
    
    // Jangan merubah 429 menjadi 503 agar frontend bisa mendeteksi Rate Limit dengan benar
    const is429 = errMsg.includes("429");
    const is503 = errMsg.includes("503") || errMsg.includes("overloaded") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
    
    let statusCode = 500;
    if (is429) statusCode = 429;
    else if (is503) statusCode = 503;

    const clientMessage = is503 
      ? "Server Gemini sedang sangat sibuk. Silakan tunggu beberapa detik lalu coba lagi."
      : is429 
      ? "Terlalu banyak permintaan (Rate Limit 429). Sistem akan mencoba lagi secara otomatis."
      : errMsg;

    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: clientMessage })
    };
  }
};
