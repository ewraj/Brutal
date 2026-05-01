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
    particleCanvas: document.getElementById('particle-canvas'),
};

// ─── Particle Sphere Engine ───────────────────────────────────────────────────

const ParticleSphere = (() => {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let width, height, cx, cy;
    let animId = null;
    let time = 0;
    let exploding = false;
    let explodeTime = 0;
    const particles = [];
    const N = 1000;
    const R = 360; // Increased size as requested
    const bloodRed = '220, 38, 38';
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    let mouseX = 0, mouseY = 0;
    let targetRotX = 0, targetRotY = 0, rotX = 0, rotY = 0;
    let resizeObserver = null;

    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) - width / 2) / (width / 2);
        mouseY = ((e.clientY - rect.top) - height / 2) / (height / 2);
        // Inverted signs so it rotates TOWARDS the mouse instead of away
        targetRotY = -mouseX * 0.8;
        targetRotX = mouseY * 0.8;
    }

    function resize() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Use exact pixel dimensions to prevent oval stretching
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        ctx.scale(dpr, dpr);
        width = rect.width;
        height = rect.height;
        cx = width / 2;
        cy = height / 2;
    }

    function generate() {
        particles.length = 0;
        for (let i = 0; i < N; i++) {
            let phi = Math.acos(1 - 2 * (i + 0.5) / N);
            let theta = 2 * Math.PI * i / goldenRatio;
            let x = Math.cos(theta) * Math.sin(phi);
            let y = Math.sin(theta) * Math.sin(phi);
            let z = Math.cos(phi);
            let theta2 = theta + 0.03;
            let x2 = Math.cos(theta2) * Math.sin(phi);
            let y2 = Math.sin(theta2) * Math.sin(phi);
            let z2 = Math.cos(phi);
            particles.push({
                bx: x, by: y, bz: z,
                bx2: x2, by2: y2, bz2: z2,
                wo: Math.random() * Math.PI * 2,
                // Explosion velocity (set on explode)
                evx: 0, evy: 0, ex: 0, ey: 0, eo: 1
            });
        }
    }

    function rot3D(x, y, z, rx, ry) {
        let cy_ = Math.cos(rx), sy = Math.sin(rx);
        let y1 = y * cy_ - z * sy, z1 = y * sy + z * cy_;
        let cx_ = Math.cos(ry), sx = Math.sin(ry);
        return { x: x * cx_ + z1 * sx, y: y1, z: -x * sx + z1 * cx_ };
    }

    function draw() {
        animId = requestAnimationFrame(draw);
        time++;
        ctx.clearRect(0, 0, width, height);

        if (exploding) {
            explodeTime++;
            // Draw exploding particles
            let allGone = true;
            for (let p of particles) {
                p.ex += p.evx;
                p.ey += p.evy;
                p.eo -= 0.015;
                if (p.eo > 0) {
                    allGone = false;
                    ctx.beginPath();
                    ctx.arc(p.ex, p.ey, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${bloodRed}, ${Math.max(0, p.eo)})`;
                    ctx.fill();
                }
            }
            if (allGone || explodeTime > 120) {
                destroy();
            }
            return;
        }

        rotX += (targetRotX - rotX) * 0.04;
        rotY += (targetRotY - rotY) * 0.04;
        let autoRotY = rotY + time * 0.0015;

        let projected = [];
        const fl = 700;

        for (let p of particles) {
            let cr = R + Math.sin(time * 0.04 + p.wo) * 12;
            let r1 = rot3D(p.bx * cr, p.by * cr, p.bz * cr, rotX, autoRotY);
            let r2 = rot3D(p.bx2 * cr, p.by2 * cr, p.bz2 * cr, rotX, autoRotY);
            projected.push({ x1: r1.x, y1: r1.y, x2: r2.x, y2: r2.y, z: r1.z });
        }

        projected.sort((a, b) => b.z - a.z);

        for (let p of projected) {
            if (p.z < -fl) continue;
            let s = fl / (fl + p.z);
            let sx1 = cx + p.x1 * s, sy1 = cy + p.y1 * s;
            let sx2 = cx + p.x2 * s, sy2 = cy + p.y2 * s;
            let depth = (p.z + R) / (2 * R);
            let opacity = Math.max(0, depth) * 0.8;
            if (opacity < 0.03) continue;
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.lineWidth = 1.5 * s;
            ctx.strokeStyle = `rgba(${bloodRed}, ${opacity})`;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    function init() {
        if (animId) return; // already running
        exploding = false;
        explodeTime = 0;
        resize();
        generate();
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', resize);
        
        // Ensure flexbox container changes don't warp aspect ratio
        if (!resizeObserver && canvas.parentElement) {
            resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(canvas.parentElement);
        }
        
        draw();
    }

    function explode() {
        if (!animId || exploding) return;
        exploding = true;
        explodeTime = 0;
        const fl = 700;
        let autoRotY = rotY + time * 0.0015;
        // Snapshot current screen positions and give them outward velocity
        for (let p of particles) {
            let cr = R + Math.sin(time * 0.04 + p.wo) * 12;
            let r1 = rot3D(p.bx * cr, p.by * cr, p.bz * cr, rotX, autoRotY);
            let s = fl / (fl + r1.z);
            p.ex = cx + r1.x * s;
            p.ey = cy + r1.y * s;
            // Velocity: outward from center + some randomness
            let dx = p.ex - cx, dy = p.ey - cy;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let speed = 4 + Math.random() * 6;
            p.evx = (dx / dist) * speed + (Math.random() - 0.5) * 2;
            p.evy = (dy / dist) * speed + (Math.random() - 0.5) * 2;
            p.eo = 0.8 + Math.random() * 0.2;
        }
    }

    function destroy() {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
        exploding = false;
        canvas.style.display = 'none';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', resize);
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    }

    return { init, explode, destroy };
})();

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
    // Start with sidebar hidden for a clean, tool-first experience
    if (window.innerWidth > 768) el.sidebar.classList.add('collapsed');
    await loadSettings();
    await loadChats();
    restoreDraft();
    el.input.focus();
    // Start particles if we're on a new/empty chat
    if (el.chatWrapper.classList.contains('initial-state')) {
        ParticleSphere.init();
    }
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
    if (chat.messages.length <= 1) {
        el.chatWrapper.classList.add('initial-state');
        ParticleSphere.init();
    } else {
        el.chatWrapper.classList.remove('initial-state');
        ParticleSphere.destroy();
    }
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
    ParticleSphere.explode();
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
        const stream = await puter.ai.chat(payload, false, { model: STATE.currentModel, stream: true });
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

// ─── Workflow System ──────────────────────────────────────────────────────────

// API key hook for future use (e.g., direct Gemini API instead of Puter)
// Set STATE.apiKey to a valid key and STATE.useDirectApi to true to bypass Puter
// STATE.apiKey = null;
// STATE.useDirectApi = false;

const WORKFLOW_PROMPTS = {
    teardown: {
        title: 'Tear Apart',
        desc: 'Paste your code below. Brutal will run a full multi-pass analysis.',
        steps: ['Scanning for bugs...', 'Checking architecture...', 'Evaluating style...', 'Generating verdict...'],
        prompt: (code) => `You are BRUTAL, an automated code analysis engine. Perform a FULL multi-pass review of this code. Analyze for: bugs, anti-patterns, architecture flaws, readability issues, and style violations.

You MUST respond with ONLY valid JSON. No markdown, no commentary, no wrapping. Just the raw JSON object.

The JSON schema:
{
  "scores": {
    "correctness": <0-10>,
    "architecture": <0-10>,
    "readability": <0-10>,
    "style": <0-10>
  },
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "bug" | "architecture" | "performance" | "readability" | "style" | "logic",
      "line": "<line number or range, or 'general'>",
      "description": "<clear, direct explanation of the issue>",
      "fix": "<corrected code snippet, or empty string if not applicable>"
    }
  ],
  "summary": "<2-3 sentence brutal overall verdict>"
}

CODE TO ANALYZE:
\`\`\`
${code}
\`\`\``
    },
    security: {
        title: 'Security Audit',
        desc: 'Paste your code. Brutal will hunt for vulnerabilities and data leaks.',
        steps: ['Scanning attack surface...', 'Checking injection vectors...', 'Analyzing data flow...', 'Compiling report...'],
        prompt: (code) => `You are BRUTAL, an automated security analysis engine. Perform a thorough security audit of this code. Look for: injection vulnerabilities (SQL, XSS, command), authentication flaws, data exposure, insecure dependencies, race conditions, and any OWASP Top 10 issues.

You MUST respond with ONLY valid JSON. No markdown, no commentary, no wrapping. Just the raw JSON object.

The JSON schema:
{
  "scores": {
    "overall_security": <0-10>,
    "input_validation": <0-10>,
    "data_protection": <0-10>,
    "auth_authz": <0-10>
  },
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "injection" | "auth" | "data_exposure" | "configuration" | "crypto" | "logic" | "dependency",
      "line": "<line number or range, or 'general'>",
      "description": "<clear explanation of the vulnerability and its impact>",
      "fix": "<corrected code snippet, or empty string if not applicable>"
    }
  ],
  "summary": "<2-3 sentence brutal security verdict>"
}

CODE TO AUDIT:
\`\`\`
${code}
\`\`\``
    },
    optimize: {
        title: 'Optimize',
        desc: 'Paste your code. Brutal will find every performance bottleneck.',
        steps: ['Profiling complexity...', 'Analyzing memory usage...', 'Checking hot paths...', 'Generating optimizations...'],
        prompt: (code) => `You are BRUTAL, an automated performance optimization engine. Analyze this code for: time complexity issues, memory leaks, unnecessary allocations, redundant operations, cache misses, and algorithmic improvements.

You MUST respond with ONLY valid JSON. No markdown, no commentary, no wrapping. Just the raw JSON object.

The JSON schema:
{
  "scores": {
    "time_complexity": <0-10>,
    "memory_efficiency": <0-10>,
    "algorithmic_quality": <0-10>,
    "scalability": <0-10>
  },
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "complexity" | "memory" | "redundancy" | "algorithm" | "io" | "caching",
      "line": "<line number or range, or 'general'>",
      "description": "<clear explanation of the bottleneck and its impact>",
      "fix": "<optimized code snippet, or empty string if not applicable>"
    }
  ],
  "summary": "<2-3 sentence brutal performance verdict>"
}

CODE TO OPTIMIZE:
\`\`\`
${code}
\`\`\``
    }
};

