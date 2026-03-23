// BRUTAL Web App Core Logic
const BRUTAL_PERSONA = `You are BRUTAL, a hyper-competent and ruthlessly efficient technical advisor. 
Your core mission is to optimize code, architecture, and logic with radical candor. 

OPERATIONAL DIRECTIVES:
1. NO FILLER: Skip all greetings, affirmations, and pleasantries. 
2. RADICAL CANDOR: If an idea is flawed, say so immediately and directly. Focus on technical efficiency, not forced humiliation.
3. OBJECTIVE CRITIQUE: Target your criticism at the WORK. Use sharp, blunt language for technical errors (e.g., "This logic is fundamentally broken"). Be rude only if the technical failure warrants it.
4. OPTIMAL SOLUTIONS ONLY: Provide the most efficient, production-ready, and scientifically correct solution.
5. NO SYCOPHANCY: Never use empty praise like "good attempt." If it's not optimal, it's not finished.
6. NO MANDATORY FORMATTING: Deliver your technical insights directly. Do not use forced headers or structured outputs unless they improve clarity for the specific problem.

Your goal is to be the ultimate filter for mediocre ideas, ensuring only the most robust and efficient technical designs survive. `;

const STATE = {
    chats: {},
    currentChatId: null,
    isThinking: false,
    recognition: null,
    isListening: false
};

// UI Elements
const el = {
    messages: document.getElementById('messages'),
    input: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    loginOverlay: document.getElementById('login-overlay'),
    loginBtn: document.getElementById('login-btn'),
    sidebar: document.getElementById('sidebar'),
    chatList: document.getElementById('chat-list'),
    newChatBtn: document.getElementById('new-chat-btn'),
    chatWrapper: document.getElementById('chat-wrapper'),
    micBtn: document.getElementById('mic-btn'),
    sidebarToggle: document.getElementById('sidebar-toggle')
};

