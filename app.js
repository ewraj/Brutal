// BRUTAL Web App — v2.0

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
    recognition: null,
    isListening: false,
    cancelStream: false,
    currentModel: 'gemini-2.0-flash',
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
    restoreDraft();
    el.input.focus();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
    try {
        const modeKey = await puter.kv.get('brutal_mode_key');
        const customPersona = await puter.kv.get('brutal_custom_persona');
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
        let saved = await puter.kv.get('brutal_chats');
        let savedCurrentId = await puter.kv.get('brutal_current_chat_id');

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
                    if (STATE.chats[id].messages.length <= 1) delete STATE.chats[id];
                    if (!STATE.chats[id]) continue;
                    if (STATE.chats[id].pinned === undefined) STATE.chats[id].pinned = false;
                }
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
    puter.kv.set('brutal_chats', JSON.stringify(STATE.chats)).catch(console.error);
    if (STATE.currentChatId) puter.kv.set('brutal_current_chat_id', STATE.currentChatId).catch(console.error);
}

// ─── Chat Management ──────────────────────────────────────────────────────────

function startNewChat() {
    if (STATE.currentChatId && STATE.chats[STATE.currentChatId]?.messages.length <= 1) return;
    const id = Date.now().toString();
    STATE.currentChatId = id;
    STATE.chats[id] = { id, title: 'New Chat', pinned: false, messages: [{ role: 'system', content: getActivePersona() }] };
    saveChats();
    renderSidebar();
    renderCurrentChat();
}

function switchChat(id) {
    if (STATE.isThinking || STATE.currentChatId === id) return;
    if (STATE.currentChatId && STATE.chats[STATE.currentChatId]?.messages.length <= 1) delete STATE.chats[STATE.currentChatId];
    STATE.currentChatId = id;
    saveChats();
    renderSidebar();
    renderCurrentChat();
    if (window.innerWidth <= 768) closeMobileSidebar();
}

function togglePin(id, e) {
    e.stopPropagation();
    if (!STATE.chats[id]) return;
    STATE.chats[id].pinned = !STATE.chats[id].pinned;
    saveChats();
    renderSidebar();
}

function deleteChat(id) {
    delete STATE.chats[id];
    saveChats();
    if (STATE.currentChatId === id) {
        STATE.currentChatId = null;
        const remaining = Object.values(STATE.chats).sort((a, b) => b.id - a.id);
        remaining.length > 0 ? switchChat(remaining[0].id) : startNewChat();
    } else {
        renderSidebar();
    }
}

// ─── Sidebar Render ────────────────────────────────────────────────────────────

function renderSidebar() {
    el.chatList.innerHTML = '';
    const query = STATE.searchQuery.toLowerCase().trim();
    let chats = Object.values(STATE.chats).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.id - a.id;
    });
    if (query) {
        chats = chats.filter(c =>
            c.title.toLowerCase().includes(query) ||
            c.messages.some(m => m.role !== 'system' && typeof m.content === 'string' && m.content.toLowerCase().includes(query))
        );
    }
    if (!chats.length && query) {
        const e = document.createElement('div');
        e.className = 'chat-empty';
        e.textContent = 'No chats match your search.';
        el.chatList.appendChild(e);
        return;
    }
    for (const chat of chats) {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.innerText = chat.title;

        const actions = document.createElement('div');
        actions.className = 'chat-actions';

        const pinBtn = document.createElement('button');
        pinBtn.className = `pin-chat-btn ${chat.pinned ? 'pinned' : ''}`;
        pinBtn.title = chat.pinned ? 'Unpin' : 'Pin';
        pinBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="${chat.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
        pinBtn.onclick = (e) => togglePin(chat.id, e);

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-chat-btn';
        editBtn.title = 'Edit';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
        editBtn.onclick = (e) => { e.stopPropagation(); if (!STATE.isThinking) openEditModal(chat.id); };

        actions.appendChild(pinBtn);
        actions.appendChild(editBtn);
        div.appendChild(titleSpan);
        div.appendChild(actions);
        div.onclick = () => switchChat(chat.id);
        el.chatList.appendChild(div);
    }
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function openEditModal(id) {
    const chat = STATE.chats[id];
    if (!chat) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const card = document.createElement('div');
    card.className = 'modal-card';
    const titleEl = document.createElement('h3');
    titleEl.innerText = 'Edit Chat';
    titleEl.style.marginBottom = '1rem';
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'modal-input'; input.value = chat.title;
    const btnRow = document.createElement('div');
    btnRow.className = 'modal-btn-row';
    const save = document.createElement('button');
    save.className = 'modal-btn primary'; save.innerText = 'Rename';
    save.onclick = () => { const t = input.value.trim(); if (t) { chat.title = t; saveChats(); renderSidebar(); } document.body.removeChild(overlay); };
    const del = document.createElement('button');
    del.className = 'modal-btn danger'; del.innerText = 'Delete';
    del.onclick = () => { if (confirm('Delete this chat?')) { deleteChat(id); document.body.removeChild(overlay); } };
    const cancel = document.createElement('button');
    cancel.className = 'modal-btn'; cancel.innerText = 'Cancel';
    cancel.onclick = () => document.body.removeChild(overlay);
    btnRow.appendChild(del); btnRow.appendChild(cancel); btnRow.appendChild(save);
    card.appendChild(titleEl); card.appendChild(input); card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    input.focus(); input.select();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); if (e.key === 'Escape') cancel.click(); });
}

function openPersonaModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const card = document.createElement('div');
    card.className = 'modal-card persona-card';
    card.innerHTML = `
        <h3 style="margin-bottom:1.25rem">Persona / Modes</h3>
        <div class="mode-grid" id="mode-grid"></div>
        <div id="custom-area" class="hidden" style="margin-top:1rem">
            <label style="font-size:0.8rem;color:var(--text-secondary);display:block;margin-bottom:0.5rem">Custom Persona Prompt</label>
            <textarea id="custom-persona-input" class="modal-input" rows="5" placeholder="Describe the persona you want...">${STATE.customPersona}</textarea>
        </div>
        <div class="modal-btn-row" style="margin-top:1.25rem">
            <button class="modal-btn" id="pm-cancel">Cancel</button>
            <button class="modal-btn primary" id="pm-save">Apply</button>
        </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    let selected = STATE.currentModeKey;
    const grid = card.querySelector('#mode-grid');
    const customArea = card.querySelector('#custom-area');
    function render() {
        grid.innerHTML = '';
        for (const [key, mode] of Object.entries(MODES)) {
            const btn = document.createElement('button');
            btn.className = `mode-btn ${key === selected ? 'active' : ''}`;
            btn.textContent = mode.label;
            btn.onclick = () => { selected = key; render(); key === 'custom' ? customArea.classList.remove('hidden') : customArea.classList.add('hidden'); };
            grid.appendChild(btn);
        }
        selected === 'custom' ? customArea.classList.remove('hidden') : customArea.classList.add('hidden');
    }
    render();
    card.querySelector('#pm-cancel').onclick = () => document.body.removeChild(overlay);
    card.querySelector('#pm-save').onclick = async () => {
        STATE.currentModeKey = selected;
        if (selected === 'custom') {
            STATE.customPersona = card.querySelector('#custom-persona-input').value.trim();
            await puter.kv.set('brutal_custom_persona', STATE.customPersona).catch(console.error);
        }
        await puter.kv.set('brutal_mode_key', STATE.currentModeKey).catch(console.error);
        updatePersonaLabel();
        if (STATE.currentChatId) {
            const chat = STATE.chats[STATE.currentChatId];
            if (chat && chat.messages.length <= 1) { chat.messages[0].content = getActivePersona(); saveChats(); }
        }
        document.body.removeChild(overlay);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
}

// ─── Render Chat ───────────────────────────────────────────────────────────────

function renderCurrentChat() {
    el.messages.innerHTML = `<div class="system-notice"><p>System Initialized. No sycophancy. No filler. Just optimization.</p></div>`;
    const chat = STATE.chats[STATE.currentChatId];
    chat.messages.length <= 1 ? el.chatWrapper.classList.add('initial-state') : el.chatWrapper.classList.remove('initial-state');
    chat.messages.forEach(m => { if (m.role !== 'system') addMessage(m.role, m.content); });
    addRegenerateButton();
    scrollToBottom();
}

// ─── Send & Generate ──────────────────────────────────────────────────────────

async function sendMessage() {
    if (STATE.isListening && STATE.recognition) STATE.recognition.stop();
    if (STATE.isThinking) return;
    const text = el.input.value.trim();
    const hasAttachment = !!STATE.pendingAttachment;
    if (!text && !hasAttachment) return;
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat) return;

    let userContent;
    let displayText = text;

    if (hasAttachment) {
        const att = STATE.pendingAttachment;
        if (att.type === 'image') {
            userContent = [...(text ? [{ type: 'text', text }] : []), { type: 'image_url', image_url: { url: att.dataUrl } }];
            displayText = text ? `${text}\n\n📎 ${att.name}` : `📎 ${att.name}`;
        } else {
            userContent = `[File: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`\n\n${text}`.trim();
            displayText = userContent;
        }
        clearAttachment();
    } else {
        userContent = text;
    }

    addMessage('user', displayText);
    el.input.value = '';
    localStorage.removeItem('brutal_draft');
    adjustTextareaHeight();
    chat.messages.push({ role: 'user', content: userContent });
    el.chatWrapper.classList.remove('initial-state');
    if (chat.messages.length === 2) {
        chat.title = (text || 'Chat').substring(0, 40) + (text.length > 40 ? '...' : '');
        renderSidebar();
    }
    saveChats();
    await executeGeneration({ isRegeneration: false });
}

