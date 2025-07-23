// Getting elements needed for the chatbot functions
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const responseCache = new Map(); // In-memory cache

// Chat session management
let currentChatId = null;
let currentUserId = null;

// Google Gemini API configuration
const API_KEY = "AIzaSyCGLGstJAm3sW-CEvTQS8YyXE8ERRNraJA";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Function to show error messages
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message');
    errorDiv.textContent = message;
    chatHistory.appendChild(errorDiv);
    
    // Remove the error message after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Initialize chat after login
async function initializeChat(userId) {
    currentUserId = userId;
    localStorage.setItem('userId', userId);
    await createNewChat();
    await loadPreviousChats();
}

// Check login status when page loads
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        await initializeChat(userId);
    } else {
        window.location.href = '/index.html';
    }
});

// Event listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Modified sendMessage function
async function sendMessage() {
    if (!currentChatId) {
        try {
            await createNewChat();
        } catch (error) {
            showErrorMessage('Error: Failed to create new chat');
            return;
        }
    }

    const message = userInput.value;
    if (!message.trim()) return;
    
    userInput.value = '';

    const userMessageDiv = document.createElement("div");
    userMessageDiv.classList.add("chat-message", "user-message");
    userMessageDiv.innerHTML = `<b>You:</b> ${message}`;
    chatHistory.appendChild(userMessageDiv);

    try {
        await saveMessage('user', message);

        const loadingDiv = document.createElement("div");
        loadingDiv.classList.add("chat-message", "chatbot-message", "loading");    
        loadingDiv.innerHTML = `<b>ChatBot:</b> <span class="typing-indicator">Thinking...</span>`;
        chatHistory.appendChild(loadingDiv);

        const apiResponse = await fetchAPIResponse(message, responseCache);
        loadingDiv.remove();
        
        const chatbotMessageDiv = document.createElement("div");
        chatbotMessageDiv.classList.add("chat-message", "chatbot-message");
        chatbotMessageDiv.innerHTML = `<b>ChatBot:</b> <span id="typing-text"></span>`;
        chatHistory.appendChild(chatbotMessageDiv);

        await saveMessage('chatbot', apiResponse);
        
        // Typing effect
        await typeResponse(apiResponse, chatbotMessageDiv.querySelector("#typing-text"));

        chatHistory.scrollTop = chatHistory.scrollHeight;
    } catch (error) {
        console.error('Error:', error);
        if (loadingDiv) {
            loadingDiv.remove();
        }
        showErrorMessage('Error: Failed to send message');
    }
}

// Function for typing effect
async function typeResponse(responseText, container) {
    const typingSpeed = 2; // Minimum is effectively 1ms per cycle due to setTimeout constraints
    const batchSize = Math.max(1, Math.floor(50 / typingSpeed)); // Characters per cycle
    let i = 0;

    return new Promise((resolve) => {
        function typeBatch() {
            if (i < responseText.length) {
                container.textContent += responseText.slice(i, i + batchSize); // Append a batch of characters
                i += batchSize;
                setTimeout(typeBatch, typingSpeed);
            } else {
                resolve();
            }
        }

        typeBatch();
    });
}

// Database interaction functions
async function createNewChat() {
    try {
        if (!currentUserId) {
            currentUserId = localStorage.getItem('userId');
        }

        if (!currentUserId) {
            showErrorMessage('Error: No user ID found. Please log in again.');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
            return;
        }

        const response = await fetch('/api/create-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                title: `Chat ${new Date().toLocaleString()}`
            })
        });
        const data = await response.json();
        currentChatId = data.chat_id;
        await loadPreviousChats();
        return currentChatId;
    } catch (error) {
        console.error('Error creating chat:', error);
        showErrorMessage('Error creating chat session. Please try logging in again.');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
    }
}

async function loadPreviousChats() {
    try {
        if (!currentUserId) {
            return;
        }

        const response = await fetch(`/api/get-user-chats/${currentUserId}`);
        const chats = await response.json();
        
        const chatsContainer = document.querySelector('.chats-container');
        chatsContainer.innerHTML = '';

        chats.forEach(chat => {
            const chatLink = document.createElement('a');
            chatLink.href = '#';
            chatLink.innerHTML = `<img src="/images/Icon5.png" alt="icon" class="text-icon-prevchat"> ${chat.chat_title}`;
            chatLink.onclick = (e) => {
                e.preventDefault();
                loadChat(chat.chat_id);
            };
            chatsContainer.appendChild(chatLink);
        });

        chatsContainer.scrollTop = chatsContainer.scrollHeight;
    } catch (error) {
        console.error('Error loading chats:', error);
        showErrorMessage('Error: Failed to load chat history');
    }
}

async function loadChat(chatId) {
    try {
        const response = await fetch(`/api/get-chat-messages/${chatId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch chat messages');
        }
        
        const messages = await response.json();
        currentChatId = chatId;
        
        chatHistory.innerHTML = '';

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('chat-message');
            
            if (msg.role === 'user') {
                messageDiv.classList.add('user-message');
                messageDiv.innerHTML = `<b>You:</b> ${msg.message_content}`;
            } else {
                messageDiv.classList.add('chatbot-message');
                messageDiv.innerHTML = `<b>ChatBot:</b> ${msg.message_content}`;
            }
            
            chatHistory.appendChild(messageDiv);
        });

        chatHistory.scrollTop = chatHistory.scrollHeight;
    } catch (error) {
        console.error('Error loading chat:', error);
        showErrorMessage('Error: Failed to load chat messages');
    }
}

async function saveMessage(role, content) {
    try {
        const response = await fetch('/api/save-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: currentChatId,
                role: role,
                message_content: content
            })
        });
        if (!response.ok) {
            throw new Error('Failed to save message');
        }
    } catch (error) {
        console.error('Error saving message:', error);
        showErrorMessage('Error: Failed to save message');
    }
}

function generateCacheKey(userMessage, conversationHistory) {
    const key = JSON.stringify({ message: userMessage, history: conversationHistory });
    return key;
}

async function fetchAPIResponse(userMessage, conversationHistory) {
    const cacheKey = generateCacheKey(userMessage, conversationHistory);
    if (responseCache.has(cacheKey)) {
        return responseCache.get(cacheKey); 
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: userMessage }],
                }],
                generationConfig: {
                    temperature: 0.5,
                    topK: 40,
                    topP: 0.9
                },
                systemInstruction: {
                    role: "model",
                    parts: [{ text: "Your name is TechSupportAI. If the user greet you, greet back." }]
                }
            }),
        });

        const data = await response.json();
        console.log(data);
        
        if (!response.ok) {
            throw new Error(data.error?.message || "API request failed");
        }
        
        const apiResponseText = data?.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1');
        responseCache.set(cacheKey, apiResponseText);
        return apiResponseText;
    } catch (error) {
        console.error("Error fetching API response:", error);
        showErrorMessage('Error: Failed to get response from AI');
        return "I'm having trouble responding right now. Please try again later.";
    }
}

function toggleCustomizationBox() {
    var box = document.getElementById("customization-box");
    if (box.style.display === "none" || box.style.display === "") {
        box.style.display = "block";
    } else {
        box.style.display = "none";
    }
}

function toggleDarkMode() {
    // Implementation needed
}

function changeLanguage(lang) {
    // Implementation needed
}