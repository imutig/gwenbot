/**
 * GwenBingo Extension — Video Overlay Logic
 * Handles bingo card on stream with toggle button
 */

const EBS_URL = 'https://gwenbot-production.up.railway.app/bingo';

let token = null;
let cardData = null;
let sessionActive = false;
let hasBingo = false;
let displayName = 'Viewer';

// ==================== Twitch Auth ====================

window.Twitch.ext.onAuthorized(function (auth) {
    token = auth.token;
    // Try to get viewer display name
    if (window.Twitch.ext.viewer) {
        displayName = window.Twitch.ext.viewer.displayName || displayName;
    }
    console.log('🔐 Overlay authorized');
    loadCard();
});

window.Twitch.ext.onError(function (err) {
    console.error('❌ Extension error:', err);
});

// PubSub
window.Twitch.ext.listen('broadcast', function (target, contentType, message) {
    try {
        const data = JSON.parse(message);
        if (data.type === 'bingo_winner') {
            showWinner(data);
        }
    } catch (e) {
        console.error('PubSub parse error:', e);
    }
});

// ==================== API ====================

async function apiCall(method, endpoint, body = null) {
    const options = {
        method,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(EBS_URL + endpoint, options);
    return response.json();
}

// ==================== Load Card ====================

async function loadCard() {
    try {
        hasBingo = false;
        cardData = null;

        const data = await apiCall('GET', '/card?display_name=' + encodeURIComponent(displayName));

        if (!data.active) {
            showNoSession();
            return;
        }

        cardData = data.card;
        sessionActive = true;
        renderGrid();
        showBingoView();

        // Show toggle button
        document.getElementById('bingo-toggle').classList.remove('hidden');

        const sessionData = await apiCall('GET', '/session');
        if (sessionData.winners && sessionData.winners.length > 0) {
            renderWinners(sessionData.winners);
        }
    } catch (error) {
        console.error('❌ Error loading card:', error);
        showNoSession();
    }
}

// ==================== Grid ====================

function renderGrid() {
    const grid = document.getElementById('bingo-grid');
    grid.innerHTML = '';

    cardData.grid.forEach((cell, index) => {
        const cellEl = document.createElement('div');
        cellEl.className = 'bingo-cell';
        cellEl.textContent = cell.text;
        cellEl.dataset.index = index;

        if (cell.isFree) {
            cellEl.classList.add('free', 'checked');
        } else if (cardData.checked[index]) {
            cellEl.classList.add('checked');
        }

        if (!cell.isFree) {
            cellEl.addEventListener('click', () => toggleCell(index));
        }

        grid.appendChild(cellEl);
    });

    if (cardData.has_bingo) {
        hasBingo = true;
        setStatus('Tu as déjà fait BINGO ! 🎉', 'winner');
        highlightBingoLine();
    } else if (checkLocalBingo()) {
        showBingoButton();
    }
}

// ==================== Toggle Cell ====================

async function toggleCell(index) {
    if (hasBingo || !sessionActive) return;

    const cell = document.querySelector(`[data-index="${index}"]`);
    const wasChecked = cardData.checked[index];
    cardData.checked[index] = !wasChecked;

    cell.classList.toggle('checked');

    if (checkLocalBingo()) {
        showBingoButton();
    } else {
        hideBingoButton();
    }

    try {
        const result = await apiCall('POST', '/check', { cellIndex: index });
        if (result.checked) cardData.checked = result.checked;
        if (result.hasBingo && !hasBingo) showBingoButton();
    } catch (error) {
        console.error('❌ Error toggling cell:', error);
        cardData.checked[index] = wasChecked;
        cell.classList.toggle('checked');
    }
}

// ==================== Bingo Detection ====================

function checkLocalBingo() {
    const c = cardData.checked;
    for (let r = 0; r < 5; r++) {
        const s = r * 5;
        if (c[s] && c[s + 1] && c[s + 2] && c[s + 3] && c[s + 4]) return true;
    }
    for (let col = 0; col < 5; col++) {
        if (c[col] && c[col + 5] && c[col + 10] && c[col + 15] && c[col + 20]) return true;
    }
    if (c[0] && c[6] && c[12] && c[18] && c[24]) return true;
    if (c[4] && c[8] && c[12] && c[16] && c[20]) return true;
    return false;
}

function getBingoLines() {
    const c = cardData.checked;
    const lines = [];
    for (let r = 0; r < 5; r++) {
        const s = r * 5;
        if (c[s] && c[s + 1] && c[s + 2] && c[s + 3] && c[s + 4]) lines.push([s, s + 1, s + 2, s + 3, s + 4]);
    }
    for (let col = 0; col < 5; col++) {
        if (c[col] && c[col + 5] && c[col + 10] && c[col + 15] && c[col + 20]) lines.push([col, col + 5, col + 10, col + 15, col + 20]);
    }
    if (c[0] && c[6] && c[12] && c[18] && c[24]) lines.push([0, 6, 12, 18, 24]);
    if (c[4] && c[8] && c[12] && c[16] && c[20]) lines.push([4, 8, 12, 16, 20]);
    return lines;
}

function highlightBingoLine() {
    getBingoLines().forEach(line => {
        line.forEach(idx => {
            const cell = document.querySelector(`[data-index="${idx}"]`);
            if (cell) cell.classList.add('bingo-line');
        });
    });
}

// ==================== Claim ====================

async function claimBingo() {
    const btn = document.getElementById('bingo-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Vérification...';

    try {
        const result = await apiCall('POST', '/claim');
        if (result.success) {
            hasBingo = true;
            setStatus(result.message, 'winner');
            highlightBingoLine();
            launchConfetti();
            btn.style.display = 'none';
        } else {
            setStatus(result.error || 'Erreur', 'error');
            btn.disabled = false;
            btn.textContent = '🎉 BINGO !';
        }
    } catch (error) {
        setStatus('Erreur de connexion', 'error');
        btn.disabled = false;
        btn.textContent = '🎉 BINGO !';
    }
}

// ==================== UI ====================

function showBingoView() {
    document.getElementById('no-session').style.display = 'none';
    document.getElementById('bingo-view').style.display = 'block';
}

function showNoSession() {
    document.getElementById('bingo-toggle').classList.remove('hidden');
    document.getElementById('no-session').style.display = 'flex';
    document.getElementById('bingo-view').style.display = 'none';
}

function showBingoButton() {
    document.getElementById('bingo-btn').classList.add('visible');
}

function hideBingoButton() {
    document.getElementById('bingo-btn').classList.remove('visible');
}

function setStatus(msg, type = '') {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = 'status-msg ' + type;
}

function showWinner(data) {
    const container = document.getElementById('winners-container');
    const entry = document.createElement('div');
    entry.className = 'winner-entry';
    entry.innerHTML = `<span class="position">#${data.position}</span><span>${data.username}</span>`;
    container.appendChild(entry);
    document.getElementById('winners-list').style.display = 'block';
}

function renderWinners(winners) {
    if (!winners || winners.length === 0) return;
    const container = document.getElementById('winners-container');
    container.innerHTML = '';
    winners.forEach(w => {
        const entry = document.createElement('div');
        entry.className = 'winner-entry';
        entry.innerHTML = `<span class="position">#${w.position}</span><span>${w.username}</span>`;
        container.appendChild(entry);
    });
    document.getElementById('winners-list').style.display = 'block';
}

// ==================== Confetti ====================

function launchConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#e94560', '#ffd700', '#ff6b8a', '#533483', '#00d2ff', '#fff'];
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + '%';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDelay = Math.random() * 2 + 's';
        c.style.animationDuration = (2 + Math.random() * 2) + 's';
        c.style.width = (4 + Math.random() * 6) + 'px';
        c.style.height = c.style.width;
        c.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(c);
    }
    setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// ==================== Toggle & Events ====================

document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('bingo-toggle');
    const overlay = document.getElementById('bingo-overlay');
    const closeBtn = document.getElementById('overlay-close');
    const bingoBtn = document.getElementById('bingo-btn');

    toggle.addEventListener('click', function () {
        overlay.classList.toggle('visible');
    });

    closeBtn.addEventListener('click', function () {
        overlay.classList.remove('visible');
    });

    bingoBtn.addEventListener('click', claimBingo);
});

// ==================== Polling ====================

setInterval(async () => {
    if (!token) return;
    try {
        const data = await apiCall('GET', '/session');
        if (data.active && !sessionActive) {
            loadCard();
        } else if (!data.active && sessionActive) {
            sessionActive = false;
            showNoSession();
        } else if (data.active && data.winners && data.winners.length > 0) {
            renderWinners(data.winners);
        }
    } catch (e) { /* silent */ }
}, 30000);
