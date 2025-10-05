// gemini-proxy.js

// **FIXED:** Use CommonJS require() to avoid 'Top-level await' error.
const fetch = require('node-fetch');

// Use ES Module exports for better compatibility with modern Netlify Functions (Lambda).
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
        const clientPayload = JSON.parse(event.body); 
        const { apiType, model, ...geminiPayload } = clientPayload; 

        if (!apiType || !model) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing apiType or model in request body." }) };
        }

        let apiEndpoint, finalPayload;
        
        // --- API ROUTING LOGIC ---
        // The original file contained the body of the function. 
        // We ensure that 'fetch' is now used inside the try block without an 'await import'.
        
        switch (apiType) {
            case 'chat':
            case 'text_search':
            case 'image_gen':
            case 'tts':
            case 'title_gen':
                // Assuming all these internal types map to the main generateContent endpoint or similar structures
                // The URL structure relies on the 'model' variable from the client payload
                apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
                finalPayload = geminiPayload; // The rest of the payload from the client
                break;
            default:
                return { statusCode: 400, body: JSON.stringify({ error: "Invalid apiType provided." }) };
        }


        // 2. Call the external Gemini API endpoint
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        // Error handling
        if (!response.ok) {
            // ... (rest of the error handling logic)
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