async function regenerateLastResponse() {
    if (STATE.isThinking) return;
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat || chat.messages.length < 2) return;
    if (chat.messages[chat.messages.length - 1].role !== 'assistant') return;
    chat.messages.pop();
    const last = Array.from(el.messages.children).findLast(e => e.classList.contains('message'));
    if (last?.classList.contains('brutal')) last.remove();
    await executeGeneration({ isRegeneration: true });
}

async function executeGeneration({ isRegeneration = false } = {}) {
    const chat = STATE.chats[STATE.currentChatId];
    STATE.isThinking = true;
    STATE.cancelStream = false;
    el.sendBtn.disabled = true;
    el.sendBtn.classList.add('hidden');
    el.stopBtn.classList.remove('hidden');
    document.querySelectorAll('.regenerate-btn-wrapper').forEach(e => e.remove());

    const brutalMsgEl = addMessage('brutal', '...');
    const contentEl = brutalMsgEl.querySelector('.content');
    const tokenEl = brutalMsgEl.querySelector('.token-count');

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
                scrollToBottom(false);
            }
        }
        contentEl.querySelectorAll('pre code').forEach(hljs.highlightElement);
        injectCopyButtons(contentEl);
        const tokens = Math.ceil(fullReply.length / 4);
        if (tokenEl) tokenEl.textContent = `~${tokens.toLocaleString()} tokens`;
        chat.messages.push({ role: 'assistant', content: fullReply });
        saveChats();
    } catch (err) {
        contentEl.innerHTML = `<span style="color:var(--brutal-red)">[ERROR: ${err.message}]</span>`;
        if (!isRegeneration && chat.messages[chat.messages.length - 1]?.role === 'user') {
            const failed = chat.messages.pop();
            saveChats();
            if (!el.input.value.trim()) {
                el.input.value = typeof failed.content === 'string' ? failed.content : '';
                adjustTextareaHeight();
            }
        }
    } finally {
        STATE.isThinking = false;
        el.sendBtn.disabled = false;
        el.sendBtn.classList.remove('hidden');
        el.stopBtn.classList.add('hidden');
        STATE.cancelStream = false;
        addRegenerateButton();
        scrollToBottom();
    }
}

// ─── Copy Buttons ─────────────────────────────────────────────────────────────