let activeWorkflowType = null;

function openWorkflowModal(type) {
    const wf = WORKFLOW_PROMPTS[type];
    if (!wf) return;
    activeWorkflowType = type;
    const modal = document.getElementById('workflow-modal');
    document.getElementById('workflow-modal-title').textContent = wf.title;
    document.getElementById('workflow-modal-desc').textContent = wf.desc;
    document.getElementById('workflow-code-input').value = '';
    modal.classList.remove('hidden');
    document.getElementById('workflow-code-input').focus();
}

function closeWorkflowModal() {
    document.getElementById('workflow-modal').classList.add('hidden');
    activeWorkflowType = null;
}

async function runWorkflow() {
    if (!activeWorkflowType || STATE.isThinking) return;
    const code = document.getElementById('workflow-code-input').value.trim();
    if (!code) return;
    const wf = WORKFLOW_PROMPTS[activeWorkflowType];
    const workflowType = activeWorkflowType;

    closeWorkflowModal();

    // Start a new chat for this workflow
    const id = Date.now().toString();
    STATE.currentChatId = id;
    STATE.chats[id] = {
        id,
        title: `${wf.title}: ${code.substring(0, 30).replace(/\n/g, ' ')}...`,
        pinned: false,
        messages: [{ role: 'system', content: getActivePersona() }],
        isWorkflow: true,
        workflowType,
        workflowCode: code
    };
    saveChats();
    renderSidebar();

    // Show the user's code as a message
    const displayCode = `[${wf.title} Workflow]\n\`\`\`\n${code}\n\`\`\``;
    addMessage('user', displayCode);
    STATE.chats[id].messages.push({ role: 'user', content: displayCode });
    el.chatWrapper.classList.remove('initial-state');

    // Show loading state
    STATE.isThinking = true;
    el.sendBtn.disabled = true;
    el.sendBtn.classList.add('hidden');
    el.stopBtn.classList.remove('hidden');
    STATE.cancelStream = false;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message brutal';
    loadingDiv.innerHTML = `
        <span class="label">BRUTAL</span>
        <div class="content">
            <div class="workflow-loading">
                <div class="workflow-loading-spinner"></div>
                <div class="workflow-loading-text">Running ${wf.title} pipeline...</div>
                <div class="workflow-loading-step" id="wf-step">${wf.steps[0]}</div>
            </div>
        </div>`;
    el.messages.appendChild(loadingDiv);
    scrollToBottom();

    // Animate through steps
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
        stepIndex = (stepIndex + 1) % wf.steps.length;
        const stepEl = document.getElementById('wf-step');
        if (stepEl) stepEl.textContent = wf.steps[stepIndex];
    }, 2000);

    try {
        const prompt = wf.prompt(code);
        const payload = [
            { role: 'system', content: 'You are a code analysis engine. You MUST respond with ONLY valid JSON. No markdown fences, no explanatory text, no ``` wrappers. Output the raw JSON object directly.' },
            { role: 'user', content: prompt }
        ];

        let fullReply = '';

        // Use non-streaming for workflows (we need the complete JSON)
        const resp = await puter.ai.chat(payload, false, { model: STATE.currentModel });
        fullReply = typeof resp === 'string' ? resp : (resp?.message?.content ?? resp?.text ?? JSON.stringify(resp));

        clearInterval(stepInterval);

        if (STATE.cancelStream) {
            loadingDiv.remove();
            return;
        }

        // Parse the JSON response
        const parsed = parseWorkflowResponse(fullReply);
        loadingDiv.remove();

        if (parsed) {
            const resultDiv = renderWorkflowResults(parsed, workflowType);
            el.messages.appendChild(resultDiv);
            STATE.chats[id].messages.push({ role: 'assistant', content: fullReply });
            STATE.chats[id].workflowData = parsed;
        } else {
            // Fallback: render as regular markdown if JSON parsing fails
            const fallbackDiv = addMessage('brutal', fullReply);
            STATE.chats[id].messages.push({ role: 'assistant', content: fullReply });
        }

        saveChats();

    } catch (err) {
        clearInterval(stepInterval);
        loadingDiv.remove();
        addMessage('brutal', `[WORKFLOW ERROR: ${err.message}]`);
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

function parseWorkflowResponse(raw) {
    try {
        // Strip markdown fences if the model added them anyway
        let cleaned = raw.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        const data = JSON.parse(cleaned);
        if (data.scores && data.issues) return data;
        return null;
    } catch (e) {
        // Try to extract JSON from mixed text
        const jsonMatch = raw.match(/\{[\s\S]*"scores"[\s\S]*"issues"[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {}
        }
        console.error('Failed to parse workflow response:', e);
        return null;
    }
}

function renderWorkflowResults(data, workflowType) {
    const wf = WORKFLOW_PROMPTS[workflowType];
    const div = document.createElement('div');
    div.className = 'message brutal';

    // Build scores HTML
    let scoresHtml = '';
    if (data.scores) {
        const entries = Object.entries(data.scores);
        scoresHtml = `<div class="workflow-scores">${entries.map(([key, val]) => {
            const scoreClass = val >= 7 ? 'score-high' : val >= 4 ? 'score-mid' : 'score-low';
            const label = key.replace(/_/g, ' ');
            return `<div class="workflow-score ${scoreClass}">
                <span class="workflow-score-value">${val}</span>
                <span class="workflow-score-label">${label}</span>
            </div>`;
        }).join('')}</div>`;
    }

    // Build issues HTML
    let issuesHtml = '';
    if (data.issues && data.issues.length > 0) {
        issuesHtml = `<div class="workflow-issues">${data.issues.map((issue, i) => {
            const sev = (issue.severity || 'info').toLowerCase();
            const fixId = `wf-fix-${Date.now()}-${i}`;
            const fixBlock = issue.fix ? `
                <div class="issue-fix">
                    <div class="issue-fix-header">
                        <span class="issue-fix-label">Suggested Fix</span>
                        <button class="issue-fix-copy" onclick="copyWorkflowFix('${fixId}')">Copy</button>
                    </div>
                    <pre><code id="${fixId}">${escapeHtml(issue.fix)}</code></pre>
                </div>` : '';
            return `
                <div class="workflow-issue severity-${sev}">
                    <div class="issue-header">
                        <span class="issue-severity">${sev}</span>
                        ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ''}
                        ${issue.category ? `<span class="issue-category">${issue.category}</span>` : ''}
                    </div>
                    <div class="issue-description">${escapeHtml(issue.description)}</div>
                    ${fixBlock}
                </div>`;
        }).join('')}</div>`;
    } else {
        issuesHtml = `<div class="workflow-issue severity-info"><div class="issue-description">No issues found. The code passed all checks.</div></div>`;
    }

    // Build summary
    const summaryHtml = data.summary
        ? `<div class="workflow-summary">${marked.parse(data.summary)}</div>`
        : '';

    div.innerHTML = `
        <span class="label">BRUTAL</span>
        <div class="content">
            <div class="workflow-results">
                <div class="workflow-results-header">
                    <span class="workflow-results-title">${wf.title} — Results</span>
                    ${scoresHtml}
                </div>
                ${issuesHtml}
                ${summaryHtml}
                <div style="margin-top:1rem; display:flex; justify-content:center;">
                    <button class="modal-btn primary annotate-btn" onclick="openAnnotator()">View in Annotator</button>
                </div>
            </div>
        </div>
        <div class="token-count"></div>`;

    // Highlight code in fix blocks
    div.querySelectorAll('pre code').forEach(hljs.highlightElement);

    return div;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function copyWorkflowFix(id) {
    const el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = el.closest('.issue-fix').querySelector('.issue-fix-copy');
        if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        }
    });
}

