window.onload = async function() {
    // --- API Configuration ---
    const PROXY_API_URL = "/.netlify/functions/gemini-proxy";
    const API_KEY = null; 
    
    // --- Local Storage Configuration ---
    const LOCAL_STORAGE_KEY = 'oasisChatHistory';

    // --- DOM Elements ---
    const chatContainer = document.getElementById('chat-container');
    const historyContainer = document.getElementById('history-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const clearButton = document.getElementById('clear-button');
    const uploadButton = document.getElementById('upload-button');
    const imageUploadInput = document.getElementById('image-upload');
    const ttsButton = document.getElementById('tts-button');
    const ttsIcon = document.getElementById('tts-icon'); 
    const generateImageButton = document.getElementById('generate-image-button');
    const newChatButton = document.getElementById('new-chat-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    const closeErrorModal = document.getElementById('close-error-modal');
    const currentChatTitle = document.getElementById('current-chat-title');
    const userIdDisplay = document.getElementById('user-id-display');
    const generateTitleButton = document.getElementById('generate-title-button');

    // --- State Variables ---
    let chatHistory = [];
    let uploadedImage = null;
    let isTtsEnabled = false;
    let audioContext = null;
    let conversations = []; // Stores all conversations from Local Storage
    let currentConversationIndex = -1; // Index of the currently loaded conversation in the 'conversations' array

    // Displaying a static ID to replace the dynamic Firebase User ID.
    userIdDisplay.textContent = `Storage: Local Browser`; 

    // Avatars (Themed 'U' and 'A')
    let userAvatarData = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1b876' class='w-12 h-12 text-amber-500'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' font-family='Inter, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='%231c1917'%3EU</text%3E%3C/svg%3E";
    let aiAvatarData = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%2378350f'/%3E%3Ctext x='12' y='16' font-family='Inter, sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='%23d1b876'%3EA</text%3E%3C/svg%3E";

    // --- Utility Functions ---
    // (showError, closeErrorModal, appendMessage, appendImage, base64ToArrayBuffer, pcmToWav, playAudio)
    // ... (These functions remain the same as the previous non-Firebase version) ...

    function showError(message) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }

    closeErrorModal.addEventListener('click', () => {
        errorModal.classList.add('hidden');
    });

    function appendMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex gap-2 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`;

        const messageBubble = document.createElement('div');
        // Themed Message Bubbles
        messageBubble.className = `p-4 rounded-3xl max-w-[80%] shadow-lg whitespace-pre-wrap ${isUser ? 'bg-amber-700 text-amber-50 rounded-br-none' : 'bg-stone-700 text-stone-100 rounded-bl-none'}`;
        
        // Handle markdown (basic bold/italics)
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');

        messageBubble.innerHTML = formattedText;
        
        const avatarImg = document.createElement('img');
        avatarImg.src = isUser ? userAvatarData : aiAvatarData;
        avatarImg.alt = isUser ? "User Avatar" : "AI Avatar";
        avatarImg.className = "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";

        if (!isUser) {
            const contentWrapper = document.createElement('div');
            contentWrapper.className = "flex items-center space-x-2";
            contentWrapper.appendChild(messageBubble);

            // Copy button logic (Themed)
            const copyButton = document.createElement('button');
            copyButton.className = "self-start p-1 text-amber-400 hover:text-amber-200 transition-colors duration-200";
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;

            copyButton.addEventListener('click', () => {
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = text;
                document.body.appendChild(tempTextarea);
                tempTextarea.select();
                document.execCommand('copy');
                document.body.removeChild(tempTextarea);
                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.92"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
                setTimeout(() => {
                    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
                }, 1500);
            });
            messageDiv.appendChild(avatarImg);
            messageDiv.appendChild(contentWrapper);
            contentWrapper.appendChild(copyButton);
        } else {
            messageDiv.appendChild(messageBubble);
            messageDiv.appendChild(avatarImg);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendImage(imageSrc, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex gap-2 animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`;
        const avatarImg = document.createElement('img');
        avatarImg.src = isUser ? userAvatarData : aiAvatarData;
        avatarImg.alt = isUser ? "User Avatar" : "AI Avatar";
        avatarImg.className = "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";
        const imageElement = document.createElement('img');
        imageElement.src = imageSrc;
        imageElement.className = "message-image bg-stone-700 p-2 border border-amber-800";
        if (isUser) {
            messageDiv.appendChild(imageElement);
            messageDiv.appendChild(avatarImg);
        } else {
            messageDiv.appendChild(avatarImg);
            messageDiv.appendChild(imageElement);
        }
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function pcmToWav(pcm, sampleRate) {
        const buffer = new ArrayBuffer(44 + pcm.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        function writeString(str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset++, str.charCodeAt(i));
            }
        }
        function writeUint32(val) { view.setUint32(offset, val, true); offset += 4; }
        function writeUint16(val) { view.setUint16(offset, val, true); offset += 2; }
        writeString('RIFF');
        writeUint32(36 + pcm.length * 2);
        writeString('WAVE');
        writeString('fmt ');
        writeUint32(16);
        writeUint16(1);
        writeUint16(1);
        writeUint32(sampleRate);
        writeUint32(sampleRate * 2);
        writeUint16(2);
        writeUint16(16);
        writeString('data');
        writeUint32(pcm.length * 2);
        const dataView = new DataView(pcm.buffer);
        for (let i = 0; i < pcm.length; i++) {
            view.setInt16(offset, dataView.getInt16(i * 2, true), true);
            offset += 2;
        }
        return new Blob([view], { type: 'audio/wav' });
    }
    
    async function playAudio(audioData, mimeType) {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000;
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        } catch (error) {
            console.error('Audio playback error:', error);
        }
    }

    // --- Local Storage Functions (NEW) ---

    function saveConversations() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(conversations));
            loadConversations(); // Re-render the history sidebar
        } catch (e) {
            console.error("Error saving to Local Storage:", e);
            showError("Failed to save conversation history to your browser's storage.");
        }
    }

    function renderHistory() {
        historyContainer.innerHTML = '';
        conversations.forEach((conv, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = `p-3 rounded-xl cursor-pointer transition-colors duration-200 truncate ${index === currentConversationIndex ? 'bg-amber-700 font-bold text-white' : 'hover:bg-stone-700 text-amber-300'}`;
            historyItem.textContent = conv.title || 'New Chat';
            historyItem.dataset.index = index;

            historyItem.addEventListener('click', () => selectConversation(index));
            historyContainer.appendChild(historyItem);
        });
    }

    function loadConversations() {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                conversations = JSON.parse(storedData);
                renderHistory();
                
                // If there are conversations, load the most recent one by default
                if (conversations.length > 0) {
                    selectConversation(conversations.length - 1);
                }
            } else {
                conversations = [];
            }
        } catch (e) {
            console.error("Error loading from Local Storage:", e);
            showError("Failed to load conversation history from your browser's storage.");
            conversations = [];
        }
    }
    
    function selectConversation(index) {
        if (index >= 0 && index < conversations.length) {
            currentConversationIndex = index;
            chatHistory = conversations[index].history;
            currentChatTitle.textContent = conversations[index].title;
            generateTitleButton.classList.add('hidden'); // Title is already generated
            
            chatContainer.innerHTML = '';
            // Re-render chat messages
            chatHistory.forEach(message => {
                // Determine if it's an image-only message (for VLM) or text message
                const textPart = message.parts.find(p => p.text)?.text;
                const imagePart = message.parts.find(p => p.inlineData);

                if (imagePart) {
                    const mimeType = imagePart.inlineData.mimeType;
                    const base64Data = imagePart.inlineData.data;
                    const imageSrc = `data:${mimeType};base64,${base64Data}`;
                    appendImage(imageSrc, message.role === 'user');
                }
                
                if (textPart) {
                    appendMessage(textPart, message.role === 'user');
                }
            });
            renderHistory(); // Update active state in sidebar
        }
    }

    async function startNewConversation() {
        // If an existing chat is open, first save it before starting a new one
        if (currentConversationIndex !== -1 && conversations[currentConversationIndex].title === "New Chat") {
             await generateChatTitle(); // Auto-save the previous untitled chat
        }
        
        chatContainer.innerHTML = '';
        chatHistory = [];
        uploadedImage = null;
        currentChatTitle.textContent = "New Chat";
        generateTitleButton.classList.remove('hidden');
        
        // Add a placeholder for the new conversation to the list
        conversations.push({ title: "New Chat", history: [] });
        currentConversationIndex = conversations.length - 1;
        saveConversations(); // Update history list in storage

        // Initial AI message
        const initialAiMessage = "Welcome to the Oasis. I am the golden intelligence. How may I assist your journey across the digital desert?";
        appendMessage(initialAiMessage, false);
        chatHistory.push({ role: 'model', parts: [{ text: initialAiMessage }] });
        
        // Note: The history of a new chat is only saved after the first user message.
    }

    // --- API Call Functions ---

    // LLM FEATURE: Title Generation
    async function generateChatTitle() {
        if (conversations[currentConversationIndex].title !== "New Chat") return; // Only title new chats
        if (chatHistory.length <= 1) { // Only the initial AI message is present
            showError("Please send a message before generating a title.");
            return;
        }

        loadingIndicator.classList.remove('hidden');

        // Only use the first few turns of conversation for a concise title
        const titleContext = chatHistory.slice(1, 5).map(m => `${m.role}: ${m.parts.find(p => p.text)?.text || '[Image]'} \n`).join('');
        const titlePrompt = `Generate a concise, 5-word title for the following conversation snippet, without any quotation marks or extra text. Title context: "${titleContext}"`;

        const payload = {
            apiType: 'title_gen', 
            model: 'gemini-2.5-flash-preview-05-20',
            contents: [{ role: 'user', parts: [{ text: titlePrompt }] }]
        };

        try {
            const response = await fetch(PROXY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) { throw new Error(`API error: ${response.status}`); }
            
            const result = await response.json();
            let newTitle = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^['"]|['"]$/g, '');

            if (newTitle) {
                // Update the state and save to Local Storage
                conversations[currentConversationIndex].title = newTitle;
                currentChatTitle.textContent = newTitle;
                generateTitleButton.classList.add('hidden');
                saveConversations();
            }

        } catch (error) {
            console.error('Title generation error:', error);
            showError("Failed to generate title. Conversation saved as 'New Chat'.");
            generateTitleButton.classList.remove('hidden');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }


    async function sendMessage() {
        const prompt = userInput.value.trim();
        if (!prompt && !uploadedImage) return;
        
        // Render user message/image
        if (prompt) { appendMessage(prompt, true); } 
        else if (uploadedImage) { appendImage(`data:${uploadedImage.inlineData.mimeType};base64,${uploadedImage.inlineData.data}`, true); }
        
        // Build parts for API request
        const parts = [];
        if (uploadedImage) parts.push(uploadedImage);
        if (prompt) parts.push({ text: prompt });
        
        chatHistory.push({ role: 'user', parts: parts });
        userInput.value = '';
        uploadedImage = null;

        loadingIndicator.classList.remove('hidden');
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // If it's a 'New Chat', update its history placeholder in the array
        if (currentConversationIndex !== -1) {
            conversations[currentConversationIndex].history = chatHistory;
        }

        const systemPrompt = "You are a friendly, conversational, and wise AI assistant named Oasis. You speak with a tone that evokes a golden oasis, using rich, elegant, and clear language. You provide helpful, concise answers. When asked a question that requires up-to-date information, use your Google Search tool to find the answer. Always cite your sources. You are capable of speaking your responses aloud.";

        const payload = {
            apiType: 'text_search', 
            model: 'gemini-2.5-flash-preview-05-20',
            contents: chatHistory,
            generationConfig: { 
                systemInstruction: { parts: [{ text: systemPrompt }] },
                tools: [{ "google_search": {} }],
            },
        };

        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (retries < maxRetries) {
            try {
                const response = await fetch(PROXY_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    const proxyError = errorData.error || errorData.details?.message || `Unknown error: ${response.status}`;
                    throw new Error(`API error: ${response.status} - ${proxyError}`);
                }
                
                const result = await response.json();
                const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (aiResponse) {
                    appendMessage(aiResponse, false);
                    chatHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
                    
                    // Update state and save to Local Storage after AI response
                    if (currentConversationIndex !== -1) {
                        conversations[currentConversationIndex].history = chatHistory;
                    }
                    saveConversations();

                    if (isTtsEnabled) { await getAndPlayTTS(aiResponse); }
                } else { throw new Error("Invalid response format from AI."); }
                break;
            } catch (error) {
                console.error('Fetch error:', error);
                retries++;
                if (retries >= maxRetries) {
                    showError("The connection to the golden oasis was broken. Please check your network and try again.");
                    break;
                }
                const delay = baseDelay * Math.pow(2, retries - 1);
                await new Promise(res => setTimeout(res, delay));
            }
        }
        loadingIndicator.classList.add('hidden');
    }

    // (getAndPlayTTS and generateImage functions remain the same, 
    // but a saveConversations() call is added after a successful API call in generateImage)

    async function getAndPlayTTS(text) {
        // (getAndPlayTTS logic) ...
        try {
            const payload = {
                apiType: 'tts', 
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: text }] }],
                generationConfig: { 
                    responseModalities: ["AUDIO"], 
                    speechConfig: { 
                        voiceConfig: { 
                            prebuiltVoiceConfig: { 
                                voiceName: "Kore"
                            } 
                        } 
                    } 
                },
            };
            const response = await fetch(PROXY_API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!response.ok) { throw new Error(`TTS API error: ${response.status}`); }
            const result = await response.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;
            if (audioData && mimeType && mimeType.startsWith("audio/")) { await playAudio(audioData, mimeType); }
        } catch (error) { console.error('TTS fetch error:', error); }
    }


    async function generateImage() {
        const prompt = userInput.value.trim();
        if (!prompt) { showError("Please enter a prompt to generate an image."); return; }
        
        appendMessage(prompt, true);
        
        // Add the user's image prompt to the history
        chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
        if (currentConversationIndex !== -1) {
            conversations[currentConversationIndex].history = chatHistory;
        }

        userInput.value = '';
        loadingIndicator.classList.remove('hidden');
        chatContainer.scrollTop = chatContainer.scrollHeight;
        let retries = 0;
        const maxRetries = 3;
        const baseDelay = 1000;
        while (retries < maxRetries) {
            try {
                const payload = { 
                    apiType: 'image_gen', 
                    model: 'imagen-3.0-generate-002',
                    instances: { prompt: `Golden oasis theme, ${prompt}` }, 
                    parameters: { "sampleCount": 1 } 
                };
                const response = await fetch(PROXY_API_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    const proxyError = errorData.error || errorData.details?.message || `Unknown error: ${response.status}`;
                    throw new Error(`Image Generation API error: ${proxyError}`);
                }
                const result = await response.json();
                const base64Data = result?.predictions?.[0]?.bytesBase64Encoded;
                if (base64Data) {
                    const imageUrl = `data:image/image/png;base64,${base64Data}`;
                    appendImage(imageUrl, false);
                    
                    // Add the AI's image response to the history (as an image part)
                    const imagePart = { inlineData: { mimeType: 'image/png', data: base64Data } };
                    chatHistory.push({ role: 'model', parts: [imagePart] });
                    
                    // Update state and save to Local Storage
                    if (currentConversationIndex !== -1) {
                        conversations[currentConversationIndex].history = chatHistory;
                    }
                    saveConversations();
                    
                } else { throw new Error("Invalid response from image generation API."); }
                break;
            } catch (error) {
                console.error('Image generation error:', error);
                retries++;
                if (retries >= maxRetries) {
                    showError("The sands are too turbulent. Failed to generate the image.");
                    break;
                }
                const delay = baseDelay * Math.pow(2, retries - 1);
                await new Promise(res => setTimeout(res, delay));
            }
        }
        loadingIndicator.classList.add('hidden');
    }
    
    // --- Event Listeners and Initial Load ---
    
    // Load conversations from Local Storage first, which will call startNewConversation if empty.
    loadConversations(); 

    sendButton.addEventListener('click', sendMessage);
    generateImageButton.addEventListener('click', generateImage);
    generateTitleButton.addEventListener('click', generateChatTitle); 

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    // Clear Button logic is now 'New Chat'
    clearButton.addEventListener('click', () => { startNewConversation(); });
    newChatButton.addEventListener('click', () => { startNewConversation(); });
    uploadButton.addEventListener('click', () => { imageUploadInput.click(); });
    
    ttsButton.addEventListener('click', () => {
        isTtsEnabled = !isTtsEnabled;
        
        // Toggle colors
        ttsButton.classList.toggle('bg-stone-700'); 
        ttsButton.classList.toggle('bg-green-600'); 
        ttsButton.classList.toggle('text-amber-400'); 
        ttsButton.classList.toggle('text-white'); 
        
        // Toggle Icon
        if (isTtsEnabled) {
            // Volume ON Icon (Volume-2)
            ttsIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        } else {
            // Volume OFF Icon (Volume-X)
            ttsIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
        }
    });

    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target.result;
                // Append image to the chat window immediately
                appendImage(imageData, true); 
                // Prepare the image object for the history array and API call
                uploadedImage = { inlineData: { mimeType: file.type, data: imageData.split(',')[1] } };
            };
            reader.readAsDataURL(file);
        }
    });
};