
import { GoogleGenAI } from "@google/genai";

export const handler = async (event: any) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { action, payload } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Gemini API Key tidak terkonfigurasi di server." })
      };
    }

    const genAI = new GoogleGenAI({ apiKey });
    
    let text = "";

    switch (action) {
      case "generateContent":
        const result = await genAI.models.generateContent({
          model: payload.model || "gemini-2.5-flash",
          contents: payload.contents,
          config: {
            // Ensure we get full response, not streaming chunks
            thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster response
          }
        });

        // Robust text extraction - handle multiple response formats
        if (result.text !== undefined && result.text !== null && result.text !== "") {
          text = result.text;
        } else if (result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];
          if (candidate.content && candidate.content.parts) {
            // Filter out thought parts, only get text parts
            const textParts = candidate.content.parts
              .filter((part: any) => part.text !== undefined && !part.thought)
              .map((part: any) => part.text)
              .join("");
            text = textParts;
          }
        }

        if (!text) {
          console.error("Empty response from Gemini. Full result:", JSON.stringify(result, null, 2));
          return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Model mengembalikan respons kosong. Coba lagi." })
          };
        }
        break;
      default:
        return { 
          statusCode: 400, 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Invalid Action" }) 
        };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
