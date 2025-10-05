// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import("node-fetch");
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return { statusCode: 400, body: "Must be a POST request with a body." };
  }

  if (!API_KEY) {
    console.error("❌ Missing Gemini API key!");
    return { statusCode: 500, body: "Missing GEMINI_API_KEY." };
  }

  try {
    const body = JSON.parse(event.body);
    const { apiType, model, ...rawPayload } = body;

    let endpoint = "";
    let cleanedPayload = {};

    // 🧭 Route by apiType
    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${API_KEY}`;

        // Flatten misplaced fields
        let sysInstr = null, tools = null;
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
        if (rawPayload.systemInstruction) cleanedPayload.systemInstruction = rawPayload.systemInstruction;
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
    console.log("Payload:", JSON.stringify(cleanedPayload, null, 2));

    // ✅ STREAMING RESPONSE SUPPORT
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❗ Gemini error:", response.status, text);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Gemini API error", details: text }),
      };
    }

    // Detect streaming responses
    if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: result,
      };
    }

    const text = await response.text();
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
