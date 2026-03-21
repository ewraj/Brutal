// BRUTAL Web App Core Logic
const BRUTAL_PERSONA = `You are BRUTAL, a hyper-competent and ruthlessly efficient technical advisor. 
Your core mission is to optimize code, architecture, and logic with radical candor. 

OPERATIONAL DIRECTIVES:
1. NO FILLER: Skip all greetings, affirmations, and pleasantries. 
2. RADICAL CANDOR: If an idea is flawed, say so immediately and directly. Do not sugarcoat technical failures.
3. OBJECTIVE CRITIQUE: Target your criticism at the WORK, not the person. Use sharp, blunt language for technical errors (e.g., "This memory management is a disaster," "This logic is fundamentally broken").
4. OPTIMAL SOLUTIONS ONLY: Tearing down a problem is only half your job. You must ALWAYS provide the most efficient, production-ready, and scientifically correct solution.
5. NO SYCOPHANCY: Never use empty praise like "good attempt." If it's not optimal, it's not finished.

Your goal is to be the ultimate filter for mediocre ideas, ensuring only the most robust and efficient technical designs survive. 
Output format:
- THE CRITIQUE: Direct identification of the flaw or inefficiency.
- THE BREAKDOWN: Precise technical explanation of the failure.
- THE OPTIMAL FIX: The definitive, high-performance solution.`;

const STATE = {
    chats: {},
    currentChatId: null,
    isThinking: false
};

// UI Elements
const el = {
    messages: document.getElementById('messages'),
    input: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    statusPill: document.getElementById('status-pill'),
    statusText: document.getElementById('status-text'),
    loginOverlay: document.getElementById('login-overlay'),
    loginBtn: document.getElementById('login-btn'),
    sidebar: document.getElementById('sidebar'),
    chatList: document.getElementById('chat-list'),
    newChatBtn: document.getElementById('new-chat-btn')
};

// --- Initialization ---
async function init() {
    try {
        // Wait for Puter and its auth objects to be fully injected
        for (let i = 0; i < 20; i++) {
            if (window.puter && puter.auth) break;
            await new Promise(r => setTimeout(r, 200));
        }

        if (!puter.auth.isSignedIn()) {
            el.loginOverlay.classList.remove('hidden');
            el.statusText.innerText = "Waiting for Login...";
        } else {
            onReady();
        }
    } catch (err) {
        console.error("Initialization failed:", err);
        el.statusText.innerText = "Connection Failed";
    }
}

function onReady() {
    el.loginOverlay.classList.add('hidden');
    el.statusPill.classList.add('online');
    el.statusText.innerText = "Connected to Gemini";
    el.sendBtn.disabled = false;
    loadChats();
    el.input.focus();
}

// --- Chat History Logic ---
function loadChats() {
    const saved = localStorage.getItem('brutal_chats');
    if (saved) {
        try {
            STATE.chats = JSON.parse(saved);
            // Cleanup empty chats on initialization
            for (const id in STATE.chats) {
                if (STATE.chats[id].messages.length <= 1) {
                    delete STATE.chats[id];
                }
            }
        } catch (e) {
            console.error("Failed to parse chats", e);
            STATE.chats = {};
        }
    }
    
    const chatIds = Object.keys(STATE.chats);
    if (chatIds.length > 0) {
        const latestId = chatIds.sort((a, b) => b - a)[0];
        switchChat(latestId);
    } else {
        renderSidebar();
        startNewChat();
    }
}

function saveChats() {
    localStorage.setItem('brutal_chats', JSON.stringify(STATE.chats));
}

function startNewChat() {
    // Prevent creating multiple stacked empty chats
    if (STATE.currentChatId && STATE.chats[STATE.currentChatId]?.messages.length <= 1) {
        return;
    }

    const id = Date.now().toString();
    STATE.currentChatId = id;
    STATE.chats[id] = {
        id: id,
        title: 'New Chat',
        messages: [{ role: 'system', content: BRUTAL_PERSONA }]
    };
    saveChats();
    renderSidebar();
    renderCurrentChat();
}

