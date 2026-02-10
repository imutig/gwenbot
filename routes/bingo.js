/**
 * Bingo Extension Backend Service (EBS) Routes
 * JWT-protected routes for the Twitch Bingo Extension
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db');

const router = express.Router();

// Extension secret (base64-encoded from Twitch Developer Console)
const EXTENSION_SECRET = Buffer.from(process.env.TWITCH_EXTENSION_SECRET || '', 'base64');
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

// Cache for app access token (Helix API)
let appAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Get a Twitch app access token for Helix API calls
 * Uses the bot's client credentials (TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET)
 */
async function getAppAccessToken() {
    if (appAccessToken && Date.now() < tokenExpiresAt) return appAccessToken;
    try {
        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            console.error('❌ Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET for Helix API');
            return null;
        }
        const res = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
        });
        const data = await res.json();
        if (!data.access_token) {
            console.error('❌ Failed to get app token:', data);
            return null;
        }
        appAccessToken = data.access_token;
        tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
        return appAccessToken;
    } catch (e) {
        console.error('❌ Failed to get app access token:', e);
        return null;
    }
}

/**
 * Resolve a Twitch user ID to a display name via Helix API
 */
async function getTwitchDisplayName(userId) {
    if (!userId) {
        console.log('⚠️ No userId available for username resolution (viewer may not have shared identity)');
        return null;
    }
    try {
        const token = await getAppAccessToken();
        if (!token) return null;
        const clientId = process.env.TWITCH_CLIENT_ID;
        const res = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': clientId
            }
        });
        const data = await res.json();
        const displayName = data.data?.[0]?.display_name || null;
        console.log(`🎯 Resolved user ${userId} → ${displayName || 'unknown'}`);
        return displayName;
    } catch (e) {
        console.error('❌ Failed to resolve Twitch username:', e);
        return null;
    }
}

// ==================== JWT MIDDLEWARE ====================

/**
 * Verify Twitch Extension JWT
 * Extracts user info: { userId, role, channelId, opaqueUserId }
 */
function verifyExtensionJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, EXTENSION_SECRET);
        req.twitchUser = {
            opaqueUserId: decoded.opaque_user_id,
            userId: decoded.user_id || null,
            role: decoded.role,
            channelId: decoded.channel_id
        };
        next();
    } catch (error) {
        console.error('❌ Invalid extension JWT:', error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Require broadcaster role
 */
function requireBroadcaster(req, res, next) {
    if (req.twitchUser.role !== 'broadcaster') {
        return res.status(403).json({ error: 'Broadcaster only' });
    }
    next();
}

// ==================== CORS for Extensions ====================
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Apply JWT verification to all routes
router.use(verifyExtensionJWT);

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a shuffled 5x5 grid from the items list
 * Index 12 (center) is always the free space
 */
function generateGrid(items) {
    // Need at least 24 items (25 minus free space)
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);

    // Insert free space at center (index 12)
    const grid = [];
    let itemIdx = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            grid.push({ text: '⭐', isFree: true });
        } else {
            grid.push({ text: selected[itemIdx], isFree: false });
            itemIdx++;
        }
    }
    return grid;
}

/**
 * Check if the checked array contains a bingo
 * (5 in a row: horizontal, vertical, or diagonal)
 */
function checkBingo(checked) {
    // Rows
    for (let r = 0; r < 5; r++) {
        const start = r * 5;
        if (checked[start] && checked[start + 1] && checked[start + 2] && checked[start + 3] && checked[start + 4]) {
            return true;
        }
    }

    // Columns
    for (let c = 0; c < 5; c++) {
        if (checked[c] && checked[c + 5] && checked[c + 10] && checked[c + 15] && checked[c + 20]) {
            return true;
        }
    }

    // Diagonals
    if (checked[0] && checked[6] && checked[12] && checked[18] && checked[24]) return true;
    if (checked[4] && checked[8] && checked[12] && checked[16] && checked[20]) return true;

    return false;
}

/**
 * Get all winning bingo lines (cell indices of complete rows/cols/diags)
 */
