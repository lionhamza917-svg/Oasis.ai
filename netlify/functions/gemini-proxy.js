// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import("node-fetch");
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return {
      statusCode: 400,
      body: "Must be a POST request with a body.",
    };
  }

  if (!API_KEY) {
    console.error("❌ Missing Gemini API key in environment variables.");
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

    // 🧭 Route request to correct endpoint
    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        // 🧹 Extract misplaced fields (systemInstruction & tools)
        let sysInstr = null;
        let tools = null;

        if (rawPayload.generationConfig?.systemInstruction) {
          sysInstr = rawPayload.generationConfig.systemInstruction;
          delete rawPayload.generationConfig.systemInstruction;
        }

        if (rawPayload.generationConfig?.tools) {
          tools = rawPayload.generationConfig.tools;
          delete rawPayload.generationConfig.tools;
        }

        // 🧩 Build valid Gemini payload
        cleanedPayload = {
          contents: rawPayload.contents || [],
          generationConfig: rawPayload.generationConfig || {},
        };

        if (rawPayload.systemInstruction) cleanedPayload.systemInstruction = rawPayload.systemInstruction;
        if (rawPayload.tools) cleanedPayload.tools = rawPayload.tools;
        if (sysInstr) cleanedPayload.systemInstruction = sysInstr;
        if (tools) cleanedPayload.tools = tools;
        break;

      case "image_gen":
        // Imagen endpoint for image generation
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
        cleanedPayload = rawPayload;
        break;

      default:
        console.error("🚫 Invalid apiType received:", apiType);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Invalid apiType: ${apiType}` }),
        };
    }

    // 🧾 Log payload for debugging
    console.log("➡️ Sending to Gemini:", endpoint);
    console.log("🧩 Payload:", JSON.stringify(cleanedPayload, null, 2));

    // 🔗 Forward the cleaned request to Gemini
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedPayload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("❗ Gemini API error:", response.status, responseText);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Gemini API error",
          status: response.status,
          details: responseText,
        }),
      };
    }

    // ✅ Success: return Gemini’s response
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
