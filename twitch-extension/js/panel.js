/**
 * GwenBingo Extension — Panel (Viewer) Logic
 * Handles the bingo card display, cell toggling, and bingo claiming
 */

// ==================== Configuration ====================

// EBS URL — your Express server
const EBS_URL = 'https://xsgwen.fr/bingo';

// State
let token = null;
let cardData = null;
let sessionActive = false;
let hasBingo = false;

// ==================== Twitch Auth ====================

window.Twitch.ext.onAuthorized(function (auth) {
    token = auth.token;
    console.log('🔐 Extension authorized, loading bingo card...');
    loadCard();
});

window.Twitch.ext.onError(function (err) {
    console.error('❌ Extension error:', err);
});

// Listen for PubSub broadcasts (bingo announcements)
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

// ==================== API Calls ====================

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
        const data = await apiCall('GET', '/card');

        if (!data.active) {
            showNoSession();
            return;
        }

        cardData = data.card;
        sessionActive = true;
        renderGrid();
        showBingoView();

        // Also check for existing winners
        const sessionData = await apiCall('GET', '/session');
        if (sessionData.winners && sessionData.winners.length > 0) {
            renderWinners(sessionData.winners);
        }
    } catch (error) {
        console.error('❌ Error loading card:', error);
        showNoSession();
    }
}

// ==================== Render Grid ====================

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

    // Check if already has bingo
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

    // Optimistic UI update
    const cell = document.querySelector(`[data-index="${index}"]`);
    const wasChecked = cardData.checked[index];
    cardData.checked[index] = !wasChecked;

    if (cardData.checked[index]) {
        cell.classList.add('checked');
    } else {
        cell.classList.remove('checked');
    }

    // Check for bingo locally
    if (checkLocalBingo()) {
        showBingoButton();
    } else {
        hideBingoButton();
    }

    // Send to server
    try {
        const result = await apiCall('POST', '/check', { cellIndex: index });
        // Sync with server state
        cardData.checked = result.checked;

        if (result.hasBingo && !hasBingo) {
            showBingoButton();
        }
    } catch (error) {
        console.error('❌ Error toggling cell:', error);
        // Revert on error
        cardData.checked[index] = wasChecked;
        cell.classList.toggle('checked');
    }
}

// ==================== Bingo Detection (local) ====================

function checkLocalBingo() {
    const c = cardData.checked;

    // Rows
    for (let r = 0; r < 5; r++) {
        const s = r * 5;
        if (c[s] && c[s + 1] && c[s + 2] && c[s + 3] && c[s + 4]) return true;
    }
    // Columns
    for (let col = 0; col < 5; col++) {
        if (c[col] && c[col + 5] && c[col + 10] && c[col + 15] && c[col + 20]) return true;
    }
    // Diagonals
    if (c[0] && c[6] && c[12] && c[18] && c[24]) return true;
    if (c[4] && c[8] && c[12] && c[16] && c[20]) return true;

    return false;
}

function getBingoLines() {
    const c = cardData.checked;
    const lines = [];

    // Rows
    for (let r = 0; r < 5; r++) {
        const s = r * 5;
        if (c[s] && c[s + 1] && c[s + 2] && c[s + 3] && c[s + 4]) {
            lines.push([s, s + 1, s + 2, s + 3, s + 4]);
        }
    }
    // Columns
    for (let col = 0; col < 5; col++) {
        if (c[col] && c[col + 5] && c[col + 10] && c[col + 15] && c[col + 20]) {
            lines.push([col, col + 5, col + 10, col + 15, col + 20]);
        }
    }
    // Diagonals
    if (c[0] && c[6] && c[12] && c[18] && c[24]) {
        lines.push([0, 6, 12, 18, 24]);
    }
    if (c[4] && c[8] && c[12] && c[16] && c[20]) {
        lines.push([4, 8, 12, 16, 20]);
    }

    return lines;
}

function highlightBingoLine() {
    const lines = getBingoLines();
    lines.forEach(line => {
        line.forEach(idx => {
            const cell = document.querySelector(`[data-index="${idx}"]`);
            if (cell) cell.classList.add('bingo-line');
        });
    });
}

// ==================== Claim Bingo ====================

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
        console.error('❌ Error claiming bingo:', error);
        setStatus('Erreur de connexion', 'error');
        btn.disabled = false;
        btn.textContent = '🎉 BINGO !';
    }
}

// Make claimBingo available globally for onclick
window.claimBingo = claimBingo;

// ==================== UI Helpers ====================

function showBingoView() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('no-session').style.display = 'none';
    document.getElementById('bingo-view').style.display = 'block';
}

function showNoSession() {
    document.getElementById('loading').style.display = 'none';
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
    // Add winner to the list
    const container = document.getElementById('winners-container');
    const entry = document.createElement('div');
    entry.className = 'winner-entry';
    entry.innerHTML = `
        <span class="position">#${data.position}</span>
        <span>${data.username}</span>
    `;
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
        entry.innerHTML = `
            <span class="position">#${w.position}</span>
            <span>${w.username}</span>
        `;
        container.appendChild(entry);
    });

    document.getElementById('winners-list').style.display = 'block';
}

// ==================== Confetti ====================

function launchConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#e94560', '#ffd700', '#ff6b8a', '#533483', '#00d2ff', '#fff'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.width = (4 + Math.random() * 6) + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(confetti);
    }

    // Cleanup after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// ==================== Polling ====================

// Poll for session changes every 30 seconds
setInterval(async () => {
    if (!token) return;

    try {
        const data = await apiCall('GET', '/session');
        if (data.active && !sessionActive) {
            // Session just started — reload card
            loadCard();
        } else if (!data.active && sessionActive) {
            // Session ended
            sessionActive = false;
            showNoSession();
        } else if (data.active && data.winners && data.winners.length > 0) {
            renderWinners(data.winners);
        }
    } catch (e) {
        // Silent fail for polling
    }
}, 30000);
