// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import("node-fetch");
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body)
    return { statusCode: 400, body: "POST body required" };
  if (!API_KEY)
    return { statusCode: 500, body: "Missing GEMINI_API_KEY" };

  try {
    const body = JSON.parse(event.body);
    const { apiType, model, ...rawPayload } = body;

    let endpoint = "";
    let payload = {};

    switch (apiType) {
      case "chat":
      case "text_search":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        payload = {
          contents: rawPayload.contents || [],
          generationConfig: rawPayload.generationConfig || {},
        };
        if (rawPayload.systemInstruction)
          payload.systemInstruction = rawPayload.systemInstruction;
        break;

      case "image_gen":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage?key=${API_KEY}`;
        payload = rawPayload;
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Unsupported apiType: ${apiType}` }),
        };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("Gemini API error:", res.status, text);
      return {
        statusCode: res.status,
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
    console.error("Proxy Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
}
