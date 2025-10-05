// netlify/functions/gemini-proxy.js
export async function handler(event) {
  const { default: fetch } = await import('node-fetch');
  const API_KEY = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST" || !event.body) {
    return { statusCode: 400, body: "Must be a POST request with a body." };
  }

  if (!API_KEY) {
    console.error("Missing Gemini API key!");
    return { statusCode: 500, body: "Server missing GEMINI_API_KEY." };
  }

  try {
    const body = JSON.parse(event.body);
    const { apiType, model, ...payload } = body;

    let endpoint;

    // Match all possible apiType values used in script.js
    switch (apiType) {
      case "chat":
      case "text_search":
      case "title_gen":
      case "tts":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        break;

      case "image_gen":
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Invalid apiType: ${apiType}` })
        };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Gemini API error", details: text })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: text,
    };

  } catch (err) {
    console.error("Proxy error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

