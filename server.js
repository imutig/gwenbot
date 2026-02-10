/**
 * Web Server for xsgwen.fr
 * Multi-page website with dark mode
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { supabase } = require('./db');
const { getSessionStatus, startSession, stopSession } = require('./game-controller');

// Import route modules
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const statsRoutes = require('./routes/stats');
const twitchRoutes = require('./routes/twitch');
const sudokuRoutes = require('./routes/sudoku');
const { router: bingoRoutes } = require('./routes/bingo');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Simple session storage (in production use Redis or DB)
const sessions = new Map();

// Session secret for signing cookies
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Twitch OAuth config
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback';

// Authorized users cache (loaded from DB on startup)
let AUTHORIZED_USERS = [];
let SUPER_ADMINS = [];

// Load authorized users from database
async function loadAuthorizedUsers() {
    try {
        const { data: result, error } = await supabase
            .from('authorized_users')
            .select('username, is_super_admin');

        if (error) throw error;

        AUTHORIZED_USERS = (result || []).map(r => r.username.toLowerCase());
        SUPER_ADMINS = (result || []).filter(r => r.is_super_admin).map(r => r.username.toLowerCase());
        console.log(`✅ Loaded ${AUTHORIZED_USERS.length} authorized users (${SUPER_ADMINS.length} super admins)`);
    } catch (error) {
        console.error('Error loading authorized users:', error);
        // Fallback to defaults
        AUTHORIZED_USERS = ['xsgwen', 'imuutig'];
        SUPER_ADMINS = ['xsgwen', 'imuutig'];
    }
}

// Get or create session
function getSession(req) {
    const sessionId = req.cookies.session_id;
    if (sessionId && sessions.has(sessionId)) {
        return sessions.get(sessionId);
    }
    return null;
}

// Check if user is admin (from database-backed list)
async function isAdmin(session) {
    if (!session || !session.user) return false;
    const username = session.user.login.toLowerCase();

    // Check if in authorized users list
    if (AUTHORIZED_USERS.includes(username)) return true;

    // Check if mod (we'll trust the mod status from Twitch)
    if (session.user.is_mod) return true;

    return false;
}

// Admin middleware
async function requireAdmin(req, res, next) {
    const session = getSession(req);
    if (!session || !(await isAdmin(session))) {
        return res.status(401).json({ error: 'Non autorisé. Connectez-vous en tant que streamer ou mod.' });
    }
    req.session = session;
    next();
}

// ==================== MAINTENANCE MODE ====================
// Set MAINTENANCE_MODE=true and MAINTENANCE_BYPASS_CODE=your_secret_code in .env
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const MAINTENANCE_BYPASS_CODE = process.env.MAINTENANCE_BYPASS_CODE || 'dev-access-2026';

// Maintenance mode bypass route
app.get('/bypass/:code', (req, res) => {
    if (req.params.code === MAINTENANCE_BYPASS_CODE) {
        res.cookie('maintenance_bypass', 'true', {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        console.log('🔓 Maintenance bypass activated');
        res.redirect('/');
    } else {
        res.status(403).send('Invalid code');
    }
});

// Maintenance page HTML - matches main site design
const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site en construction - xsgwen.fr</title>
    <link rel="icon" href="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #fff0f3;
            --bg-card: rgba(255, 255, 255, 0.75);
            --text-primary: #8B4558;
            --text-muted: #c9688a;
            --pink-main: #ff85c0;
            --pink-accent: #ff69b4;
            --pink-dark: #eb2f96;
            --flower-1: #ffc1e3;
            --flower-2: #ff85c0;
            --flower-3: #eb2f96;
            --border-color: rgba(255, 182, 193, 0.4);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at center, #ffffff 0%, #fff0f3 100%);
            background-color: var(--bg-base);
            font-family: 'Poppins', sans-serif;
            color: var(--text-primary);
            position: relative;
            overflow: hidden;
        }
        
        /* Floral Background */
        .floral-bg {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            pointer-events: none;
        }
        .flower {
            position: absolute;
            opacity: 0.4;
            animation: floatFlower 20s ease-in-out infinite;
        }
        @keyframes floatFlower {
            0%, 100% { transform: rotate(0deg) scale(1) translateY(0); }
            25% { transform: rotate(5deg) scale(1.03) translateY(-10px); }
            50% { transform: rotate(-3deg) scale(1.05) translateY(-5px); }
            75% { transform: rotate(4deg) scale(1.02) translateY(-8px); }
        }
        .flower-1 { width: 320px; height: 320px; top: 80px; left: 20px; fill: var(--flower-1); }
        .flower-2 { width: 280px; height: 280px; bottom: 60px; right: 30px; fill: var(--flower-2); animation-delay: -5s; }
        .flower-3 { width: 200px; height: 200px; top: 35%; right: 60px; fill: var(--flower-3); opacity: 0.3; animation-delay: -10s; }
        .flower-4 { width: 240px; height: 240px; bottom: 35%; left: 30px; fill: var(--flower-2); opacity: 0.25; animation-delay: -15s; }
        
        .container {
            position: relative;
            z-index: 10;
            text-align: center;
            padding: 3rem;
            max-width: 500px;
            background: var(--bg-card);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            border: 1px solid var(--border-color);
        }
        .profile-img {
            width: 100px; height: 100px;
            border-radius: 50%;
            border: 4px solid var(--pink-main);
            margin-bottom: 1.5rem;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }
        .subtitle {
            font-size: 1rem;
            color: var(--text-muted);
            margin-bottom: 2rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        .btn-primary {
            background: var(--pink-accent);
            color: white;
        }
        .btn-primary:hover {
            background: var(--pink-dark);
            transform: translateY(-2px);
        }
        .btn-twitch {
            background: #9146ff;
            color: white;
        }
        .btn-twitch:hover {
            background: #7c3adb;
            transform: translateY(-2px);
        }
        .buttons {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .divider {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 2rem 0;
            color: var(--text-muted);
            font-size: 0.85rem;
        }
        .divider::before, .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--border-color);
        }
        .bypass-form {
            display: flex;
            gap: 0.5rem;
        }
        .bypass-input {
            flex: 1;
            padding: 0.75rem 1rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: rgba(255,255,255,0.6);
            color: var(--text-primary);
            font-size: 0.9rem;
        }
        .bypass-input:focus {
            outline: none;
            border-color: var(--pink-accent);
        }
        .bypass-input::placeholder {
            color: var(--text-muted);
            opacity: 0.6;
        }
        .bypass-btn {
            padding: 0.75rem 1rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-card);
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s;
        }
        .bypass-btn:hover {
            background: var(--pink-accent);
            color: white;
            border-color: var(--pink-accent);
        }
        .note {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 1rem;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <!-- Floral Background -->
    <div class="floral-bg">
        <svg class="flower flower-1" viewBox="0 0 100 100">
            <g transform="translate(50,50)">
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
            </g>
        </svg>
        <svg class="flower flower-2" viewBox="0 0 100 100">
            <g transform="translate(50,50)">
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
            </g>
        </svg>
        <svg class="flower flower-3" viewBox="0 0 100 100">
            <g transform="translate(50,50)">
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
            </g>
        </svg>
        <svg class="flower flower-4" viewBox="0 0 100 100">
            <g transform="translate(50,50)">
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(0)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(60)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(120)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(180)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(240)" />
                <path d="M0,-35 C10,-35 15,-20 0,0 C-15,-20 -10,-35 0,-35" transform="rotate(300)" />
            </g>
        </svg>
    </div>

    <div class="container">
        <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png" alt="xsgwen" class="profile-img">
        <h1><svg style="width:28px;height:28px;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24" fill="var(--pink-accent)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> Site en construction</h1>
        <p class="subtitle">Le site xsgwen.fr arrive bientôt !<br>En attendant, rejoins le stream !</p>
        
        <div class="buttons">
            <a href="https://twitch.tv/xsgwen" class="btn btn-twitch">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
                Regarder sur Twitch
            </a>
            <a href="/auth/bot-authorize" class="btn btn-primary">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/>
                </svg>
                Autoriser le bot (Gwen)
            </a>
        </div>
        
        <div class="divider">Accès développeur</div>
        
        <form class="bypass-form" onsubmit="event.preventDefault(); window.location.href='/bypass/' + document.getElementById('code').value;">
            <input type="password" id="code" class="bypass-input" placeholder="Code d'accès" autocomplete="off">
            <button type="submit" class="bypass-btn">→</button>
        </form>
        
        <p class="note">Streameuse ? Clique sur "Autoriser le bot" pour activer gwenbot_ sur ta chaîne.</p>
    </div>
</body>
</html>
`;

// Maintenance mode middleware
app.use((req, res, next) => {
    // Skip if maintenance mode is off
    if (!MAINTENANCE_MODE) {
        return next();
    }

    // Allow bypass cookie holders
    if (req.cookies.maintenance_bypass === 'true') {
        return next();
    }

    // Allow auth routes (for bot authorization)
    if (req.path.startsWith('/auth')) {
        return next();
    }

    // Allow bypass route
    if (req.path.startsWith('/bypass')) {
        return next();
    }

    // Allow health check
    if (req.path === '/health') {
        return next();
    }

    // Allow API for bot status check
    if (req.path === '/auth/bot-status') {
        return next();
    }

    // Allow API announce route (for GwenGuessr, Pictionary, etc.)
    if (req.path === '/api/announce') {
        return next();
    }

    // Allow bingo extension routes
    if (req.path.startsWith('/bingo')) {
        return next();
    }

    // Block everything else - show maintenance page
    res.status(503).send(MAINTENANCE_HTML);
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// === Page Routes ===

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cemantix page
app.get('/cemantix', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cemantix.html'));
});

// Planning page
app.get('/planning', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planning.html'));
});

// Clips page
app.get('/clips', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'clips.html'));
});

// Commands page
app.get('/commands', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'commands.html'));
});

// Stats page
app.get('/stats', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// Admin page (protected - shows login if not authenticated)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Polls page
app.get('/polls', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'polls.html'));
});

// Sudoku page
app.get('/sudoku', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sudoku.html'));
});

// === Mount Route Modules ===

// Auth routes: /auth/*
const authRouter = authRoutes.createRouter({
    sessions,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    TWITCH_REDIRECT_URI,
    AUTHORIZED_USERS,
    isAdmin
});
app.use('/auth', authRouter);

// API endpoint for getting current user (needed by admin.html)
app.get('/api/auth/user', async (req, res) => {
    const session = getSession(req);
    if (!session) {
        return res.json({ authenticated: false });
    }

    const admin = await isAdmin(session);
    res.json({
        authenticated: true,
        isAdmin: admin,
        user: {
            login: session.user.login,
            display_name: session.user.display_name,
            profile_image_url: session.user.profile_image_url
        }
    });
});

// Admin routes: /api/admin/*
const adminRouter = adminRoutes.createRouter({
    requireAdmin,
    getSession,
    getAuthorizedUsers: () => AUTHORIZED_USERS,
    getSuperAdmins: () => SUPER_ADMINS,
    updateAuthorizedUsers: (newList) => { AUTHORIZED_USERS = newList; },
    getSessionStatus,
    startSession,
    stopSession
});
app.use('/api/admin', adminRouter);

// Stats routes: /api/*
const statsRouter = statsRoutes.createRouter({});
app.use('/api', statsRouter);

// Twitch routes: /api/twitch/*
const twitchRouter = twitchRoutes.createRouter({
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET
});
app.use('/api/twitch', twitchRouter);

// Bingo extension routes: /bingo/*
app.use('/bingo', bingoRoutes);

// Polls page (admin only)
app.get('/polls', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'polls.html'));
});

// === Polls API Routes ===

// Get polls
app.get('/api/polls', requireAdmin, async (req, res) => {
    try {
        const { getTwitchClient } = require('./index');
        const client = getTwitchClient();

        if (!client) {
            return res.status(503).json({ error: 'Bot not connected' });
        }

        const polls = await client.getPolls();
        res.json({ polls });
    } catch (error) {
        console.error('Error getting polls:', error);
        res.status(500).json({ error: 'Failed to get polls' });
    }
});

// Create poll
app.post('/api/polls', requireAdmin, async (req, res) => {
    try {
        const { getTwitchClient } = require('./index');
        const client = getTwitchClient();

        if (!client) {
            return res.status(503).json({ error: 'Bot not connected' });
        }

        const { title, choices, duration } = req.body;

        if (!title || !choices || choices.length < 2) {
            return res.status(400).json({ error: 'Title and at least 2 choices required' });
        }

        const poll = await client.createPoll(title, choices, duration || 60);

        if (poll) {
            res.json({ success: true, poll });
        } else {
            res.status(400).json({ error: 'Failed to create poll. Only one poll can run at a time.' });
        }
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ error: 'Failed to create poll' });
    }
});

// End poll
app.patch('/api/polls/:id', requireAdmin, async (req, res) => {
    try {
        const { getTwitchClient } = require('./index');
        const client = getTwitchClient();

        if (!client) {
            return res.status(503).json({ error: 'Bot not connected' });
        }

        const { archive } = req.body;
        const poll = await client.endPoll(req.params.id, archive || false);

        if (poll) {
            res.json({ success: true, poll });
        } else {
            res.status(400).json({ error: 'Failed to end poll' });
        }
    } catch (error) {
        console.error('Error ending poll:', error);
        res.status(500).json({ error: 'Failed to end poll' });
    }
});

// === Announce API Route (for GwenGuessr and other game announcements) ===
app.post('/api/announce', async (req, res) => {
    try {
        // Verify request is from our Next.js app
        const botSecret = req.headers['x-bot-secret'];
        if (botSecret !== process.env.BOT_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { message, color } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        // Get twitch client
        const { getTwitchClient } = require('./index');
        const client = getTwitchClient();

        if (!client) {
            return res.status(503).json({ error: 'Bot not connected' });
        }

        // Send announcement
        const success = await client.sendAnnouncement(message, color || 'purple');

        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to send announcement' });
        }
    } catch (error) {
        console.error('Announce error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// === Cemantix Session Control (for Next.js admin panel) ===
app.post('/api/cemantix/session/start', async (req, res) => {
    try {
        const botSecret = req.headers['x-bot-secret'];
        if (botSecret !== process.env.BOT_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { lang } = req.body;
        const result = await startSession(lang || 'fr');

        if (result.success) {
            // Send Twitch announcement
            const { getTwitchClient } = require('./index');
            const client = getTwitchClient();
            if (client) {
                await client.sendAnnouncement(
                    `🎮 Session ${result.gameName} lancée ! Écrivez un mot seul dans le chat pour le tester. Bonne chance à tous !`,
                    'purple'
                );
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Cemantix start error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/cemantix/session/stop', async (req, res) => {
    try {
        const botSecret = req.headers['x-bot-secret'];
        if (botSecret !== process.env.BOT_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await stopSession();

        if (result.success) {
            // Send Twitch announcement
            const { getTwitchClient } = require('./index');
            const client = getTwitchClient();
            if (client) {
                let msg = `🏁 Session ${result.gameName} terminée !`;
                if (result.winner) {
                    msg += ` 🏆 Gagnant: ${result.winner} avec "${result.winningWord}"`;
                }
                msg += ` (${result.guessCount} essais)`;
                await client.sendAnnouncement(msg, 'purple');
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Cemantix stop error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Store twitchClient reference for bot auth routes
let twitchClientRef = null;

async function startServer(twitchClient = null) {
    twitchClientRef = twitchClient;

    // Load authorized users from database before starting
    await loadAuthorizedUsers();

    // Register bot auth routes (needs query function and twitchClient)
    const { createBotAuthRouter } = authRoutes;
    const botAuthRouter = createBotAuthRouter({
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
        TWITCH_REDIRECT_URI,
        twitchClient: twitchClientRef
    });
    app.use('/auth', botAuthRouter);

    // Sudoku routes
    app.use('/api/sudoku', sudokuRoutes.router);

    // Create HTTP server for WebSocket support
    const http = require('http');
    const server = http.createServer(app);

    // Initialize Sudoku WebSocket
    sudokuRoutes.initWebSocket(server);

    server.listen(PORT, () => {
        console.log(`🌐 Server running on port ${PORT}`);
    });
}

module.exports = { startServer, loadAuthorizedUsers };