// --- Initialization ---
async function init() {
    try {
        for (let i = 0; i < 20; i++) {
            if (window.puter && puter.auth) break;
            await new Promise(r => setTimeout(r, 200));
        }

        if (!puter.auth.isSignedIn()) {
            el.loginOverlay.classList.remove('hidden');
        } else {
            await onReady();
        }
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

async function onReady() {
    el.loginOverlay.classList.add('hidden');
    el.sendBtn.disabled = false;
    await loadChats();
    el.input.focus();
}

// --- Chat History Logic ---
async function loadChats() {
    try {
        let saved = await puter.kv.get('brutal_chats');
        let savedCurrentId = await puter.kv.get('brutal_current_chat_id');
        
        // Seamless migration from old localStorage to Puter KV
        if (!saved && localStorage.getItem('brutal_chats')) {
            saved = localStorage.getItem('brutal_chats');
            savedCurrentId = localStorage.getItem('brutal_current_chat_id');
            await puter.kv.set('brutal_chats', saved);
            if (savedCurrentId) await puter.kv.set('brutal_current_chat_id', savedCurrentId);
            
            localStorage.removeItem('brutal_chats');
            localStorage.removeItem('brutal_current_chat_id');
        }

        if (saved) {
            try {
                STATE.chats = typeof saved === 'string' ? JSON.parse(saved) : saved;
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

        if (savedCurrentId && STATE.chats[savedCurrentId]) {
            STATE.currentChatId = String(savedCurrentId);
            renderSidebar();
            renderCurrentChat();
        } else {
            startNewChat();
        }
    } catch (err) {
        console.error("Failed to load chats from Puter KV", err);
        startNewChat();
    }
}

function saveChats() {
    puter.kv.set('brutal_chats', JSON.stringify(STATE.chats)).catch(console.error);
    if (STATE.currentChatId) {
        puter.kv.set('brutal_current_chat_id', STATE.currentChatId).catch(console.error);
    }
}

function startNewChat() {
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

    if (STATE.currentChatId && STATE.chats[STATE.currentChatId]?.messages.length <= 1) {
        delete STATE.chats[STATE.currentChatId];
    }

    STATE.currentChatId = id;
    saveChats();
    renderSidebar();
    renderCurrentChat();
}

function renderSidebar() {
    el.chatList.innerHTML = '';
    const sortedChats = Object.values(STATE.chats).sort((a, b) => b.id - a.id);
    for (const chat of sortedChats) {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.innerText = chat.title;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete Chat';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering switchChat
            deleteChat(chat.id);
        };
        
        div.appendChild(titleSpan);
        div.appendChild(deleteBtn);
        
        div.onclick = () => switchChat(chat.id);
        el.chatList.appendChild(div);
    }
}

function deleteChat(id) {
    delete STATE.chats[id];
    saveChats();
    
    if (STATE.currentChatId === id) {
        STATE.currentChatId = null;
        const remainingChats = Object.values(STATE.chats).sort((a, b) => b.id - a.id);
        if (remainingChats.length > 0) {
            switchChat(remainingChats[0].id);
        } else {
            startNewChat();
        }
    } else {
        renderSidebar();
    }
}

function renderCurrentChat() {
    el.messages.innerHTML = `<div class="system-notice"><p>System Initialized. No sycophancy. No filler. Just optimization.</p></div>`;
    const chat = STATE.chats[STATE.currentChatId];

    if (chat.messages.length <= 1) {
        el.chatWrapper.classList.add('initial-state');
    } else {
        el.chatWrapper.classList.remove('initial-state');
    }

    chat.messages.forEach(m => {
        if (m.role !== 'system') addMessage(m.role, m.content);
    });
    scrollToBottom();
}

// --- Chat Logic ---
async function sendMessage() {
    // Kill mic on send
    if (STATE.isListening && STATE.recognition) {
        STATE.recognition.stop();
    }

    const text = el.input.value.trim();
    if (!text || STATE.isThinking) return;

    // ✅ FIX 1: 'chat' was never declared — this caused a silent crash
    // that prevented ANY of the sendMessage logic from running,
    // which also broke the STT text appearing to "do nothing".
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat) return;

    addMessage('user', text);
    el.input.value = '';
    adjustTextareaHeight();

    chat.messages.push({ role: 'user', content: text });

    el.chatWrapper.classList.remove('initial-state');

    if (chat.messages.length === 2) {
        chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderSidebar();
    }
    saveChats();

    STATE.isThinking = true;
    el.sendBtn.disabled = true;

    const brutalMsgEl = addMessage('brutal', '...');
    const contentEl = brutalMsgEl.querySelector('.content');

    try {
        // Pass a pristine copy of the messages to prevent SDK mutation issues
        const payload = chat.messages.map(m => ({ role: m.role, content: m.content }));

        const stream = await puter.ai.chat(payload, {
            model: 'gemini-2.0-flash',
            stream: true
        });

        let fullReply = "";
        contentEl.innerHTML = "";

        for await (const part of stream) {
            if (part?.text) {
                fullReply += part.text;
                contentEl.innerHTML = marked.parse(fullReply);
                scrollToBottom();
            }
        }

        contentEl.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        chat.messages.push({ role: 'assistant', content: fullReply });
        saveChats();
    } catch (err) {
        contentEl.innerHTML = `<span style="color:var(--brutal-red)">[ERROR: ${err.message}]</span>`;
        
        // Revert the user message so the chat history isn't corrupted by consecutive user roles
        if (chat.messages[chat.messages.length - 1]?.role === 'user') {
            chat.messages.pop();
            saveChats();
        }
    } finally {
        STATE.isThinking = false;
        el.sendBtn.disabled = false;
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

el.sidebarToggle.addEventListener('click', () => {
    el.sidebar.classList.toggle('collapsed');
});

el.loginBtn.addEventListener('click', async () => {
    try {
        await puter.auth.signIn();
        await onReady();
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
init();