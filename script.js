window.onload = async function () {
  // --- API Configuration ---
  const PROXY_API_URL = "/.netlify/functions/gemini-proxy";

  // --- Local Storage Configuration ---
  const LOCAL_STORAGE_KEY = "oasisChatHistory";

  // --- DOM Elements ---
  const chatContainer = document.getElementById("chat-container");
  const historyContainer = document.getElementById("history-container");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");
  const clearButton = document.getElementById("clear-button");
  const uploadButton = document.getElementById("upload-button");
  const imageUploadInput = document.getElementById("image-upload");
  const ttsButton = document.getElementById("tts-button");
  const ttsIcon = document.getElementById("tts-icon");
  const generateImageButton = document.getElementById("generate-image-button");
  const newChatButton = document.getElementById("new-chat-button");
  const loadingIndicator = document.getElementById("loading-indicator");
  const errorModal = document.getElementById("error-modal");
  const errorMessage = document.getElementById("error-message");
  const closeErrorModal = document.getElementById("close-error-modal");
  const currentChatTitle = document.getElementById("current-chat-title");
  const userIdDisplay = document.getElementById("user-id-display");
  const generateTitleButton = document.getElementById("generate-title-button");

  // --- State Variables ---
  let chatHistory = [];
  let uploadedImage = null;
  let isTtsEnabled = false;
  let audioContext = null;
  let conversations = [];
  let currentConversationIndex = -1;

  userIdDisplay.textContent = `Storage: Local Browser`;

  // --- Avatars ---
  let userAvatarData =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1b876'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' font-family='Inter, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='%231c1917'%3EU</text%3E%3C/svg%3E";
  let aiAvatarData =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%2378350f'/%3E%3Ctext x='12' y='16' font-family='Inter, sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='%23d1b876'%3EO</text%3E%3C/svg%3E";

  // --- Utility Functions ---
  function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.remove("hidden");
  }

  closeErrorModal.addEventListener("click", () => {
    errorModal.classList.add("hidden");
  });

  function appendMessage(text, isUser = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `flex gap-2 animate-fade-in-up ${
      isUser ? "justify-end" : "justify-start"
    }`;

    const messageBubble = document.createElement("div");
    messageBubble.className = `p-4 rounded-3xl max-w-[80%] shadow-lg whitespace-pre-wrap ${
      isUser
        ? "bg-amber-700 text-amber-50 rounded-br-none"
        : "bg-stone-700 text-stone-100 rounded-bl-none"
    }`;
    messageBubble.innerHTML = text;

    const avatarImg = document.createElement("img");
    avatarImg.src = isUser ? userAvatarData : aiAvatarData;
    avatarImg.alt = isUser ? "User Avatar" : "Oasis Avatar";
    avatarImg.className =
      "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";

    if (isUser) {
      messageDiv.appendChild(messageBubble);
      messageDiv.appendChild(avatarImg);
    } else {
      messageDiv.appendChild(avatarImg);
      messageDiv.appendChild(messageBubble);
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function appendImage(imageSrc, isUser = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `flex gap-2 animate-fade-in-up ${
      isUser ? "justify-end" : "justify-start"
    }`;

    const avatarImg = document.createElement("img");
    avatarImg.src = isUser ? userAvatarData : aiAvatarData;
    avatarImg.alt = isUser ? "User Avatar" : "Oasis Avatar";
    avatarImg.className =
      "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";

    const imageElement = document.createElement("img");
    imageElement.src = imageSrc;
    imageElement.className =
      "message-image bg-stone-700 p-2 border border-amber-800 rounded-xl";

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

  // --- Typing Indicator ---
  function showTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "typing-indicator";
    indicator.className = "flex justify-start animate-fade-in-up";
    indicator.innerHTML = `
      <div class="p-4 rounded-3xl bg-stone-700 text-stone-300 text-sm shadow-md">
        <span class="animate-pulse">Oasis is thinking...</span>
      </div>
    `;
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  // --- Core Chat Logic ---
  async function sendMessage() {
    const prompt = userInput.value.trim();
    if (!prompt && !uploadedImage) return;

    if (prompt) appendMessage(prompt, true);
    else if (uploadedImage)
      appendImage(
        `data:${uploadedImage.inlineData.mimeType};base64,${uploadedImage.inlineData.data}`,
        true
      );

    const parts = [];
    if (uploadedImage) parts.push(uploadedImage);
    if (prompt) parts.push({ text: prompt });

    chatHistory.push({ role: "user", parts });
    userInput.value = "";
    uploadedImage = null;

    loadingIndicator.classList.remove("hidden");
    showTypingIndicator();

    const systemPrompt =
      "You are Oasis, a warm and wise AI assistant speaking with golden clarity and calmness. Keep replies concise but expressive.";

    const payload = {
      apiType: "text_search",
      model: "gemini-2.5-flash-preview-05-20",
      contents: chatHistory,
      generationConfig: {},
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
      const response = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Streamed response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      appendMessage("", false);
      const lastBubble = chatContainer.lastElementChild.querySelector("div.p-4");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const matches = buffer.match(/"text":"(.*?)"/g);
        if (matches) {
          for (const match of matches) {
            const text = match
              .replace(/"text":"|"/g, "")
              .replace(/\\n/g, "\n");
            lastBubble.innerHTML += text;
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }
      }

      chatHistory.push({
        role: "model",
        parts: [{ text: lastBubble.textContent }],
      });
    } catch (err) {
      console.error("Fetch error:", err);
      showError("The connection to the Oasis was lost. Try again.");
    } finally {
      loadingIndicator.classList.add("hidden");
    }
  }

  // --- Image Generation ---
  async function generateImage() {
    const prompt = userInput.value.trim();
    if (!prompt) {
      showError("Please enter a prompt to generate an image.");
      return;
    }

    appendMessage(prompt, true);
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    userInput.value = "";
    showTypingIndicator();

    const payload = {
      apiType: "image_gen",
      model: "imagen-3.0-generate-002",
      instances: { prompt },
      parameters: { sampleCount: 1 },
    };

    try {
      const response = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      hideTypingIndicator();

      const result = await response.json();
      const base64Data =
        result?.predictions?.[0]?.bytesBase64Encoded ||
        result?.images?.[0]?.bytesBase64Encoded;

      if (base64Data) {
        const imageUrl = `data:image/png;base64,${base64Data}`;
        appendImage(imageUrl, false);
        chatHistory.push({
          role: "model",
          parts: [{ inlineData: { mimeType: "image/png", data: base64Data } }],
        });
      } else {
        showError("Failed to generate image.");
      }
    } catch (error) {
      console.error("Image generation error:", error);
      showError("Image generation failed. Please try again.");
    }
  }

  // --- Event Listeners ---
  sendButton.addEventListener("click", sendMessage);
  generateImageButton.addEventListener("click", generateImage);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  clearButton.addEventListener("click", () => {
    chatContainer.innerHTML = "";
    chatHistory = [];
  });

  uploadButton.addEventListener("click", () => imageUploadInput.click());
  imageUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target.result.split(",")[1];
        uploadedImage = { inlineData: { mimeType: file.type, data } };
        appendImage(`data:${file.type};base64,${data}`, true);
      };
      reader.readAsDataURL(file);
    }
  });
};
