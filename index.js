require('dotenv').config();
const { TwitchClient } = require('./twitch-client');
const { query, getOrCreatePlayer, initializeDatabase } = require('./db');
const { checkWord, calculatePoints } = require('./cemantix-api');
const { startServer } = require('./server');
const { gameSession, startSession, stopSession, getSessionStatus } = require('./game-controller');

// Configuration
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL?.replace('#', '') || 'xsgwen';
const TWITCH_BOT_USERNAME = process.env.TWITCH_USERNAME || 'gwenbot';

// Will be set after initialization
let TWITCH_BOT_USER_ID = process.env.TWITCH_BOT_USER_ID;
let TWITCH_BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;

// Twitch client instance
let twitchClient = null;

// === Fonctions utilitaires ===

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function loadAllRecords() {
    try {
        const currentMonth = getCurrentMonth();

        const result = await query(`
            SELECT lang, record_type, value, month FROM streamer_records
            WHERE (record_type = 'alltime' AND month IS NULL)
               OR (record_type = 'monthly' AND month = $1)
        `, [currentMonth]);

        const records = { fr_alltime: null, en_alltime: null, fr_monthly: null, en_monthly: null };

        for (const row of result.rows) {
            const key = `${row.lang}_${row.record_type}`;
            records[key] = row.value;
        }

        return records;
    } catch (error) {
        console.error('Erreur DB:', error);
        return { fr_alltime: null, en_alltime: null, fr_monthly: null, en_monthly: null };
    }
}

async function saveRecord(lang, value) {
    try {
        const currentMonth = getCurrentMonth();

        // Update or insert monthly record
        const monthlyUpdate = await query(`
            UPDATE streamer_records 
            SET value = $2, updated_at = NOW()
            WHERE lang = $1 AND record_type = 'monthly'
        `, [lang, value]);

        if (monthlyUpdate.rowCount === 0) {
            await query(`
                INSERT INTO streamer_records (lang, record_type, value, month)
                VALUES ($1, 'monthly', $2, $3)
            `, [lang, value, currentMonth]);
        } else {
            // Also update the month field
            await query(`
                UPDATE streamer_records 
                SET month = $2
                WHERE lang = $1 AND record_type = 'monthly'
            `, [lang, currentMonth]);
        }

        // Check if all-time record should be updated
        const allTimeResult = await query(`
            SELECT value FROM streamer_records
            WHERE lang = $1 AND record_type = 'alltime'
        `, [lang]);

        const currentAllTime = allTimeResult.rows[0]?.value;
        let updatedAllTime = false;

        if (currentAllTime === undefined || value < currentAllTime) {
            const allTimeUpdate = await query(`
                UPDATE streamer_records 
                SET value = $2, updated_at = NOW()
                WHERE lang = $1 AND record_type = 'alltime'
            `, [lang, value]);

            if (allTimeUpdate.rowCount === 0) {
                await query(`
                    INSERT INTO streamer_records (lang, record_type, value, month)
                    VALUES ($1, 'alltime', $2, NULL)
                `, [lang, value]);
            }
            updatedAllTime = true;
        }

        return { success: true, updatedAllTime };
    } catch (error) {
        console.error('Erreur DB:', error);
        return { success: false, updatedAllTime: false };
    }
}

function formatRecord(value, lang = 'fr') {
    if (value === null) {
        return 'Aucun record';
    }
    if (lang === 'en') {
        return `${value} shot${value > 1 ? 's' : ''}`;
    }
    return `${value} tentative${value > 1 ? 's' : ''}`;
}

function isModerator(msg) {
    return msg.isMod || msg.isBroadcaster || msg.isVip;
}

// Channel emotes - loaded dynamically from Twitch API
let channelEmotes = ['xsgwenLove', 'xsgwenOuin', 'xsgwenWow', 'xsgwenSip', 'xsgwenLol', 'xsgwenHype', 'xsgwenHug']; // Fallback

// Load channel emotes from Twitch API
async function loadChannelEmotes() {
    if (!twitchClient) return;

    try {
        const emotes = await twitchClient.getChannelEmotes();
        if (emotes.length > 0) {
            channelEmotes = emotes;
            console.log(`😀 Channel emotes: ${emotes.slice(0, 5).join(', ')}${emotes.length > 5 ? '...' : ''}`);
        }
    } catch (error) {
        console.error('Error loading channel emotes:', error);
    }
}

