
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
        body: JSON.stringify({ error: "Gemini API Key tidak terkonfigurasi di server." })
      };
    }


    const genAI = new GoogleGenAI({ apiKey });
    
    let text = "";

    switch (action) {
      case "generateContent":
        const result = await genAI.models.generateContent({
          model: payload.model || "gemini-2.5-flash",
          contents: payload.contents
        });
        text = result.text || "No text returned";
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
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
