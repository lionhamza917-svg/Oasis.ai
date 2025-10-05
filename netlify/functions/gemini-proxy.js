// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import("node-fetch");
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return { statusCode: 400, body: "Must be a POST request with a body." };
  }

  if (!API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY");
    return { statusCode: 500, body: "Missing GEMINI_API_KEY." };
  }

  try {
    const body = JSON.parse(event.body);
    const { apiType, model, ...rawPayload } = body;

    let endpoint = "";
    let cleanedPayload = {};

    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        // Flatten misplaced fields
        let sysInstr = null,
          tools = null;
        if (rawPayload.generationConfig?.systemInstruction) {
          sysInstr = rawPayload.generationConfig.systemInstruction;
          delete rawPayload.generationConfig.systemInstruction;
        }
        if (rawPayload.generationConfig?.tools) {
          tools = rawPayload.generationConfig.tools;
          delete rawPayload.generationConfig.tools;
        }

        cleanedPayload = {
          contents: rawPayload.contents || [],
          generationConfig: rawPayload.generationConfig || {},
        };
        if (sysInstr) cleanedPayload.systemInstruction = sysInstr;
        if (tools) cleanedPayload.tools = tools;
        if (rawPayload.systemInstruction)
          cleanedPayload.systemInstruction = rawPayload.systemInstruction;
        if (rawPayload.tools) cleanedPayload.tools = rawPayload.tools;
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

    console.log("➡️ Requesting:", endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedPayload),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("❗ Gemini API error:", response.status, text);
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
    console.error("💥 Proxy Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: err.message }),
    };
  }
}
