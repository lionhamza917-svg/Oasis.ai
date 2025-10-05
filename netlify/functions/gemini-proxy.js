// netlify/functions/gemini-proxy.js

export async function handler(event) {
  const { default: fetch } = await import('node-fetch');
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return {
      statusCode: 400,
      body: "Must be a POST request with a body.",
    };
  }

  if (!API_KEY) {
    console.error("❌ Missing Gemini API key in environment!");
    return {
      statusCode: 500,
      body: "Server missing GEMINI_API_KEY.",
    };
  }

  try {
    const clientBody = JSON.parse(event.body);
    const { apiType, model, ...rawPayload } = clientBody;

    let endpoint = "";
    let cleanedPayload = {};

    // 🧭 Route the request based on type
    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        // 🧹 Sanitize payload for Gemini
        cleanedPayload = {
          contents: rawPayload.contents || [],
        };
        if (rawPayload.generationConfig) cleanedPayload.generationConfig = rawPayload.generationConfig;
        if (rawPayload.systemInstruction) cleanedPayload.systemInstruction = rawPayload.systemInstruction;
        if (rawPayload.tools) cleanedPayload.tools = rawPayload.tools;
        break;

      case "image_gen":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
        cleanedPayload = rawPayload; // Imagen expects a slightly different schema
        break;

      default:
        console.error("🚫 Invalid apiType received:", apiType);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Invalid apiType: ${apiType}` }),
        };
    }

    // 🧾 Log what’s being sent (appears in Netlify logs)
    console.log("➡️ Sending to Gemini API:", endpoint);
    console.log("🧩 Payload:", JSON.stringify(cleanedPayload, null, 2));

    // 🔗 Send request to Gemini API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedPayload),
    });

    const responseText = await response.text();

    // 🧱 Handle errors from Gemini
    if (!response.ok) {
      console.error("❗ Gemini API returned error:", response.status, responseText);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Gemini API error",
          status: response.status,
          details: responseText,
        }),
      };
    }

    // ✅ Success
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: responseText,
    };
  } catch (err) {
    console.error("💥 Proxy internal error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: err.message,
      }),
    };
  }
}
