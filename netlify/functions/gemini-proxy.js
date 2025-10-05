// gemini-proxy.js
// Use ES Module exports for better compatibility with modern Netlify Functions (Lambda).

// Netlify uses CommonJS style exports, but we can make it more explicit.
// Use 'export async function handler' or 'exports.handler = async'

const { default: fetch } = await import('node-fetch');

// --- Export the handler function ---
export async function handler(event) {
    // Read the API Key securely from Netlify's environment settings
    const API_KEY = process.env.GEMINI_API_KEY;

    if (event.httpMethod !== "POST" || !event.body) {
        return { statusCode: 400, body: "Must be a POST request with a body." };
    }
    
    if (!API_KEY) {
        console.error("CRITICAL ERROR: API KEY IS MISSING FROM ENVIRONMENT.");
        return { statusCode: 500, body: "API Key Not Configured on Server." };
    }

    try {
        // Parse the data sent from your frontend
        // The frontend sends apiType and model to tell the proxy which endpoint to use.
        const clientPayload = JSON.parse(event.body); 
        const { apiType, model, ...geminiPayload } = clientPayload; 

        if (!apiType || !model) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing apiType or model in request body." }) };
        }

        let apiEndpoint, finalPayload;

        // --- Logic to select endpoint based on apiType ---
        // (Ensure this part is correctly implemented in your final code)

        if (apiType === 'chat') {
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            finalPayload = geminiPayload; // chatPayload
        } 
        // ... include other API types (e.g., image generation) if you have them ...
        else {
             return { statusCode: 400, body: JSON.stringify({ error: "Invalid apiType specified." }) };
        }
        
        // 2. Call the external Gemini API endpoint
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        // Error handling
        if (!response.ok) {
            const errorText = await response.text();
            
            let errorDetails;
            try {
                errorDetails = JSON.parse(errorText);
            } catch (e) {
                errorDetails = { message: errorText };
            }

            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `Gemini API returned status ${response.status}`, details: errorDetails })
            };
        }

        const data = await response.json();

        // 3. Send the successful result back to the frontend
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(data)
        };
        
    } catch (error) {
        console.error("Gemini Proxy Execution Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error during execution.', details: error.message })
        };
    }
}
