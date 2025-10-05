window.onload = async function () {
  const PROXY_API_URL = "/.netlify/functions/gemini-proxy";

  const chatContainer = document.getElementById("chat-container");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");
  const generateImageButton = document.getElementById("generate-image-button");
  const uploadButton = document.getElementById("upload-button");
  const imageUploadInput = document.getElementById("image-upload");
  const ttsButton = document.getElementById("tts-button");
  const clearButton = document.getElementById("clear-button");
  const errorModal = document.getElementById("error-modal");
  const errorMessage = document.getElementById("error-message");
  const closeErrorModal = document.getElementById("close-error-modal");
  const loadingIndicator = document.getElementById("loading-indicator");

  let chatHistory = [];
  let uploadedImage = null;
  let isTtsEnabled = false;

  const userAvatarData =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1b876'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' font-family='Inter' font-size='12' font-weight='bold' text-anchor='middle' fill='%231c1917'%3EU</text%3E%3C/svg%3E";
  const aiAvatarData =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%2378350f'/%3E%3Ctext x='12' y='16' font-family='Inter' font-size='14' font-weight='bold' text-anchor='middle' fill='%23d1b876'%3EO</text%3E%3C/svg%3E";

  // --- UI helpers ---
  function showError(msg) {
    errorMessage.textContent = msg;
    errorModal.classList.remove("hidden");
  }
  closeErrorModal.addEventListener("click", () => errorModal.classList.add("hidden"));

  function appendMessage(text, isUser = false) {
    const div = document.createElement("div");
    div.className = `flex gap-2 animate-fade-in-up ${
      isUser ? "justify-end" : "justify-start"
    }`;
    const bubble = document.createElement("div");
    bubble.className = `p-4 rounded-3xl max-w-[80%] shadow-lg whitespace-pre-wrap ${
      isUser
        ? "bg-amber-700 text-amber-50 rounded-br-none"
        : "bg-stone-700 text-stone-100 rounded-bl-none"
    }`;
    bubble.innerHTML = text;
    const avatar = document.createElement("img");
    avatar.src = isUser ? userAvatarData : aiAvatarData;
    avatar.className =
      "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";
    if (isUser) {
      div.appendChild(bubble);
      div.appendChild(avatar);
    } else {
      div.appendChild(avatar);
      div.appendChild(bubble);
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function appendImage(imageSrc, isUser = false) {
    const div = document.createElement("div");
    div.className = `flex gap-2 animate-fade-in-up ${
      isUser ? "justify-end" : "justify-start"
    }`;
    const avatar = document.createElement("img");
    avatar.src = isUser ? userAvatarData : aiAvatarData;
    avatar.className =
      "w-10 h-10 rounded-full flex-shrink-0 shadow-md border border-amber-600/50";
    const img = document.createElement("img");
    img.src = imageSrc;
    img.className =
      "message-image bg-stone-700 p-2 border border-amber-800 rounded-xl";
    if (isUser) {
      div.appendChild(img);
      div.appendChild(avatar);
    } else {
      div.appendChild(avatar);
      div.appendChild(img);
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function showTyping() {
    if (document.getElementById("typing-indicator")) return;
    const indicator = document.createElement("div");
    indicator.id = "typing-indicator";
    indicator.className = "flex justify-start animate-fade-in-up";
    indicator.innerHTML =
      '<div class="p-4 rounded-3xl bg-stone-700 text-stone-300 text-sm shadow-md"><span class="animate-pulse">Oasis is thinking...</span></div>';
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  // --- Send text ---
  async function sendMessage() {
    const prompt = userInput.value.trim();
    if (!prompt && !uploadedImage) return;

    appendMessage(prompt, true);
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    userInput.value = "";

    showTyping();

    const payload = {
      apiType: "text_search",
      model: "gemini-2.5-flash", // ✅ Free-tier text model
      contents: chatHistory,
      generationConfig: {},
      systemInstruction: {
        parts: [
          { text: "You are Oasis, a helpful and kind AI assistant." },
        ],
      },
    };

    try {
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      hideTyping();
      if (!res.ok) throw new Error("Response error");
      const result = await res.json();
      const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        appendMessage(reply, false);
        chatHistory.push({ role: "model", parts: [{ text: reply }] });
        if (isTtsEnabled) await speak(reply);
      }
    } catch (err) {
      hideTyping();
      showError("Gemini API error: " + err.message);
    }
  }

  // --- TTS ---
  async function speak(text) {
    try {
      const payload = {
        apiType: "tts",
        model: "gemini-2.5-flash-preview-tts", // ✅ Free-tier TTS model
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
      };
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("TTS failed");
      const result = await res.json();
      const audioPart = result?.candidates?.[0]?.content?.parts?.[0];
      const data = audioPart?.inlineData?.data;
      const mime = audioPart?.inlineData?.mimeType;
      if (data && mime) {
        const audioUrl = `data:${mime};base64,${data}`;
        new Audio(audioUrl).play();
      }
    } catch (err) {
      console.error("TTS error:", err);
    }
  }

  // --- Image Generation ---
  async function generateImage() {
    const prompt = userInput.value.trim();
    if (!prompt) {
      showError("Enter a prompt to generate an image.");
      return;
    }
    appendMessage(prompt, true);
    showTyping();

    const payload = {
      apiType: "image_gen",
      model: "gemini-2.0-flash-preview-image-generation", // ✅ Free-tier image model
      instances: { prompt },
      parameters: { sampleCount: 1 },
    };

    try {
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      hideTyping();
      const result = await res.json();
      const base64 =
        result?.predictions?.[0]?.bytesBase64Encoded ||
        result?.images?.[0]?.bytesBase64Encoded;
      if (base64) appendImage(`data:image/png;base64,${base64}`, false);
      else showError("Image generation returned no data.");
    } catch (err) {
      hideTyping();
      showError("Image generation failed: " + err.message);
    }
  }

  // --- Event Listeners ---
  sendButton.addEventListener("click", sendMessage);
  generateImageButton.addEventListener("click", generateImage);
  ttsButton.addEventListener("click", () => {
    isTtsEnabled = !isTtsEnabled;
    ttsButton.classList.toggle("bg-green-600", isTtsEnabled);
    ttsButton.classList.toggle("bg-stone-700", !isTtsEnabled);
  });
  clearButton.addEventListener("click", () => (chatContainer.innerHTML = ""));
  uploadButton.addEventListener("click", () => imageUploadInput.click());
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
};