function switchChat(id) {
    if (STATE.isThinking || STATE.currentChatId === id) return;
    
    // Cleanup empty chats when navigating away to keep the sidebar clean
    if (STATE.currentChatId && STATE.chats[STATE.currentChatId]?.messages.length <= 1) {
        delete STATE.chats[STATE.currentChatId];
        saveChats();
    }

    STATE.currentChatId = id;
    renderSidebar();
    renderCurrentChat();
}

function renderSidebar() {
    el.chatList.innerHTML = '';
    const sortedChats = Object.values(STATE.chats).sort((a, b) => b.id - a.id);
    for (const chat of sortedChats) {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;
        div.innerText = chat.title;
        div.onclick = () => switchChat(chat.id);
        el.chatList.appendChild(div);
    }
}

function renderCurrentChat() {
    el.messages.innerHTML = `<div class="system-notice"><p>System Initialized. No sycophancy. No filler. Just optimization.</p></div>`;
    const chat = STATE.chats[STATE.currentChatId];
    chat.messages.forEach(m => {
        if (m.role !== 'system') addMessage(m.role, m.content);
    });
    scrollToBottom();
}

// --- Chat Logic ---
async function sendMessage() {
    const text = el.input.value.trim();
    if (!text || STATE.isThinking) return;

    const chat = STATE.chats[STATE.currentChatId];

    // UI Update: User Message
    addMessage('user', text);
    el.input.value = '';
    adjustTextareaHeight();
    
    chat.messages.push({ role: 'user', content: text });
    
    // Auto-generate title for first user message
    if (chat.messages.length === 2) {
        chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderSidebar();
    }
    saveChats();

    STATE.isThinking = true;
    el.sendBtn.disabled = true;
    el.statusPill.classList.add('loading');

    // UI Update: Brutal Placeholder
    const brutalMsgEl = addMessage('brutal', '...');
    const contentEl = brutalMsgEl.querySelector('.content');

    try {
        const stream = await puter.ai.chat(chat.messages, { 
            model: 'gemini-2.0-flash', 
            stream: true 
        });

        let fullReply = "";
        contentEl.innerHTML = ""; // clear dots

        for await (const part of stream) {
            if (part?.text) {
                fullReply += part.text;
                // Render markdown on the fly
                contentEl.innerHTML = marked.parse(fullReply);
                scrollToBottom();
            }
        }
        
        // Highlight code blocks once after the stream finishes to prevent extreme UI lag
        contentEl.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        chat.messages.push({ role: 'assistant', content: fullReply });
        saveChats();
    } catch (err) {
        contentEl.innerHTML = `<span style="color:var(--brutal-red)">[ERROR: ${err.message}]</span>`;
    } finally {
        STATE.isThinking = false;
        el.sendBtn.disabled = false;
        el.statusPill.classList.remove('loading');
        scrollToBottom();
    }
}

// --- UI Helpers ---
function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `
        <span class="label">${role === 'user' ? 'YOU' : 'BRUTAL'}</span>
        <div class="content"></div>
    `;
    
    // Safely inject text to prevent user-driven XSS
    const contentDiv = div.querySelector('.content');
    if (role === 'user') {
        contentDiv.textContent = text;
    } else {
        contentDiv.innerHTML = marked.parse(text);
    }
    
    el.messages.appendChild(div);
    
    if (role === 'brutal') {
        div.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
    
    scrollToBottom();
    return div;
}

function scrollToBottom() {
    const container = document.getElementById('chat-container');
    container.scrollTop = container.scrollHeight;
}

function adjustTextareaHeight() {
    el.input.style.height = 'auto';
    el.input.style.height = el.input.scrollHeight + 'px';
}

// --- Event Listeners ---
el.input.addEventListener('input', adjustTextareaHeight);

el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

el.sendBtn.addEventListener('click', sendMessage);

el.loginBtn.addEventListener('click', async () => {
    try {
        await puter.auth.signIn();
        onReady();
    } catch (err) {
        alert("Login failed. Please try again.");
    }
});

el.newChatBtn.addEventListener('click', () => {
    if (!STATE.isThinking) {
        startNewChat();
        el.input.focus();
    }
});

// Start app
init();
