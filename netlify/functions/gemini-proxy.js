// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import("node-fetch");
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return { statusCode: 400, body: "Must be a POST request with a body." };
  }

  if (!API_KEY) {
    return { statusCode: 500, body: "Missing GEMINI_API_KEY." };
  }

  try {
    const body = JSON.parse(event.body);
    const { apiType, model, ...rawPayload } = body;

    let endpoint = "";
    let cleanedPayload = {};

    // ✅ Choose correct endpoint based on apiType
    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        cleanedPayload = {
          contents: rawPayload.contents || [],
          generationConfig: rawPayload.generationConfig || {},
        };
        if (rawPayload.systemInstruction)
          cleanedPayload.systemInstruction = rawPayload.systemInstruction;
        break;

      case "image_gen":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage?key=${API_KEY}`;
        cleanedPayload = rawPayload;
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Invalid apiType: ${apiType}` }),
        };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedPayload),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, text);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Gemini API error", details: text }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
}