// Extract custom emotes from a message
function extractEmotes(text) {
    const found = [];
    for (const emote of channelEmotes) {
        if (text.includes(emote)) {
            // Count occurrences
            const regex = new RegExp(emote, 'g');
            const matches = text.match(regex);
            if (matches) {
                found.push(...matches);
            }
        }
    }
    return found;
}

// === Stream Monitoring & Presence Tracking ===
let currentStreamId = null;
let currentTwitchStreamId = null;

async function getTwitchToken() {
    return await twitchClient.getAppAccessToken();
}

async function checkStreamStatus() {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return;

    const token = await getTwitchToken();
    if (!token) return;

    try {
        const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        const isLive = data.data && data.data.length > 0;
        const stream = isLive ? data.data[0] : null;

        if (isLive && stream) {
            const twitchStreamId = stream.id;

            if (currentTwitchStreamId !== twitchStreamId) {
                await handleStreamStart(stream);
            } else {
                await updateStreamStats(stream);
            }
        } else if (currentStreamId) {
            await handleStreamEnd();
        }
    } catch (error) {
        console.error('Stream check error:', error);
    }
}

async function handleStreamStart(stream) {
    console.log(`🔴 Stream started: ${stream.title}`);
    currentTwitchStreamId = stream.id;

    try {
        const result = await query(`
            INSERT INTO twitch_streams (twitch_stream_id, title, game_name, started_at, peak_viewers)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (twitch_stream_id) DO UPDATE SET
                title = $2, game_name = $3, peak_viewers = GREATEST(twitch_streams.peak_viewers, $5)
            RETURNING id
        `, [stream.id, stream.title, stream.game_name, stream.started_at, stream.viewer_count]);

        currentStreamId = result.rows[0].id;
        console.log(`📊 Stream session created: ID ${currentStreamId}`);

        // Start polling chatters for watch time
        startChatterPolling();
    } catch (error) {
        console.error('Error creating stream session:', error);
    }
}

async function handleStreamEnd() {
    console.log('⚫ Stream ended');

    try {
        await query(`
            UPDATE twitch_streams 
            SET ended_at = NOW(),
                total_chatters = (SELECT COUNT(DISTINCT player_id) FROM viewer_presence WHERE stream_id = $1)
            WHERE id = $1
        `, [currentStreamId]);

        console.log(`📊 Stream session ${currentStreamId} closed`);
    } catch (error) {
        console.error('Error closing stream session:', error);
    }

    currentStreamId = null;
    currentTwitchStreamId = null;

    // Stop polling chatters
    stopChatterPolling();
}

async function updateStreamStats(stream) {
    if (!currentStreamId) return;

    try {
        await query(`
            UPDATE twitch_streams 
            SET peak_viewers = GREATEST(peak_viewers, $2),
                title = $3,
                game_name = $4
            WHERE id = $1
        `, [currentStreamId, stream.viewer_count, stream.title, stream.game_name]);
    } catch (error) {
        console.error('Error updating stream stats:', error);
    }
}

async function trackViewerPresence(playerId) {
    if (!currentStreamId) return;

    try {
        await query(`
            INSERT INTO viewer_presence (stream_id, player_id, first_seen, last_seen, message_count)
            VALUES ($1, $2, NOW(), NOW(), 1)
            ON CONFLICT (stream_id, player_id) DO UPDATE SET
                last_seen = NOW(),
                message_count = viewer_presence.message_count + 1
        `, [currentStreamId, playerId]);
    } catch (error) {
        console.error('Error tracking presence:', error);
    }
}

// Poll chatters every 60 seconds to track watch time accurately
let chatterPollingInterval = null;

async function pollChatters() {
    if (!currentStreamId || !twitchClient) return;

    try {
        const chatters = await twitchClient.getChatters();

        if (chatters.length === 0) return;

        console.log(`👥 Polling ${chatters.length} chatters for watch time...`);

        for (const chatter of chatters) {
            try {
                // Get or create player
                const playerId = await getOrCreatePlayer(chatter.user_login);

                // Update presence - this will track their watch time
                await query(`
                    INSERT INTO viewer_presence (stream_id, player_id, first_seen, last_seen, message_count)
                    VALUES ($1, $2, NOW(), NOW(), 0)
                    ON CONFLICT (stream_id, player_id) DO UPDATE SET
                        last_seen = NOW()
                `, [currentStreamId, playerId]);
            } catch (err) {
                // Ignore individual errors, continue with other chatters
            }
        }
    } catch (error) {
        console.error('Error polling chatters:', error);
    }
}

