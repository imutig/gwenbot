/**
 * GwenBingo Extension — Live Config (Broadcaster) Logic
 * Handles session management and items editing
 */

const EBS_URL = 'https://xsgwen.fr/bingo';
let token = null;
let currentSession = null;

// ==================== Twitch Auth ====================

window.Twitch.ext.onAuthorized(function (auth) {
    token = auth.token;
    console.log('🔐 Live Config authorized');
    loadSession();
    loadSavedItems();
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

// ==================== Session Management ====================

async function loadSession() {
    try {
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
        setConfigStatus('Erreur de connexion', 'error');
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
    if (!confirm('Arrêter le bingo en cours ?')) return;

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

// Make functions available globally for onclick
window.startSession = startSession;
window.endSession = endSession;
window.saveItems = saveItems;

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

// Make updateItemCount available globally for oninput
window.updateItemCount = updateItemCount;

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
    gaming: [
        'Rage quit', 'Meurt au boss', 'Dit "en vrai"', 'Fail épique',
        'Cri de rage', 'Jump scare', 'Bug de jeu', 'Victoire inespérée',
        'Se perd sur la map', 'Oublie de sauvegarder', 'Tombe dans le vide',
        'Se fait trahir', 'Lag/déco', 'Clutch moment', 'Speedrun fail',
        'Découvre un secret', 'Panique totale', 'Danse de la victoire',
        'Blame le jeu', 'Excuse bidon', 'Stratégie douteuse',
        'Dit un gros mot', 'Rire nerveux', 'Silence gêné',
        'Se fait one-shot', 'Fait le mauvais choix', 'Skip le tuto',
        'Oublie les contrôles', 'Chute ridicule', 'AFK moment'
    ],
    irl: [
        'Dit "du coup"', 'Boit un coup', 'Rit aux éclats', 'Raconte une anecdote',
        'Fait un compliment', 'Chante', 'Se lève de sa chaise', 'Check son tel',
        'Dit "attends"', 'Fait un bruit bizarre', 'Parle de bouffe',
        'Mentionne un viewer', 'Dit merci à un sub', 'Raid reçu',
        'Regarde l\'heure', 'Dit "je suis fatigué(e)"', 'Fait un facepalm',
        'Raconte un drama', 'Parle de son chat/chien', 'Oublie ce qu\'elle disait',
        'Dit "c\'est pas possible"', 'Se moque de quelqu\'un', 'Soupire',
        'Dit "bref"', 'Prend une pause', 'Change de sujet brusquement',
        'Reçoit un don', 'Lit un message à voix haute', 'Dit "on s\'en fout"',
        'Fait du bruit avec son clavier'
    ]
};

function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    if (document.getElementById('items-textarea').value.trim()) {
        if (!confirm('Remplacer les items actuels par le preset ?')) return;
    }

    document.getElementById('items-textarea').value = preset.join('\n');
    updateItemCount();
    setConfigStatus(`✅ Preset "${name}" chargé`, '');
}

// Make loadPreset available globally
window.loadPreset = loadPreset;

// Poll session status every 15s
setInterval(loadSession, 15000);