function injectCopyButtons(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.copy-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.onclick = () => {
            const code = pre.querySelector('code')?.textContent || '';
            navigator.clipboard.writeText(code).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
        };
        pre.style.position = 'relative';
        pre.appendChild(btn);
    });
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function addRegenerateButton() {
    document.querySelectorAll('.regenerate-btn-wrapper').forEach(e => e.remove());
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat || STATE.isThinking) return;
    const lastMsg = chat.messages[chat.messages.length - 1];
    const lastBubble = Array.from(el.messages.children).findLast(e => e.classList.contains('message'));
    if (lastMsg?.role === 'assistant' && lastBubble) {
        const wrapper = document.createElement('div');
        wrapper.className = 'regenerate-btn-wrapper';
        const btn = document.createElement('button');
        btn.className = 'regenerate-btn';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg><span>Regenerate</span>`;
        btn.onclick = regenerateLastResponse;
        wrapper.appendChild(btn);
        lastBubble.appendChild(wrapper);
    }
}

function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const isUser = role === 'user';
    div.innerHTML = `
        <span class="label">${isUser ? 'YOU' : 'BRUTAL'}</span>
        <div class="content"></div>
        ${!isUser ? '<div class="token-count"></div>' : ''}`;
    const contentDiv = div.querySelector('.content');
    if (isUser) {
        contentDiv.textContent = typeof text === 'string' ? text : JSON.stringify(text);
    } else {
        const t = typeof text === 'string' ? text : '';
        contentDiv.innerHTML = marked.parse(t);
        div.querySelectorAll('pre code').forEach(hljs.highlightElement);
        injectCopyButtons(contentDiv);
    }
    el.messages.appendChild(div);
    scrollToBottom();
    return div;
}

function scrollToBottom(force = true) {
    const c = document.getElementById('chat-container');
    if (!force && c.scrollHeight - c.scrollTop - c.clientHeight > 150) return;
    c.scrollTop = c.scrollHeight;
}

function adjustTextareaHeight() {
    el.input.style.height = 'auto';
    el.input.style.height = el.input.scrollHeight + 'px';
}

// ─── Draft ────────────────────────────────────────────────────────────────────

function saveDraft() {
    const t = el.input.value;
    t.trim() ? localStorage.setItem('brutal_draft', t) : localStorage.removeItem('brutal_draft');
}

function restoreDraft() {
    const d = localStorage.getItem('brutal_draft');
    if (d) { el.input.value = d; adjustTextareaHeight(); }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

function handleFileSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
        reader.onload = (e) => { STATE.pendingAttachment = { type: 'image', name: file.name, dataUrl: e.target.result }; showAttachmentPreview(); };
        reader.readAsDataURL(file);
    } else {
        reader.onload = (e) => { STATE.pendingAttachment = { type: 'text', name: file.name, content: e.target.result }; showAttachmentPreview(); };
        reader.readAsText(file);
    }
}

function showAttachmentPreview() {
    const att = STATE.pendingAttachment;
    if (!att) return;
    el.attachmentPreview.classList.remove('hidden');
    el.attachmentPreview.innerHTML = att.type === 'image'
        ? `<div class="attachment-item"><img src="${att.dataUrl}" class="attachment-thumb" alt="${att.name}"><span class="attachment-name">${att.name}</span><button class="attachment-remove" onclick="clearAttachment()">×</button></div>`
        : `<div class="attachment-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg><span class="attachment-name">${att.name}</span><button class="attachment-remove" onclick="clearAttachment()">×</button></div>`;
}

function clearAttachment() {
    STATE.pendingAttachment = null;
    el.attachmentPreview.classList.add('hidden');
    el.attachmentPreview.innerHTML = '';
    el.fileInput.value = '';
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportToObsidian() {
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat) return;
    const msgs = chat.messages.filter(m => m.role !== 'system');
    if (!msgs.length) { alert('Nothing to export — start a conversation first.'); return; }
    const date = new Date().toISOString().split('T')[0];
    const title = chat.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'BRUTAL Chat';
    let md = `---\ntitle: ${title}\ndate: ${date}\nmodel: ${STATE.currentModel}\nmode: ${MODES[STATE.currentModeKey]?.label || 'BRUTAL'}\ntags: [brutal, ai, chat]\n---\n\n# ${title}\n\n`;
    for (const m of msgs) {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        md += `## ${m.role === 'user' ? 'You' : 'BRUTAL'}\n\n${content}\n\n`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md.trim()], { type: 'text/markdown;charset=utf-8' }));
    a.download = `${title} ${date}.md`;
    a.click();
}