// ─── Code Annotator ───────────────────────────────────────────────────────────

function openAnnotator() {
    const chat = STATE.chats[STATE.currentChatId];
    if (!chat || !chat.workflowData || !chat.workflowCode) return;
    const wf = WORKFLOW_PROMPTS[chat.workflowType];
    const code = chat.workflowCode;
    const issues = chat.workflowData.issues || [];
    const lines = code.split('\n');

    // Build a map of line number -> issues
    const lineIssueMap = {};
    issues.forEach((issue, idx) => {
        const lineStr = String(issue.line || 'general').trim();
        // Handle ranges like "3-5" and single lines like "3"
        const rangeMatch = lineStr.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            for (let i = start; i <= end; i++) {
                if (!lineIssueMap[i]) lineIssueMap[i] = [];
                lineIssueMap[i].push(idx);
            }
        } else {
            const num = parseInt(lineStr);
            if (!isNaN(num)) {
                if (!lineIssueMap[num]) lineIssueMap[num] = [];
                lineIssueMap[num].push(idx);
            }
        }
    });

    // Set title
    document.getElementById('annotator-title').textContent = `${wf?.title || 'Analysis'} — Annotations`;

    // Stats
    const critCount = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length;
    const statsEl = document.getElementById('annotator-stats');
    statsEl.innerHTML = `
        <span class="annotator-stat"><span class="annotator-stat-count">${issues.length}</span> issues</span>
        ${critCount > 0 ? `<span class="annotator-stat" style="border-color:#ef4444"><span class="annotator-stat-count" style="color:#ef4444">${critCount}</span> critical/high</span>` : ''}
    `;

    // Render code lines
    const codeEl = document.getElementById('annotator-code');
    codeEl.innerHTML = lines.map((line, i) => {
        const lineNum = i + 1;
        const issueIdxs = lineIssueMap[lineNum];
        const hasIssue = issueIdxs && issueIdxs.length > 0;
        // Take the highest severity for this line
        let sevClass = '';
        if (hasIssue) {
            const sevs = issueIdxs.map(idx => issues[idx]?.severity || 'info');
            const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];
            const highest = sevOrder.find(s => sevs.includes(s)) || 'info';
            sevClass = `severity-${highest}`;
        }
        return `<div class="annotator-line ${hasIssue ? 'has-issue ' + sevClass : ''}" data-line="${lineNum}" ${hasIssue ? `data-issues="${issueIdxs.join(',')}"` : ''}>
            <span class="annotator-linenum">${lineNum}</span>
            <span class="annotator-line-content">${escapeHtml(line) || ' '}</span>
        </div>`;
    }).join('');

    // Render annotation notes
    const notesEl = document.getElementById('annotator-notes');
    if (issues.length === 0) {
        notesEl.innerHTML = '<div class="annotator-empty">No issues to annotate.</div>';
    } else {
        notesEl.innerHTML = issues.map((issue, i) => {
            const sev = (issue.severity || 'info').toLowerCase();
            const fixId = `ann-fix-${Date.now()}-${i}`;
            const fixBlock = issue.fix ? `
                <div class="annotator-note-fix">
                    <div class="annotator-note-fix-bar">
                        <span class="annotator-note-fix-label">Fix</span>
                        <button class="annotator-note-fix-copy" data-fix-id="${fixId}">Copy</button>
                    </div>
                    <pre><code id="${fixId}">${escapeHtml(issue.fix)}</code></pre>
                </div>` : '';
            return `
                <div class="annotator-note severity-${sev}" data-issue-idx="${i}" data-line="${issue.line || ''}">
                    <div class="annotator-note-header">
                        <span class="annotator-note-severity">${sev}</span>
                        ${issue.line ? `<span class="annotator-note-line">Line ${issue.line}</span>` : ''}
                        ${issue.category ? `<span class="annotator-note-category">${issue.category}</span>` : ''}
                    </div>
                    <div class="annotator-note-desc">${escapeHtml(issue.description)}</div>
                    ${fixBlock}
                </div>`;
        }).join('');
    }

    // Highlight code blocks
    notesEl.querySelectorAll('pre code').forEach(hljs.highlightElement);

    // Wire up click interactions
    // Click a code line -> highlight that line + scroll to its annotation
    codeEl.querySelectorAll('.annotator-line[data-issues]').forEach(lineEl => {
        lineEl.addEventListener('click', () => {
            const issueIdxs = lineEl.dataset.issues.split(',').map(Number);
            highlightAnnotation(issueIdxs[0], parseInt(lineEl.dataset.line));
        });
    });

    // Click an annotation -> highlight it + scroll to the code line
    notesEl.querySelectorAll('.annotator-note[data-line]').forEach(noteEl => {
        noteEl.addEventListener('click', (e) => {
            if (e.target.closest('.annotator-note-fix-copy')) return; // don't trigger on copy btn
            const lineStr = noteEl.dataset.line;
            const lineNum = parseInt(lineStr);
            const issueIdx = parseInt(noteEl.dataset.issueIdx);
            highlightAnnotation(issueIdx, isNaN(lineNum) ? null : lineNum);
        });
    });

    // Wire up copy buttons
    notesEl.querySelectorAll('.annotator-note-fix-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codeEl = document.getElementById(btn.dataset.fixId);
            if (!codeEl) return;
            navigator.clipboard.writeText(codeEl.textContent).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
        });
    });

    // Show annotator
    document.getElementById('annotator-view').classList.remove('hidden');
}

