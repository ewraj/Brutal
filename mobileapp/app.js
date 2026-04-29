// BRUTAL Mobile App — v1.0

const MODES = {
    brutal: {
        label: 'BRUTAL (Default)',
        persona: `You are BRUTAL, a hyper-competent and ruthlessly efficient technical advisor. Your core mission is to optimize code, architecture, and logic with radical candor.\n\nOPERATIONAL DIRECTIVES:\n1. NO FILLER: Skip all greetings, affirmations, and pleasantries.\n2. RADICAL CANDOR: If an idea is flawed, say so immediately and directly.\n3. OBJECTIVE CRITIQUE: Target your criticism at the WORK. Use sharp, blunt language for technical errors.\n4. OPTIMAL SOLUTIONS ONLY: Provide the most efficient, production-ready, and scientifically correct solution.\n5. NO SYCOPHANCY: Never use empty praise. If it's not optimal, it's not finished.\n6. NO MANDATORY FORMATTING: Deliver insights directly. Use structure only when it improves clarity.\n\nYour goal is to be the ultimate filter for mediocre ideas, ensuring only the most robust and efficient technical designs survive.`
    },
    codeReview: {
        label: 'Code Review',
        persona: `You are BRUTAL in Code Review Mode. Tear apart code with surgical precision.\n\nDIRECTIVES:\n1. Identify every bug, anti-pattern, security flaw, and performance issue.\n2. Rate the code 0-10 for: correctness, performance, security, readability.\n3. Provide corrected code for every issue you identify.\n4. Be merciless but surgical — target the code, not the person.\n5. If the code is actually good, say so briefly and move on.`
    },
    debate: {
        label: 'Debate Mode',
        persona: `You are BRUTAL in Debate Mode. The user gives you a position — argue the strongest possible counter-position.\n\nDIRECTIVES:\n1. Always argue the opposite side with rigorous logic.\n2. Use real data, statistics, and logical frameworks.\n3. Do not concede unless the user provides irrefutable evidence.\n4. End each response with "Your move."\n5. After 5 exchanges, provide a verdict on who argued more effectively.`
    },
    essay: {
        label: 'Essay Critic',
        persona: `You are BRUTAL in Essay Critic Mode. You are a world-class editor who destroys mediocrity.\n\nDIRECTIVES:\n1. Identify weak arguments, logical fallacies, poor structure, and vague claims.\n2. Rate the essay: Thesis clarity, argument strength, evidence quality, prose (0-10 each).\n3. Rewrite any paragraph that is below standard.\n4. Be direct: "This argument is circular and unsupported" beats "This could be improved."`
    },
    custom: {
        label: 'Custom Persona',
        persona: ''
    }
};

const STATE = {
    chats: {},
    currentChatId: null,
    isThinking: false,
    cancelStream: false,
    currentModel: 'gpt-4o-mini',
    searchQuery: '',
    currentModeKey: 'brutal',
    customPersona: '',
    pendingAttachment: null
};

const el = {
    messages: document.getElementById('messages'),
    input: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    loginOverlay: document.getElementById('login-overlay'),
    loginBtn: document.getElementById('login-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    chatList: document.getElementById('chat-list'),
    newChatBtn: document.getElementById('new-chat-btn'),
    chatWrapper: document.getElementById('chat-wrapper'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    exportBtn: document.getElementById('export-btn'),
    searchInput: document.getElementById('search-input'),
    attachBtn: document.getElementById('attach-btn'),
    fileInput: document.getElementById('file-input'),
    attachmentPreview: document.getElementById('attachment-preview'),
    importBtn: document.getElementById('import-btn'),
    importFileInput: document.getElementById('import-file-input'),
    personaBtn: document.getElementById('persona-btn'),
    personaLabel: document.getElementById('persona-label'),
};

// ─── Init ─────────────────────────────────────────────────────────────────────

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
        console.error('Initialization failed:', err);
    }
}