// ─── Import ───────────────────────────────────────────────────────────────────

function importFromMarkdown(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const messages = [{ role: 'system', content: getActivePersona() }];
        const titleMatch = text.match(/^title:\s*(.+)$/m);
        let title = titleMatch ? titleMatch[1].trim() : file.name.replace('.md', '');
        const parts = text.split(/^##\s+(You|BRUTAL)\s*$/m);
        for (let i = 1; i < parts.length; i += 2) {
            const role = parts[i] === 'You' ? 'user' : 'assistant';
            const content = parts[i + 1]?.trim() || '';
            if (content) messages.push({ role, content });
        }
        if (messages.length <= 1) { alert('Could not parse this file. Make sure it was exported from BRUTAL.'); return; }
        const id = Date.now().toString();
        STATE.chats[id] = { id, title, pinned: false, messages };
        STATE.currentChatId = id;
        saveChats();
        renderSidebar();
        renderCurrentChat();
        if (window.innerWidth <= 768) closeMobileSidebar();
    };
    reader.readAsText(file);
}

// ─── Mobile Sidebar ───────────────────────────────────────────────────────────

function openMobileSidebar() {
    el.sidebar.classList.add('mobile-open');
    el.sidebarOverlay.classList.add('visible');
}

function closeMobileSidebar() {
    el.sidebar.classList.remove('mobile-open');
    el.sidebarOverlay.classList.remove('visible');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

el.input.addEventListener('input', () => { adjustTextareaHeight(); saveDraft(); });

el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        if (window.innerWidth <= 768) return;
        e.preventDefault();
        sendMessage();
    }
});

el.sendBtn.addEventListener('click', sendMessage);
el.stopBtn.addEventListener('click', () => { if (STATE.isThinking) STATE.cancelStream = true; });

el.sidebarToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        el.sidebar.classList.remove('collapsed'); // clear any desktop-collapsed state
        el.sidebar.classList.contains('mobile-open') ? closeMobileSidebar() : openMobileSidebar();
    } else {
        el.sidebar.classList.toggle('collapsed');
    }
});

el.sidebarOverlay.addEventListener('click', closeMobileSidebar);
el.exportBtn.addEventListener('click', exportToObsidian);
el.personaBtn.addEventListener('click', openPersonaModal);

el.searchInput.addEventListener('input', () => { STATE.searchQuery = el.searchInput.value; renderSidebar(); });
el.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { el.searchInput.value = ''; STATE.searchQuery = ''; renderSidebar(); } });


el.attachBtn.addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => { if (el.fileInput.files[0]) handleFileSelect(el.fileInput.files[0]); });

// Drag-and-drop on input
const inputWrapper = document.querySelector('.input-wrapper');
inputWrapper.addEventListener('dragover', (e) => { e.preventDefault(); inputWrapper.classList.add('drag-over'); });
inputWrapper.addEventListener('dragleave', () => inputWrapper.classList.remove('drag-over'));
inputWrapper.addEventListener('drop', (e) => { e.preventDefault(); inputWrapper.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); });

el.importBtn.addEventListener('click', () => el.importFileInput.click());
el.importFileInput.addEventListener('change', () => { if (el.importFileInput.files[0]) importFromMarkdown(el.importFileInput.files[0]); });

el.newChatBtn.addEventListener('click', () => {
    if (!STATE.isThinking) { startNewChat(); if (window.innerWidth <= 768) closeMobileSidebar(); el.input.focus(); }
});

el.loginBtn.addEventListener('click', async () => {
    try { await puter.auth.signIn(); await onReady(); } catch (err) { alert('Login failed. Please try again.'); }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'k') { e.preventDefault(); if (!STATE.isThinking) { startNewChat(); el.input.focus(); } }
    if (mod && e.key === 'e') { e.preventDefault(); exportToObsidian(); }
    if (e.key === 'Escape' && window.innerWidth <= 768) closeMobileSidebar();
});

window.addEventListener('beforeunload', (e) => { if (STATE.isThinking) { e.preventDefault(); e.returnValue = ''; } });

init();