function highlightAnnotation(issueIdx, lineNum) {
    // Clear previous highlights
    document.querySelectorAll('.annotator-line.highlighted').forEach(el => el.classList.remove('highlighted'));
    document.querySelectorAll('.annotator-note.highlighted').forEach(el => el.classList.remove('highlighted'));

    // Highlight the code line
    if (lineNum) {
        const lineEl = document.querySelector(`.annotator-line[data-line="${lineNum}"]`);
        if (lineEl) {
            lineEl.classList.add('highlighted');
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Highlight the annotation
    const noteEl = document.querySelector(`.annotator-note[data-issue-idx="${issueIdx}"]`);
    if (noteEl) {
        noteEl.classList.add('highlighted');
        noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function closeAnnotator() {
    document.getElementById('annotator-view').classList.add('hidden');
}

// ─── Workflow Event Listeners ─────────────────────────────────────────────────

document.querySelectorAll('.workflow-card').forEach(card => {
    card.addEventListener('click', () => openWorkflowModal(card.dataset.workflow));
});

document.getElementById('workflow-cancel').addEventListener('click', closeWorkflowModal);
document.getElementById('workflow-run').addEventListener('click', runWorkflow);

document.getElementById('workflow-modal').addEventListener('click', (e) => {
    if (e.target.id === 'workflow-modal') closeWorkflowModal();
});

document.getElementById('annotator-back').addEventListener('click', closeAnnotator);

// Allow tab key in code textarea
document.getElementById('workflow-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
    }
    if (e.key === 'Escape') closeWorkflowModal();
});

init();