async function onReady() {
    el.loginOverlay.classList.add('hidden');
    el.sendBtn.disabled = false;
    await loadSettings();
    await loadChats();
    el.input.focus();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
    try {
        const modeKey = await puter.kv.get('brutal_mobile_mode_key');
        const customPersona = await puter.kv.get('brutal_mobile_custom_persona');
        if (modeKey && MODES[modeKey]) STATE.currentModeKey = modeKey;
        if (customPersona) STATE.customPersona = customPersona;
        updatePersonaLabel();
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

function getActivePersona() {
    if (STATE.currentModeKey === 'custom') return STATE.customPersona || MODES.brutal.persona;
    return MODES[STATE.currentModeKey]?.persona || MODES.brutal.persona;
}

function updatePersonaLabel() {
    el.personaLabel.textContent = MODES[STATE.currentModeKey]?.label || 'BRUTAL Mode';
}

// ─── Chat Storage ──────────────────────────────────────────────────────────────

async function loadChats() {
    try {
        let saved = await puter.kv.get('brutal_mobile_chats');
        let savedCurrentId = await puter.kv.get('brutal_mobile_current_chat_id');

        if (saved) {
            try {
                STATE.chats = typeof saved === 'string' ? JSON.parse(saved) : saved;
            } catch (e) { STATE.chats = {}; }
        }

        if (savedCurrentId && STATE.chats[savedCurrentId]) {
            STATE.currentChatId = String(savedCurrentId);
            renderSidebar();
            renderCurrentChat();
        } else {
            startNewChat();
        }
    } catch (err) {
        startNewChat();
    }
}

function saveChats() {
    puter.kv.set('brutal_mobile_chats', JSON.stringify(STATE.chats)).catch(console.error);
    if (STATE.currentChatId) puter.kv.set('brutal_mobile_current_chat_id', STATE.currentChatId).catch(console.error);
}

// ─── Chat Management ──────────────────────────────────────────────────────────

function startNewChat() {
    const id = Date.now().toString();
    STATE.currentChatId = id;
    STATE.chats[id] = { id, title: 'New Mobile Chat', messages: [{ role: 'system', content: getActivePersona() }] };
    saveChats();
    renderSidebar();
    renderCurrentChat();
}

function switchChat(id) {
    if (STATE.isThinking || STATE.currentChatId === id) return;
    STATE.currentChatId = id;
    saveChats();
    renderSidebar();
    renderCurrentChat();
    closeSidebar();
}

// ─── Sidebar Controls ─────────────────────────────────────────────────────────

function openSidebar() {
    el.sidebar.classList.add('mobile-open');
    el.sidebarOverlay.classList.add('visible');
}

function closeSidebar() {
    el.sidebar.classList.remove('mobile-open');
    el.sidebarOverlay.classList.remove('visible');
}

// ─── Sidebar Render ────────────────────────────────────────────────────────────

function renderSidebar() {
    el.chatList.innerHTML = '';
    const chats = Object.values(STATE.chats).sort((a, b) => b.id - a.id);
    
    for (const chat of chats) {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;
        div.innerText = chat.title;
        div.onclick = () => switchChat(chat.id);
        el.chatList.appendChild(div);
    }
}

// ─── Render Chat ───────────────────────────────────────────────────────────────

function renderCurrentChat() {
    el.messages.innerHTML = `<div class="system-notice"><p>Mobile Optimization Protocol Active.</p></div>`;
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat) return;
    chat.messages.forEach(m => { 
        if (m.role !== 'system') addMessage(m.role, typeof m.content === 'string' ? m.content : JSON.stringify(m.content)); 
    });
    scrollToBottom();
}

// ─── Send & Generate ──────────────────────────────────────────────────────────

async function sendMessage() {
    if (STATE.isThinking) return;
    const text = el.input.value.trim();
    if (!text && !STATE.pendingAttachment) return;
    const chat = STATE.chats[STATE.currentChatId];
    
    addMessage('user', text);
    el.input.value = '';
    adjustTextareaHeight();
    
    chat.messages.push({ role: 'user', content: text });
    if (chat.messages.length === 2) {
        chat.title = text.substring(0, 30);
        renderSidebar();
    }
    saveChats();
    await executeGeneration();
}

async function executeGeneration() {
    const chat = STATE.chats[STATE.currentChatId];
    STATE.isThinking = true;
    STATE.cancelStream = false;
    el.sendBtn.classList.add('hidden');
    el.stopBtn.classList.remove('hidden');

    const brutalMsgEl = addMessage('brutal', '...');
    const contentEl = brutalMsgEl.querySelector('.content');

    try {
        const payload = chat.messages.map(m => ({ role: m.role, content: m.content }));
        const stream = await puter.ai.chat(payload, { model: STATE.currentModel, stream: true });
        let fullReply = '';
        contentEl.innerHTML = '';
        for await (const part of stream) {
            if (STATE.cancelStream) break;
            if (part?.text) {
                fullReply += part.text;
                contentEl.innerHTML = marked.parse(fullReply);
                scrollToBottom();
            }
        }
        contentEl.querySelectorAll('pre code').forEach(hljs.highlightElement);
        chat.messages.push({ role: 'assistant', content: fullReply });
        saveChats();
    } catch (err) {
        console.error('Generation Error:', err);
        const errorMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        contentEl.innerHTML = `<span style="color:var(--brutal-red)">[ERROR: ${errorMsg}]</span>`;
    } finally {
        STATE.isThinking = false;
        el.sendBtn.classList.remove('hidden');
        el.stopBtn.classList.add('hidden');
        scrollToBottom();
    }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `
        <span class="label">${role === 'user' ? 'YOU' : 'BRUTAL'}</span>
        <div class="content">${role === 'user' ? text : marked.parse(text)}</div>`;
    if (role === 'brutal') div.querySelectorAll('pre code').forEach(hljs.highlightElement);
    el.messages.appendChild(div);
    scrollToBottom();
    return div;
}

function scrollToBottom() {
    const c = document.getElementById('chat-container');
    c.scrollTop = c.scrollHeight;
}

function adjustTextareaHeight() {
    el.input.style.height = 'auto';
    el.input.style.height = el.input.scrollHeight + 'px';
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

el.input.addEventListener('input', adjustTextareaHeight);
el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
el.sendBtn.addEventListener('click', sendMessage);
el.stopBtn.addEventListener('click', () => { STATE.cancelStream = true; });
el.sidebarToggle.addEventListener('click', openSidebar);
el.sidebarOverlay.addEventListener('click', closeSidebar);
el.newChatBtn.addEventListener('click', () => { startNewChat(); closeSidebar(); });
el.loginBtn.addEventListener('click', async () => {
    try { await puter.auth.signIn(); await onReady(); } catch (err) { alert('Login failed.'); }
});

init();
