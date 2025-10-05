// gemini-proxy.js

// **FIX 1: Use the stable CommonJS require() at the top level.** const fetch = require('node-fetch'); 

// **FIX 2: Use the stable CommonJS handler export format.**
exports.handler = async function (event, context) {
    
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
        const clientPayload = JSON.parse(event.body); 
        const { apiType, model, ...geminiPayload } = clientPayload; 

        if (!apiType || !model) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing apiType or model in request body." }) };
        }

        let apiEndpoint, finalPayload;

        // --- Logic to select endpoint based on ALL apiType values ---
        if (apiType === 'text_search' || apiType === 'title_gen' || apiType === 'tts') {
            // All these use the standard generateContent endpoint
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            finalPayload = geminiPayload; 
        } else if (apiType === 'image_gen') {
            // This uses the generateImages endpoint (Imagen API)
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${API_KEY}`;
            // Imagen API requires specific top-level keys
            finalPayload = { 
                instances: geminiPayload.instances, 
                parameters: geminiPayload.parameters
            };
        } 
        else {
             return { statusCode: 400, body: JSON.stringify({ error: "Invalid apiType specified." }) };
        }
        
        // 2. Call the external Google API endpoint
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
                body: JSON.stringify({ error: `Google API returned status ${response.status}`, details: errorDetails })
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
