
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
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Gemini API Key tidak terkonfigurasi di server." })
      };
    }

    const genAI = new GoogleGenAI({ apiKey });
    
    let text = "";

    switch (action) {
      case "generateContent": {
        // Gunakan model dari payload (client mengirim model spesifik dari fallback chain)
        const modelName = payload.model || "gemini-2.5-flash";
        console.log(`[Proxy] Memanggil model: ${modelName}`);

        const result = await genAI.models.generateContent({
          model: modelName,
          contents: payload.contents,
          // TIDAK menggunakan thinkingConfig agar kompatibel dengan semua model.
          // thinkingBudget: 0 pada gemini-2.5-flash menyebabkan empty response.
        });

        // Robust text extraction - handle multiple response formats
        if (result.text !== undefined && result.text !== null && result.text !== "") {
          text = result.text;
        } else if (result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];

          // Log finish reason untuk debugging
          console.log(`[Proxy] Finish reason: ${candidate.finishReason}`);

          if (candidate.content && candidate.content.parts) {
            // Filter out thought parts, hanya ambil text parts
            const textParts = candidate.content.parts
              .filter((part: any) => part.text !== undefined && !part.thought)
              .map((part: any) => part.text)
              .join("");
            text = textParts;
          }
        }

        if (!text) {
          const debugInfo = {
            finishReason: result.candidates?.[0]?.finishReason,
            candidatesCount: result.candidates?.length,
            partsCount: result.candidates?.[0]?.content?.parts?.length,
          };
          console.error("[Proxy] Empty response dari Gemini:", JSON.stringify(debugInfo));
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
              error: `Model mengembalikan respons kosong (finishReason: ${debugInfo.finishReason || 'unknown'}). Silakan coba lagi.` 
            })
          };
        }
        break;
      }
      default:
        return { 
          statusCode: 400, 
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Invalid Action" }) 
        };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ text })
    };
  } catch (error: any) {
    const errMsg = error?.message || "Internal Server Error";
    console.error("[Proxy] Error:", errMsg);
    
    // Deteksi error spesifik untuk pesan yang lebih informatif
    const isOverloaded = errMsg.includes("503") || errMsg.includes("overloaded") || errMsg.includes("429");
    const clientMessage = isOverloaded 
      ? "Server Gemini sedang sangat sibuk. Silakan tunggu beberapa detik lalu coba lagi."
      : errMsg;

    return {
      statusCode: isOverloaded ? 503 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: clientMessage })
    };
  }
};
