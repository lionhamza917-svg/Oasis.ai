// script.js — Updated with working image generation support


const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const loadingIndicator = document.getElementById('loading-indicator');
const PROXY_API_URL = '/.netlify/functions/gemini-proxy';


let chatHistory = [];
let conversations = [];
let currentConversationIndex = -1;


function appendMessage(text, isUser = false) {
const messageDiv = document.createElement('div');
messageDiv.classList.add('message', isUser ? 'user-message' : 'ai-message');
messageDiv.textContent = text;
chatContainer.appendChild(messageDiv);
chatContainer.scrollTop = chatContainer.scrollHeight;
}


function appendImage(imageUrl) {
const imgDiv = document.createElement('div');
imgDiv.classList.add('ai-message');
const img = document.createElement('img');
img.src = imageUrl;
img.alt = 'Generated image';
img.classList.add('generated-image');
imgDiv.appendChild(img);
chatContainer.appendChild(imgDiv);
chatContainer.scrollTop = chatContainer.scrollHeight;
}


function showError(errorMsg) {
const errorDiv = document.createElement('div');
errorDiv.classList.add('error-message');
errorDiv.textContent = errorMsg;
chatContainer.appendChild(errorDiv);
chatContainer.scrollTop = chatContainer.scrollHeight;
}


function saveConversations() {
localStorage.setItem('conversations', JSON.stringify(conversations));
}


async function generateImage() {
const prompt = userInput.value.trim();
if (!prompt) { showError("Please enter a prompt to generate an image."); return; }


appendMessage(prompt, true);
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


});
