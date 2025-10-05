// netlify/functions/gemini-proxy.js


case "image_gen":
endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;


let prompt = null;
if (rawPayload.prompt) prompt = rawPayload.prompt;
else if (rawPayload.instances?.prompt) prompt = rawPayload.instances.prompt;
else if (Array.isArray(rawPayload.instances) && rawPayload.instances[0]?.prompt) prompt = rawPayload.instances[0].prompt;
else if (rawPayload.input && typeof rawPayload.input === 'string') prompt = rawPayload.input;


cleanedPayload = {
instances: [ { prompt: prompt || '' } ],
parameters: rawPayload.parameters || rawPayload.params || {},
};
break;


default:
console.error("🚫 Invalid apiType received:", apiType);
return {
statusCode: 400,
body: JSON.stringify({ error: `Invalid apiType: ${apiType}` }),
};
}


try {
const logged = JSON.stringify(cleanedPayload).slice(0, 1000);
console.log("➡️ Sending to Gemini:", endpoint);
console.log("🧩 Payload (truncated):", logged);
} catch (e) {}


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
