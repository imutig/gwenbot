/**
 * GwenBingo Extension — Live Config (Broadcaster) Logic
 * Handles session management and items editing
 */

const EBS_URL = 'https://gwenbot-production.up.railway.app/bingo';
let token = null;
let currentSession = null;

// ==================== Twitch Auth ====================

console.log('🔧 GwenBingo live_config.js loaded');
console.log('🔧 EBS_URL:', EBS_URL);

window.Twitch.ext.onAuthorized(function (auth) {
    token = auth.token;
    console.log('🔐 Live Config authorized, token length:', token ? token.length : 0);
    console.log('🔐 Channel ID:', auth.channelId);
    loadSession();
    loadSavedItems();
});

window.Twitch.ext.onError(function (err) {
    console.error('❌ Twitch Extension error:', err);
});

// ==================== API ====================

async function apiCall(method, endpoint, body = null) {
    const url = EBS_URL + endpoint;
    console.log(`🌐 API ${method} ${url}`);

    const options = {
        method,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(url, options);
        console.log(`🌐 Response: ${response.status} ${response.statusText}`);
        const data = await response.json();
        console.log('🌐 Data:', JSON.stringify(data).substring(0, 200));
        return data;
    } catch (fetchError) {
        console.error('🌐 Fetch failed:', fetchError.message);
        throw fetchError;
    }
}

// ==================== Session Management ====================

async function loadSession() {
    try {
        console.log('📡 Loading session...');
        const data = await apiCall('GET', '/session');

        if (data.active) {
            currentSession = data;
            showActiveSession(data);
            if (data.items) {
                document.getElementById('items-textarea').value = data.items.join('\n');
                updateItemCount();
            }
        } else {
            showInactiveSession();
        }
    } catch (error) {
        console.error('Error loading session:', error);
        setConfigStatus('Erreur de connexion: ' + error.message, 'error');
    }
}

async function startSession() {
    const items = getItemsList();
    if (items.length < 24) {
        setConfigStatus('Il faut au moins 24 items !', 'error');
        return;
    }

    const btn = document.getElementById('btn-start');
    btn.disabled = true;
    btn.textContent = '⏳ Lancement...';

    try {
        const result = await apiCall('POST', '/session/start', { items });

        if (result.success) {
            setConfigStatus('✅ Bingo lancé !', '');
            saveItemsLocally(items);
            loadSession();
        } else {
            setConfigStatus(result.error || 'Erreur', 'error');
        }
    } catch (error) {
        setConfigStatus('Erreur de connexion', 'error');
    }

    btn.disabled = false;
    btn.textContent = '▶ Lancer le Bingo';
}

async function endSession() {

    const btn = document.getElementById('btn-stop');
    btn.disabled = true;

    try {
        const result = await apiCall('POST', '/session/end');
        if (result.success) {
            setConfigStatus('⏹ Bingo terminé', '');
            loadSession();
        }
    } catch (error) {
        setConfigStatus('Erreur', 'error');
    }

    btn.disabled = false;
}

async function saveItems() {
    const items = getItemsList();
    if (items.length < 24) {
        setConfigStatus('Il faut au moins 24 items !', 'error');
        return;
    }

    // Save locally for persistence
    saveItemsLocally(items);

    // If session is active, update server
    if (currentSession && currentSession.active) {
        try {
            await apiCall('POST', '/session/items', { items });
            setConfigStatus('✅ Items sauvegardés', '');
        } catch (error) {
            setConfigStatus('Erreur de sauvegarde', 'error');
        }
    } else {
        setConfigStatus('✅ Items sauvegardés localement', '');
    }
}


// ==================== UI Helpers ====================

function showActiveSession(data) {
    document.getElementById('status-dot').className = 'status-dot active';
    document.getElementById('session-status-text').textContent = 'Bingo en cours';
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';

    if (data.winners && data.winners.length > 0) {
        const wSection = document.getElementById('winners-section');
        const wContainer = document.getElementById('live-winners');
        wSection.style.display = 'block';
        wContainer.innerHTML = data.winners.map(w =>
            `<div style="margin:2px 0;">🏆 #${w.position} — ${w.username}</div>`
        ).join('');
    }
}

function showInactiveSession() {
    currentSession = null;
    document.getElementById('status-dot').className = 'status-dot inactive';
    document.getElementById('session-status-text').textContent = 'Aucun bingo en cours';
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-stop').style.display = 'none';
    document.getElementById('winners-section').style.display = 'none';
}

function getItemsList() {
    const text = document.getElementById('items-textarea').value;
    return text.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function updateItemCount() {
    const items = getItemsList();
    const el = document.getElementById('item-count');
    el.textContent = `${items.length} / 24 items`;
    el.className = items.length >= 24 ? 'item-count ok' : 'item-count error';
}


function setConfigStatus(msg, type) {
    const el = document.getElementById('config-status');
    el.textContent = msg;
    el.className = 'status-msg ' + type;
    if (msg) setTimeout(() => { el.textContent = ''; }, 5000);
}

// ==================== Local Storage (items presets) ====================

function saveItemsLocally(items) {
    try {
        localStorage.setItem('gwenbingo_items', JSON.stringify(items));
    } catch (e) { /* extension sandbox may block */ }
}

function loadSavedItems() {
    try {
        const saved = localStorage.getItem('gwenbingo_items');
        if (saved && !document.getElementById('items-textarea').value) {
            const items = JSON.parse(saved);
            document.getElementById('items-textarea').value = items.join('\n');
            updateItemCount();
        }
    } catch (e) { /* extension sandbox may block */ }
}

// ==================== Presets ====================

const PRESETS = {
    gwen: [
        'a mal à la cheville', 'rôte', 'oublie ce qu\'elle voulait dire',
        'musique trop forte', 'oubli de changer de scène', 'dit qu\'elle est une génie',
        'danse avec Jennie', 'critique son apparence', 'complimente son apparence',
        'refait son sourcil', 'est en retard sur le chat', 'perd un truc',
        'sursaute à cause de jennie', 'met ses lunettes', 'dit "je lis tout guys"',
        'casque n\'a plus de batterie', 'protège yusur ou gronounours',
        'insulte mutig ou manu', 'raconte une anecdote', 'a l\'esprit mal placé'
    ]
};

function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    // confirm() is blocked in Twitch extension iframes, skip confirmation

    document.getElementById('items-textarea').value = preset.join('\n');
    updateItemCount();
    setConfigStatus(`✅ Preset "${name}" chargé`, '');
}

// Make loadPreset available via addEventListener
// window.loadPreset = loadPreset; // Not used with inline onclick

// ==================== Event Listeners ====================
// Twitch CSP blocks inline onclick/oninput handlers
// All bindings must use addEventListener

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-start').addEventListener('click', startSession);
    document.getElementById('btn-stop').addEventListener('click', endSession);
    document.getElementById('btn-save').addEventListener('click', saveItems);
    document.getElementById('btn-preset-gwen').addEventListener('click', function () { loadPreset('gwen'); });
    document.getElementById('items-textarea').addEventListener('input', updateItemCount);
    console.log('🔧 Event listeners attached');
});

// Poll session status every 15s
setInterval(loadSession, 15000);