function getBingoLines(checked) {
    const lines = [];
    // Rows
    for (let r = 0; r < 5; r++) {
        const start = r * 5;
        const row = [start, start + 1, start + 2, start + 3, start + 4];
        if (row.every(i => checked[i])) lines.push(row);
    }
    // Columns
    for (let c = 0; c < 5; c++) {
        const col = [c, c + 5, c + 10, c + 15, c + 20];
        if (col.every(i => checked[i])) lines.push(col);
    }
    // Diagonals
    const d1 = [0, 6, 12, 18, 24];
    const d2 = [4, 8, 12, 16, 20];
    if (d1.every(i => checked[i])) lines.push(d1);
    if (d2.every(i => checked[i])) lines.push(d2);
    return lines;
}

// ==================== SESSION ROUTES (Broadcaster) ====================

/**
 * POST /bingo/session/start
 * Create a new bingo session with items
 */
router.post('/session/start', requireBroadcaster, async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length < 24) {
            return res.status(400).json({ error: 'Need at least 24 items for a 5x5 bingo grid' });
        }

        // End any active session first
        await supabase
            .from('bingo_sessions')
            .update({ status: 'ended' })
            .eq('status', 'active');

        // Create new session with validated_items tracking
        const validated_items = Array(items.length).fill(false);
        const { data, error } = await supabase
            .from('bingo_sessions')
            .insert({
                items: items,
                validated_items: validated_items,
                status: 'active',
                created_by: req.twitchUser.userId || 'broadcaster'
            })
            .select('id')
            .single();

        if (error) throw error;

        console.log(`🎯 Bingo session started with ${items.length} items (ID: ${data.id})`);
        res.json({ success: true, sessionId: data.id });
    } catch (error) {
        console.error('❌ Error starting bingo session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

/**
 * POST /bingo/session/end
 * End the active bingo session
 */
router.post('/session/end', requireBroadcaster, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bingo_sessions')
            .update({ status: 'ended' })
            .eq('status', 'active')
            .select()
            .single();

        if (error) throw error;

        console.log(`🎯 Bingo session ended (ID: ${data.id}), winners: ${JSON.stringify(data.winners)}`);
        res.json({ success: true, winners: data.winners });
    } catch (error) {
        console.error('❌ Error ending bingo session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

/**
 * POST /bingo/session/items
 * Update items for the active session
 */
router.post('/session/items', requireBroadcaster, async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length < 24) {
            return res.status(400).json({ error: 'Need at least 24 items' });
        }

        const { data, error } = await supabase
            .from('bingo_sessions')
            .update({ items })
            .eq('status', 'active')
            .select('id')
            .single();

        if (error) throw error;

        res.json({ success: true, sessionId: data.id });
    } catch (error) {
        console.error('❌ Error updating bingo items:', error);
        res.status(500).json({ error: 'Failed to update items' });
    }
});

/**
 * POST /bingo/session/validate
 * Broadcaster toggles an item as validated (it happened on stream)
 */
router.post('/session/validate', requireBroadcaster, async (req, res) => {
    try {
        const { itemIndex } = req.body;

        const { data: session, error: sessionError } = await supabase
            .from('bingo_sessions')
            .select('id, items, validated_items')
            .eq('status', 'active')
            .single();

        if (sessionError) return res.status(404).json({ error: 'No active session' });
        if (itemIndex === undefined || itemIndex < 0 || itemIndex >= session.items.length) {
            return res.status(400).json({ error: 'Invalid item index' });
        }

        const validated = [...(session.validated_items || Array(session.items.length).fill(false))];
        validated[itemIndex] = !validated[itemIndex];

        await supabase
            .from('bingo_sessions')
            .update({ validated_items: validated })
            .eq('id', session.id);

        const itemName = session.items[itemIndex];
        console.log(`🎯 Item ${validated[itemIndex] ? 'validated' : 'unvalidated'}: "${itemName}"`);

        res.json({ success: true, validated_items: validated });
    } catch (error) {
        console.error('❌ Error validating item:', error);
        res.status(500).json({ error: 'Failed to validate item' });
    }
});

// ==================== VIEWER ROUTES ====================

/**
 * GET /bingo/session
 * Get active session status
 */
router.get('/session', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bingo_sessions')
            .select('id, items, validated_items, status, winners, created_at')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code === 'PGRST116') {
            return res.json({ active: false });
        }
        if (error) throw error;

        res.json({
            active: true,
            sessionId: data.id,
            itemCount: data.items.length,
            winners: data.winners,
            validated_items: data.validated_items,
            createdAt: data.created_at,
            items: req.twitchUser.role === 'broadcaster' ? data.items : undefined
        });
    } catch (error) {
        console.error('❌ Error getting bingo session:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});

/**
 * GET /bingo/card
 * Get or create the viewer's bingo card for the active session
 */
router.get('/card', async (req, res) => {
    try {
        const userId = req.twitchUser.userId || req.twitchUser.opaqueUserId;

        // Get active session
        const { data: session, error: sessionError } = await supabase
            .from('bingo_sessions')
            .select('id, items, status')
            .eq('status', 'active')
            .single();

        if (sessionError && sessionError.code === 'PGRST116') {
            return res.json({ active: false });
        }
        if (sessionError) throw sessionError;

        // Check if card already exists
        const { data: existingCard } = await supabase
            .from('bingo_cards')
            .select('*')
            .eq('session_id', session.id)
            .eq('twitch_user_id', userId)
            .single();

        if (existingCard) {
            return res.json({
                active: true,
                sessionId: session.id,
                card: existingCard
            });
        }

        // Generate new card
        const grid = generateGrid(session.items);
        const checked = Array(25).fill(false);
        checked[12] = true; // Free space is always checked

        // Resolve username from Twitch API
        const twitchDisplayName = await getTwitchDisplayName(req.twitchUser.userId);

        const { data: newCard, error: insertError } = await supabase
            .from('bingo_cards')
            .insert({
                session_id: session.id,
                twitch_user_id: userId,
                twitch_username: twitchDisplayName || 'Viewer',
                grid: grid,
                checked: checked
            })
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({
            active: true,
            sessionId: session.id,
            card: newCard
        });
    } catch (error) {
        console.error('❌ Error getting bingo card:', error);
        res.status(500).json({ error: 'Failed to get card' });
    }
});

/**
 * POST /bingo/check
 * Toggle a cell on the viewer's card
 */
router.post('/check', async (req, res) => {
    try {
        const userId = req.twitchUser.userId || req.twitchUser.opaqueUserId;
        const { cellIndex } = req.body;

        if (cellIndex === undefined || cellIndex < 0 || cellIndex > 24 || cellIndex === 12) {
            return res.status(400).json({ error: 'Invalid cell index' });
        }

        // Get the card
        const { data: card, error: cardError } = await supabase
            .from('bingo_cards')
            .select('*')
            .eq('twitch_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (cardError) {
            return res.status(404).json({ error: 'No active card found' });
        }

        // Toggle the cell
        const checked = [...card.checked];
        checked[cellIndex] = !checked[cellIndex];

        // Only detect bingo, do NOT persist has_bingo here
        // The /claim route is the only one allowed to set has_bingo = true
        const hasBingo = checkBingo(checked);

        const { error: updateError } = await supabase
            .from('bingo_cards')
            .update({ checked })
            .eq('id', card.id);

        if (updateError) throw updateError;

        res.json({
            checked,
            hasBingo,
            cellIndex
        });
    } catch (error) {
        console.error('❌ Error checking bingo cell:', error);
        res.status(500).json({ error: 'Failed to check cell' });
    }
});

/**
 * POST /bingo/claim
 * Claim a bingo — verify server-side and announce
 */
router.post('/claim', async (req, res) => {
    try {
        const userId = req.twitchUser.userId || req.twitchUser.opaqueUserId;

        // Get the card with session
        const { data: card, error: cardError } = await supabase
            .from('bingo_cards')
            .select('*, bingo_sessions!inner(id, status, winners, items, validated_items)')
            .eq('twitch_user_id', userId)
            .eq('bingo_sessions.status', 'active')
            .single();

        if (cardError) {
            return res.status(404).json({ error: 'No active card found' });
        }

        // Server-side bingo verification
        if (!checkBingo(card.checked)) {
            return res.status(400).json({ error: 'Pas de bingo détecté — bien essayé ! 😏' });
        }

        // Check if already claimed
        if (card.has_bingo) {
            return res.status(400).json({ error: 'Bingo déjà réclamé !' });
        }

        // Verify that the winning line contains only broadcaster-validated items
        const session = card.bingo_sessions;
        const validatedItems = session.validated_items || [];
        const winningLines = getBingoLines(card.checked);

        // Check if at least one winning line has ALL items validated
        let validLine = false;
        for (const line of winningLines) {
            const lineItemsValidated = line.every(cellIndex => {
                if (cellIndex === 12) return true; // Free space always valid
                const itemText = card.grid[cellIndex]?.text;
                // Find this item in the session items and check if validated
                const sessionItemIndex = session.items.indexOf(itemText);
                return sessionItemIndex !== -1 && validatedItems[sessionItemIndex];
            });
            if (lineItemsValidated) { validLine = true; break; }
        }

        if (!validLine) {
            return res.status(400).json({
                error: 'Les items de ta ligne ne sont pas encore tous validés par la streameuse ! Patience 😊'
            });
        }

        // Mark card as bingo
        await supabase
            .from('bingo_cards')
            .update({ has_bingo: true })
            .eq('id', card.id);

        // Add to session winners
        const winners = [...(card.bingo_sessions.winners || [])];
        const winnerEntry = {
            userId,
            username: card.twitch_username || 'Viewer',
            position: winners.length + 1,
            time: new Date().toISOString()
        };
        winners.push(winnerEntry);

        await supabase
            .from('bingo_sessions')
            .update({ winners })
            .eq('id', card.session_id);

        console.log(`🎉 BINGO! ${winnerEntry.username} (#${winnerEntry.position})`);

        // Broadcast via PubSub to all viewers
        sendPubSubMessage(req.twitchUser.channelId, {
            type: 'bingo_winner',
            username: winnerEntry.username,
            position: winnerEntry.position
        });

        // Announce in Twitch chat via bot
        try {
            const { getTwitchClient } = require('../index');
            const twitchClient = getTwitchClient();
            if (twitchClient) {
                const channel = process.env.TWITCH_CHANNEL || 'xsgwen';
                const pos = winnerEntry.position === 1 ? '🥇' : winnerEntry.position === 2 ? '🥈' : winnerEntry.position === 3 ? '🥉' : `#${winnerEntry.position}`;
                twitchClient.say(channel,
                    `🎯 BINGO ! ${pos} ${winnerEntry.username} a fait un bingo ! GG 🎉`
                );
            }
        } catch (e) {
            console.error('Chat announce error:', e);
        }

        res.json({
            success: true,
            position: winnerEntry.position,
            message: `BINGO ! Tu es le #${winnerEntry.position} gagnant !`
        });
    } catch (error) {
        console.error('❌ Error claiming bingo:', error);
        res.status(500).json({ error: 'Failed to claim bingo' });
    }
});

// ==================== PubSub helper ====================

/**
 * Send a PubSub message to all viewers on the channel
 * Called from claim route to broadcast bingo announcements
 */
async function sendPubSubMessage(channelId, message) {
    try {
        const payload = {
            exp: Math.floor(Date.now() / 1000) + 60,
            user_id: BROADCASTER_ID,
            role: 'external',
            channel_id: channelId,
            pubsub_perms: {
                send: ['broadcast']
            }
        };

        const token = jwt.sign(payload, EXTENSION_SECRET);

        const response = await fetch('https://api.twitch.tv/helix/extensions/pubsub', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': process.env.TWITCH_EXTENSION_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: ['broadcast'],
                broadcaster_id: channelId,
                message: JSON.stringify(message)
            })
        });

        if (!response.ok) {
            console.error('❌ PubSub send failed:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ PubSub error:', error);
    }
}

module.exports = { router, sendPubSubMessage };