function startChatterPolling() {
    if (chatterPollingInterval) return;

    console.log('👥 Chatter polling started (every 60s)');
    pollChatters(); // Initial poll
    chatterPollingInterval = setInterval(pollChatters, 60000); // Every 60 seconds
}

function stopChatterPolling() {
    if (chatterPollingInterval) {
        clearInterval(chatterPollingInterval);
        chatterPollingInterval = null;
        console.log('👥 Chatter polling stopped');
    }
}

function startStreamMonitoring() {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        console.log('⚠️ Twitch credentials not found, stream monitoring disabled');
        return;
    }

    console.log('📺 Stream monitoring started');
    checkStreamStatus();
    setInterval(checkStreamStatus, 30000);
}

// === Message Handler ===
async function handleMessage(msg) {
    // Skip own messages
    if (msg.self) return;

    const trimmedMessage = msg.message.trim();
    const username = msg.username;

    // Track all messages in database
    try {
        const playerId = await getOrCreatePlayer(username);
        const emotes = extractEmotes(msg.message);
        await query(
            'INSERT INTO chat_messages (player_id, content, emojis) VALUES ($1, $2, $3)',
            [playerId, msg.message, emotes.length > 0 ? emotes : null]
        );

        // Track viewer presence for watch time stats
        await trackViewerPresence(playerId);
    } catch (err) {
        console.error('Error tracking message:', err);
    }

    // === Check for commands (start with !) ===
    if (trimmedMessage.startsWith('!')) {
        const args = trimmedMessage.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // === Commande publique: !site ===
        if (command === 'site') {
            twitchClient.say(msg.channel, `🌐 Site: https://www.xsgwen.fr`);
            return;
        }

        // === Commande publique: !pileouface ===
        if (command === 'pileouface' || command === 'flip' || command === 'coin') {
            const result = Math.random() < 0.5 ? '🪙 Pile !' : '🪙 Face !';
            twitchClient.say(msg.channel, `@${msg.username} ${result}`);
            return;
        }

        // === Commande mod: !announce <message> [color] ===
        if (command === 'announce' || command === 'annonce') {
            if (!isModerator(msg)) {
                twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent faire des annonces !`);
                return;
            }

            if (args.length === 0) {
                twitchClient.say(msg.channel, `@${msg.username} Utilisation: !announce <message> [blue/green/orange/purple]`);
                return;
            }

            // Check if last arg is a color
            const validColors = ['blue', 'green', 'orange', 'purple', 'primary'];
            const lastArg = args[args.length - 1].toLowerCase();
            let color = 'primary';
            let message;

            if (validColors.includes(lastArg)) {
                color = lastArg;
                message = args.slice(0, -1).join(' ');
            } else {
                message = args.join(' ');
            }

            if (!message) {
                twitchClient.say(msg.channel, `@${msg.username} Le message ne peut pas être vide !`);
                return;
            }

            await twitchClient.sendAnnouncement(message, color);
            return;
        }

        // === Commande publique: !clip [titre] ===
        if (command === 'clip') {
            const title = args.length > 0 ? args.join(' ') : null;

            twitchClient.say(msg.channel, `@${msg.username} 🎬 Création du clip en cours...`);

            const clip = await twitchClient.createClip(title);

            if (clip) {
                twitchClient.say(msg.channel, `@${msg.username} ✅ Clip créé ! Éditer: ${clip.editUrl}`);
            } else {
                twitchClient.say(msg.channel, `@${msg.username} ❌ Impossible de créer le clip. Le stream doit être en live !`);
            }
            return;
        }

        // === Commande publique: !stats ===
        if (command === 'stats') {
            try {
                const targetUser = args[0]?.replace('@', '').toLowerCase() || username;
                const playerResult = await query('SELECT id FROM players WHERE username = $1', [targetUser]);

                if (playerResult.rows.length === 0) {
                    twitchClient.say(msg.channel, `@${msg.username} Aucune stat trouvée pour ${targetUser}`);
                    return;
                }

                const playerId = playerResult.rows[0].id;

                // Get cemantix stats
                const statsResult = await query(`
                    SELECT total_points, games_played FROM player_stats WHERE player_id = $1
                `, [playerId]);

                // Get message count
                const msgResult = await query('SELECT COUNT(*) FROM chat_messages WHERE player_id = $1', [playerId]);

                const cemantixPoints = statsResult.rows[0]?.total_points || 0;
                const gamesPlayed = statsResult.rows[0]?.games_played || 0;
                const messages = parseInt(msgResult.rows[0]?.count) || 0;

                twitchClient.say(msg.channel, `📊 ${targetUser} → ${messages} messages | Cemantix: ${cemantixPoints} pts (${gamesPlayed} parties)`);
            } catch (err) {
                console.error('Stats command error:', err);
            }
            return;
        }


        // === Commande unifiée: !cemantix [action] [params] ===
        if (command === 'cemantix') {
            const action = args[0]?.toLowerCase();

            // !cemantix (sans argument) = affiche le site
            if (!action) {
                twitchClient.say(msg.channel, `🌐 Site: https://www.xsgwen.fr/cemantix (Leaderboard & Stats)`);
                return;
            }

            // === !cemantix start [fr/en] ===
            if (action === 'start' || action === 'go') {
                if (!isModerator(msg)) {
                    twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent lancer une session !`);
                    return;
                }

                if (gameSession.active) {
                    twitchClient.say(msg.channel, `@${msg.username} Une session est déjà en cours !`);
                    return;
                }

                const lang = args[1]?.toLowerCase() === 'en' ? 'en' : 'fr';
                const gameName = lang === 'en' ? 'Cemantle' : 'Cémantix';

                // Create session in database
                const sessionResult = await query(`
                    INSERT INTO game_sessions (lang, started_at)
                    VALUES ($1, NOW())
                    RETURNING id
                `, [lang]);
                const sessionId = sessionResult.rows[0].id;

                // Initialize session
                gameSession.active = true;
                gameSession.lang = lang;
                gameSession.sessionId = sessionId;
                gameSession.guessedWords = new Set();
                gameSession.startTime = Date.now();
                gameSession.found = false;
                gameSession.winner = null;
                gameSession.winningWord = null;

                // Send announcement for Cemantix start
                await twitchClient.sendAnnouncement(
                    `🎮 Session ${gameName} lancée ! Écrivez un mot seul dans le chat pour le tester. Bonne chance à tous !`,
                    'purple'
                );
                return;
            }

            // === !cemantix stop ===
            if (action === 'stop') {
                if (!isModerator(msg)) {
                    twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent arrêter une session !`);
                    return;
                }

                if (!gameSession.active) {
                    twitchClient.say(msg.channel, `@${msg.username} Aucune session en cours.`);
                    return;
                }

                await endGameSession(msg.channel);
                return;
            }

            // === !cemantix update [fr/en] <score> ===
            if (action === 'update' || action === 'record') {
                if (!isModerator(msg)) {
                    twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent modifier les records !`);
                    return;
                }

                const lang = args[1]?.toLowerCase();
                const value = parseInt(args[2]);

                if (!lang || (lang !== 'fr' && lang !== 'en')) {
                    twitchClient.say(msg.channel, `@${msg.username} Utilisation: !cemantix update [fr/en] <score>`);
                    return;
                }

                if (isNaN(value) || value < 1) {
                    twitchClient.say(msg.channel, `@${msg.username} Utilisation: !cemantix update [fr/en] <score>`);
                    return;
                }

                const result = await saveRecord(lang, value);
                if (result.success) {
                    const gameName = lang === 'en' ? 'EN' : 'FR';
                    let response = `@${msg.username} Record ${gameName} du mois: ${value} tentative${value > 1 ? 's' : ''}`;
                    if (result.updatedAllTime) {
                        response += ` 🏆 Nouveau record all-time !`;
                    }
                    twitchClient.say(msg.channel, response);
                } else {
                    twitchClient.say(msg.channel, `@${msg.username} Erreur lors de la sauvegarde.`);
                }
                return;
            }

            // === !cemantix reset ===
            if (action === 'reset') {
                if (!isModerator(msg)) {
                    twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent réinitialiser le leaderboard !`);
                    return;
                }

                await query('DELETE FROM player_stats');
                await query('DELETE FROM session_guesses');
                twitchClient.say(msg.channel, `🗑️ Leaderboard global réinitialisé !`);
                return;
            }

            // === !cemantix top ===
            if (action === 'top' || action === 'leaderboard') {
                try {
                    const topResult = await query(`
                        SELECT p.username, ps.total_points
                        FROM player_stats ps
                        JOIN players p ON ps.player_id = p.id
                        ORDER BY ps.total_points DESC
                        LIMIT 5
                    `);

                    if (topResult.rows.length === 0) {
                        twitchClient.say(msg.channel, `🏆 Leaderboard vide pour l'instant !`);
                        return;
                    }

                    const topList = topResult.rows.map((r, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        return `${medal} ${r.username} (${r.total_points} pts)`;
                    }).join(' | ');

                    twitchClient.say(msg.channel, `🏆 Top Cemantix: ${topList}`);
                } catch (err) {
                    console.error('Top command error:', err);
                }
                return;
            }

            // Action inconnue
            twitchClient.say(msg.channel, `@${msg.username} Actions: start [fr/en], stop, update [fr/en] <score>, reset, top`);
            return;
        }

        return; // Unknown command, do nothing
    }

    // === Game session: detect single words ===
    if (!gameSession.active) return;
    if (gameSession.found) return;

    // Check if message is a single word
    const wordMatch = trimmedMessage.match(/^[a-zA-ZàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ-]+$/);
    if (!wordMatch) return;

    const word = trimmedMessage.toLowerCase();

    // Skip if word was already guessed
    if (gameSession.guessedWords.has(word)) {
        return;
    }

    // Check the word against Cemantix API
    const result = await checkWord(word, gameSession.lang);

    if (result.error === 'INVALID_WORD') {
        return;
    }

    if (result.error) {
        console.error(`API error for word "${word}":`, result.error);
        return;
    }

    // Valid word! Add to guessed set
    gameSession.guessedWords.add(word);

    // Calculate degree and points
    const degree = Math.round(result.score * 100);
    const isWinner = result.score >= 0.9999;
    const points = calculatePoints(result.score, isWinner);

    // Store guess in database
    const playerId = await getOrCreatePlayer(username);
    await query(`
        INSERT INTO session_guesses (session_id, player_id, word, score, degree, points)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [gameSession.sessionId, playerId, word, result.score, degree, points]);

    // If winner found
    if (isWinner) {
        gameSession.found = true;
        gameSession.winner = username;
        gameSession.winningWord = word;
    }
}

// === End game session and show recap ===
async function endGameSession(channel) {
    const gameName = gameSession.lang === 'en' ? 'Cemantle' : 'Cémantix';
    const duration = Math.round((Date.now() - gameSession.startTime) / 1000);
    const guessCount = gameSession.guessedWords.size;
    const winner = gameSession.winner;
    const winningWord = gameSession.winningWord;
    const sessionId = gameSession.sessionId;

    // Get winner player ID
    let winnerId = null;
    if (winner) {
        winnerId = await getOrCreatePlayer(winner);
    }

    // Get all guesses from this session with aggregated points per player
    const guessesResult = await query(`
        SELECT p.username, p.id as player_id, SUM(sg.points) as total_points
        FROM session_guesses sg
        JOIN players p ON sg.player_id = p.id
        WHERE sg.session_id = $1
        GROUP BY p.id, p.username
        ORDER BY total_points DESC
    `, [sessionId]);

    const sessionPoints = {};
    for (const row of guessesResult.rows) {
        sessionPoints[row.username] = parseInt(row.total_points);
    }

    // Update session in database
    await query(`
        UPDATE game_sessions
        SET word = $1, winner_id = $2, duration = $3, guess_count = $4, player_count = $5, ended_at = NOW()
        WHERE id = $6
    `, [winningWord, winnerId, duration, guessCount, Object.keys(sessionPoints).length, sessionId]);

    // Update player stats
    for (const [username, points] of Object.entries(sessionPoints)) {
        const playerId = await getOrCreatePlayer(username);

        // Upsert player stats
        await query(`
            INSERT INTO player_stats (player_id, games_played, total_points, best_session_score, words_found)
            VALUES ($1, 1, $2, $2, $3)
            ON CONFLICT (player_id) DO UPDATE SET
                games_played = player_stats.games_played + 1,
                total_points = player_stats.total_points + $2,
                best_session_score = GREATEST(player_stats.best_session_score, $2),
                words_found = player_stats.words_found + $3
        `, [playerId, points, username === winner ? 1 : 0]);
    }

    // Sort by points for display
    const sortedPlayers = Object.entries(sessionPoints)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Reset session state
    gameSession.active = false;
    gameSession.sessionId = null;
    gameSession.guessedWords = new Set();
    gameSession.found = false;
    gameSession.winner = null;
    gameSession.winningWord = null;

    // Build recap message
    let minutes = Math.floor(duration / 60);
    let seconds = duration % 60;
    let durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    if (winner) {
        twitchClient.say(channel, `🎉🏆 @${winner} a trouvé le mot "${winningWord}" ! Trouvé en ${guessCount} essais (${durationStr})`);
    } else {
        twitchClient.say(channel, `🎮 Session ${gameName} arrêtée. ${guessCount} mots testés en ${durationStr}`);
    }

    // Show top players
    if (sortedPlayers.length > 0) {
        const topStr = sortedPlayers
            .map((p, i) => `${i + 1}. ${p[0]}: ${p[1]} pts`)
            .join(' | ');
        twitchClient.say(channel, `🏆 Top joueurs: ${topStr}`);
    }
}

// === Initialization ===
async function initializeTwitchClient() {
    // Get user IDs if not provided in env
    const tempClient = new TwitchClient({
        clientId: TWITCH_CLIENT_ID,
        clientSecret: TWITCH_CLIENT_SECRET,
        botUserId: TWITCH_BOT_USER_ID,
        broadcasterUserId: TWITCH_BROADCASTER_ID,
        channel: TWITCH_CHANNEL
    });

    // Get IDs if not set
    if (!TWITCH_BOT_USER_ID) {
        await tempClient.getAppAccessToken();
        TWITCH_BOT_USER_ID = await tempClient.getUserId(TWITCH_BOT_USERNAME);
        console.log(`🤖 Bot user ID: ${TWITCH_BOT_USER_ID}`);
    }

    if (!TWITCH_BROADCASTER_ID) {
        TWITCH_BROADCASTER_ID = await tempClient.getUserId(TWITCH_CHANNEL);
        console.log(`📺 Broadcaster user ID: ${TWITCH_BROADCASTER_ID}`);
    }

    // Create actual client with IDs
    twitchClient = new TwitchClient({
        clientId: TWITCH_CLIENT_ID,
        clientSecret: TWITCH_CLIENT_SECRET,
        botUserId: TWITCH_BOT_USER_ID,
        broadcasterUserId: TWITCH_BROADCASTER_ID,
        channel: TWITCH_CHANNEL
    });

    // Set up event handlers
    twitchClient.on('message', handleMessage);

    twitchClient.on('disconnected', () => {
        console.log('❌ Bot disconnected from Twitch');
    });

    return twitchClient;
}

// === Start ===
async function start() {
    // Validate environment
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        console.error('❌ Variables TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET requises dans .env');
        process.exit(1);
    }

    if (!TWITCH_CHANNEL) {
        console.error('❌ Variable TWITCH_CHANNEL requise dans .env');
        process.exit(1);
    }

    // Initialize database
    await initializeDatabase();

    // Initialize Twitch client
    await initializeTwitchClient();

    // Start web server (passing twitchClient for bot auth routes)
    startServer(twitchClient);

    // Start stream monitoring
    startStreamMonitoring();

    // Connect to Twitch EventSub
    try {
        await twitchClient.connect();
        console.log('✅ GwenBot connecté à Twitch (EventSub API)');

        // Load channel emotes from API
        await loadChannelEmotes();
    } catch (error) {
        console.error('❌ Erreur de connexion à Twitch:', error);
        console.log('⚠️ Le bot continuera sans connexion au chat. Veuillez autoriser le bot via /auth/bot-authorize');
    }
}

// Export for server
module.exports = { getTwitchClient: () => twitchClient };

start();
