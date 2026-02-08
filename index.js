require('dotenv').config();
const { TwitchClient } = require('./twitch-client');
const { supabase, getOrCreatePlayer, initializeDatabase } = require('./db');
const { checkWord, calculatePoints } = require('./cemantix-api');
const { startServer } = require('./server');
const { gameSession, startSession, stopSession, getSessionStatus } = require('./game-controller');
const embeddings = require('./utils/word2vec-embeddings');
const { signRequest } = require('./utils/hmac');
const path = require('path');
const { initDiscordClient, getSpotifyActivity, isDiscordReady, startDebugPolling } = require('./discord-client');

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

        // Get all records
        const { data: result, error } = await supabase
            .from('streamer_records')
            .select('lang, record_type, value, month');

        if (error) throw error;

        const records = { fr_alltime: null, en_alltime: null, fr_monthly: null, en_monthly: null };

        for (const row of result || []) {
            // Filter: alltime has no month, monthly matches current month
            if (row.record_type === 'alltime' && row.month === null) {
                records[`${row.lang}_alltime`] = row.value;
            } else if (row.record_type === 'monthly' && row.month === currentMonth) {
                records[`${row.lang}_monthly`] = row.value;
            }
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

        // Check if monthly record exists
        const { data: monthlyExisting } = await supabase
            .from('streamer_records')
            .select('id')
            .eq('lang', lang)
            .eq('record_type', 'monthly')
            .single();

        if (monthlyExisting) {
            await supabase
                .from('streamer_records')
                .update({ value, month: currentMonth, updated_at: new Date().toISOString() })
                .eq('lang', lang)
                .eq('record_type', 'monthly');
        } else {
            await supabase
                .from('streamer_records')
                .insert({ lang, record_type: 'monthly', value, month: currentMonth });
        }

        // Check if all-time record should be updated
        const { data: allTimeResult } = await supabase
            .from('streamer_records')
            .select('value')
            .eq('lang', lang)
            .eq('record_type', 'alltime')
            .single();

        const currentAllTime = allTimeResult?.value;
        let updatedAllTime = false;

        if (currentAllTime === undefined || currentAllTime === null || value < currentAllTime) {
            const { data: allTimeExisting } = await supabase
                .from('streamer_records')
                .select('id')
                .eq('lang', lang)
                .eq('record_type', 'alltime')
                .single();

            if (allTimeExisting) {
                await supabase
                    .from('streamer_records')
                    .update({ value, updated_at: new Date().toISOString() })
                    .eq('lang', lang)
                    .eq('record_type', 'alltime');
            } else {
                await supabase
                    .from('streamer_records')
                    .insert({ lang, record_type: 'alltime', value, month: null });
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
        // Try to get existing stream or insert new one
        const { data: existing } = await supabase
            .from('twitch_streams')
            .select('id, peak_viewers')
            .eq('twitch_stream_id', stream.id)
            .single();

        if (existing) {
            // Update existing
            const newPeak = Math.max(existing.peak_viewers || 0, stream.viewer_count || 0);
            await supabase
                .from('twitch_streams')
                .update({ title: stream.title, game_name: stream.game_name, peak_viewers: newPeak })
                .eq('id', existing.id);
            currentStreamId = existing.id;
        } else {
            // Insert new
            const { data: newStream } = await supabase
                .from('twitch_streams')
                .insert({
                    twitch_stream_id: stream.id,
                    title: stream.title,
                    game_name: stream.game_name,
                    started_at: stream.started_at,
                    peak_viewers: stream.viewer_count || 0
                })
                .select('id')
                .single();
            currentStreamId = newStream?.id;
        }

        console.log(`📊 Stream session created: ID ${currentStreamId}`);
        startChatterPolling();
    } catch (error) {
        console.error('Error creating stream session:', error);
    }
}

async function handleStreamEnd() {
    console.log('⚫ Stream ended');

    try {
        // Get count of unique chatters
        const { count: chatterCount } = await supabase
            .from('viewer_presence')
            .select('player_id', { count: 'exact', head: true })
            .eq('stream_id', currentStreamId);

        await supabase
            .from('twitch_streams')
            .update({
                ended_at: new Date().toISOString(),
                total_chatters: chatterCount || 0
            })
            .eq('id', currentStreamId);

        console.log(`📊 Stream session ${currentStreamId} closed`);
    } catch (error) {
        console.error('Error closing stream session:', error);
    }

    currentStreamId = null;
    currentTwitchStreamId = null;
    stopChatterPolling();
}

async function updateStreamStats(stream) {
    if (!currentStreamId) return;

    try {
        // Get current peak to compare
        const { data: current } = await supabase
            .from('twitch_streams')
            .select('peak_viewers')
            .eq('id', currentStreamId)
            .single();

        const newPeak = Math.max(current?.peak_viewers || 0, stream.viewer_count || 0);

        await supabase
            .from('twitch_streams')
            .update({
                peak_viewers: newPeak,
                title: stream.title,
                game_name: stream.game_name
            })
            .eq('id', currentStreamId);
    } catch (error) {
        console.error('Error updating stream stats:', error);
    }
}

async function trackViewerPresence(playerId) {
    if (!currentStreamId) return;

    try {
        // Check if presence exists
        const { data: existing } = await supabase
            .from('viewer_presence')
            .select('id, message_count')
            .eq('stream_id', currentStreamId)
            .eq('player_id', playerId)
            .single();

        if (existing) {
            await supabase
                .from('viewer_presence')
                .update({
                    last_seen: new Date().toISOString(),
                    message_count: (existing.message_count || 0) + 1
                })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('viewer_presence')
                .insert({
                    stream_id: currentStreamId,
                    player_id: playerId,
                    first_seen: new Date().toISOString(),
                    last_seen: new Date().toISOString(),
                    message_count: 1
                });
        }
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
                const playerId = await getOrCreatePlayer(chatter.user_login);

                // Check if presence exists
                const { data: existing } = await supabase
                    .from('viewer_presence')
                    .select('id, watch_time_seconds')
                    .eq('stream_id', currentStreamId)
                    .eq('player_id', playerId)
                    .single();

                if (existing) {
                    // Increment watch_time_seconds by 60 (polling interval)
                    await supabase
                        .from('viewer_presence')
                        .update({
                            last_seen: new Date().toISOString(),
                            watch_time_seconds: (existing.watch_time_seconds || 0) + 60
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('viewer_presence')
                        .insert({
                            stream_id: currentStreamId,
                            player_id: playerId,
                            first_seen: new Date().toISOString(),
                            last_seen: new Date().toISOString(),
                            message_count: 0,
                            watch_time_seconds: 60 // First poll counts as 60s
                        });
                }
            } catch (err) {
                // Ignore individual errors
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

        // Extract badge set_ids (broadcaster, moderator, vip, subscriber, etc.)
        const badgeIds = msg.badges?.map(b => b.set_id) || [];

        await supabase
            .from('chat_messages')
            .insert({
                player_id: playerId,
                content: msg.message,
                emojis: emotes.length > 0 ? emotes : null,
                badges: badgeIds.length > 0 ? badgeIds : null,
                color: msg.color || null
            });

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

        // === Commande humoristique: !rot ===
        if (command === 'rot') {
            // Check cooldown (5 minutes = 300000ms)
            const now = Date.now();
            const lastRotTime = global.lastRotTime || 0;
            const cooldownMs = 5 * 60 * 1000; // 5 minutes

            if (now - lastRotTime < cooldownMs) {
                const remainingSeconds = Math.ceil((cooldownMs - (now - lastRotTime)) / 1000);
                const mins = Math.floor(remainingSeconds / 60);
                const secs = remainingSeconds % 60;
                twitchClient.say(msg.channel, `@${msg.username} Attends encore ${mins}m${secs}s avant le prochain rôt. (anti-spam)`);
                return;
            }

            // Increment counter
            global.rotCount = (global.rotCount || 0) + 1;
            global.lastRotTime = now;
            global.lastRotUser = msg.username;

            // Save to database
            try {
                await supabase
                    .from('counters')
                    .upsert({ name: 'rot', value: global.rotCount }, { onConflict: 'name' });
            } catch (e) {
                console.error('Failed to save rot counter:', e);
            }

            const emotes = ['xsgwenLol', 'xsgwenWow', 'xsgwenSip'];
            const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];
            twitchClient.say(msg.channel, `Oups, à tes souhaits Gwen 🥴 Rôt n°${global.rotCount} entré par ${msg.username} ${randomEmote || ''} (Écris !annuler si tu t'es trompé).`);
            return;
        }

        // === Commande humoristique: !annuler (annule le dernier rôt) ===
        if (command === 'annuler') {
            // Check if there was a recent rot by this user
            if (!global.lastRotTime || !global.lastRotUser) {
                twitchClient.say(msg.channel, `@${msg.username} Rien à annuler !`);
                return;
            }

            const now = Date.now();
            const timeSinceRot = now - global.lastRotTime;
            const maxAnnulTime = 30 * 1000; // 30 seconds to annul

            if (timeSinceRot > maxAnnulTime) {
                twitchClient.say(msg.channel, `@${msg.username} Trop tard pour annuler ! (max 30s après un rôt)`);
                return;
            }

            if (global.lastRotUser !== msg.username) {
                twitchClient.say(msg.channel, `@${msg.username} Tu ne peux annuler que ton propre rôt !`);
                return;
            }

            // Decrement counter
            global.rotCount = Math.max(0, (global.rotCount || 0) - 1);
            global.lastRotTime = null;
            global.lastRotUser = null;

            // Save to database
            try {
                await supabase
                    .from('counters')
                    .upsert({ name: 'rot', value: global.rotCount }, { onConflict: 'name' });
            } catch (e) {
                console.error('Failed to save rot counter:', e);
            }

            twitchClient.say(msg.channel, `@${msg.username} Rôt annulé ! Compteur: ${global.rotCount}`);
            return;
        }

        // === Commande mod: !titre <nouveau titre> ===
        if (command === 'titre') {
            // Only mods and broadcaster
            if (!isModerator(msg)) {
                twitchClient.say(msg.channel, `@${msg.username} Tu dois être mod pour utiliser cette commande.`);
                return;
            }

            const newTitle = args.join(' ').trim();
            if (!newTitle) {
                twitchClient.say(msg.channel, `@${msg.username} Utilisation: !titre <nouveau titre>`);
                return;
            }

            const success = await twitchClient.updateChannelInfo(newTitle, null);
            if (success) {
                twitchClient.say(msg.channel, `📝 Titre mis à jour: ${newTitle}`);
            } else {
                twitchClient.say(msg.channel, `@${msg.username} Erreur lors de la mise à jour du titre.`);
            }
            return;
        }

        // === Commande mod: !jeu <catégorie> ===
        if (command === 'jeu' || command === 'game') {
            // Only mods and broadcaster
            if (!isModerator(msg)) {
                twitchClient.say(msg.channel, `@${msg.username} Tu dois être mod pour utiliser cette commande.`);
                return;
            }

            const query = args.join(' ').trim();
            if (!query) {
                twitchClient.say(msg.channel, `@${msg.username} Utilisation: !jeu <catégorie>`);
                return;
            }

            // Search for the category
            const categories = await twitchClient.searchCategories(query);
            if (categories.length === 0) {
                twitchClient.say(msg.channel, `@${msg.username} Aucune catégorie trouvée pour "${query}".`);
                return;
            }

            // Use the first result
            const category = categories[0];
            const success = await twitchClient.updateChannelInfo(null, category.id);
            if (success) {
                twitchClient.say(msg.channel, `🎮 Catégorie mise à jour: ${category.name}`);
            } else {
                twitchClient.say(msg.channel, `@${msg.username} Erreur lors de la mise à jour de la catégorie.`);
            }
            return;
        }

        // === Commande publique: !guess <mot> (Cemantig) ===
        if (command === 'guess' || command === 'g') {
            const word = args[0]?.toLowerCase().trim();

            if (!word) {
                twitchClient.say(msg.channel, `@${msg.username} Utilisation: !guess <mot>`);
                return;
            }

            // Check if embeddings are loaded
            if (!embeddings.loaded) {
                twitchClient.say(msg.channel, `@${msg.username} Cemantig n'est pas encore prêt, réessaie dans quelques secondes.`);
                return;
            }

            // Check if there's an active session
            try {
                const statusRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/cemantig/status`);
                const status = await statusRes.json();

                if (!status.active) {
                    twitchClient.say(msg.channel, `@${msg.username} Pas de session Cemantig en cours !`);
                    return;
                }

                // Check if word exists in vocabulary
                if (!embeddings.hasWord(word)) {
                    twitchClient.say(msg.channel, `@${msg.username} "${word}" n'est pas dans mon vocabulaire.`);
                    return;
                }

                // Get secret word from a separate endpoint (bot needs to know it)
                // Use HMAC signature for authentication
                const secretPayload = { action: 'get_secret' };
                const secretAuth = signRequest(secretPayload, process.env.BOT_SECRET || '');
                const secretRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/cemantig/secret`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-timestamp': secretAuth.timestamp.toString(),
                        'x-signature': secretAuth.signature
                    },
                    body: JSON.stringify(secretPayload)
                });
                const secretData = await secretRes.json();

                if (!secretData.secret_word) {
                    twitchClient.say(msg.channel, `@${msg.username} Erreur: impossible de récupérer le mot secret.`);
                    return;
                }

                // Calculate similarity locally using word2vec
                const similarity = embeddings.getSimilarity(word, secretData.secret_word);

                // Send to API to save with HMAC signature
                const guessPayload = { username, word, similarity };
                const guessAuth = signRequest(guessPayload, process.env.BOT_SECRET || '');
                const guessRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/cemantig/guess`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-timestamp': guessAuth.timestamp.toString(),
                        'x-signature': guessAuth.signature
                    },
                    body: JSON.stringify(guessPayload)
                });
                const guessData = await guessRes.json();

                if (guessData.already_guessed) {
                    // Don't respond for already guessed words - let the site handle it
                    return;
                }

                // Only announce the winner in chat
                if (guessData.is_winner) {
                    twitchClient.say(msg.channel, `🎉 BRAVO @${msg.username} ! "${word}" était le mot secret ! 🎉`);
                }
                // Normal guesses: no chat response, let the site display everything
            } catch (error) {
                console.error('Cemantig guess error:', error);
                // Only respond on actual errors, not for normal flow
            }
            return;
        }

        // === Commande publique: !dessin <mot> (Pictionary) ===
        if (command === 'dessin' || command === 'd' || command === 'draw') {
            const guess = args.join(' ').toLowerCase().trim();

            if (!guess) {
                twitchClient.say(msg.channel, `@${msg.username} Utilisation: !dessin <mot>`);
                return;
            }

            console.log(`[PICTIONARY BOT] Guess from ${username}: "${guess}"`);

            try {
                // Find any active Pictionary game
                const currentRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/pictionary/current`, { cache: 'no-store' });
                const currentData = await currentRes.json();

                console.log(`[PICTIONARY BOT] Current game:`, JSON.stringify(currentData, null, 2));

                if (!currentData.active || !currentData.game) {
                    console.log(`[PICTIONARY BOT] ❌ REJECT: No active game (active=${currentData.active}, game=${!!currentData.game})`);
                    twitchClient.say(msg.channel, `@${msg.username} Pas de partie Pictionary en cours !`);
                    return;
                }

                if (!currentData.game.hasWord) {
                    console.log(`[PICTIONARY BOT] ❌ REJECT: Game active but no word set yet (drawer is choosing)`);
                    return;
                }

                const gameId = currentData.game.id;

                // Send guess to API
                const guessRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/pictionary/guess`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId, username, guess })
                });
                const guessData = await guessRes.json();

                console.log(`[PICTIONARY BOT] Guess result:`, JSON.stringify(guessData, null, 2));

                if (guessData.correct) {
                    console.log(`[PICTIONARY BOT] ✅ CORRECT! Word: "${guessData.word}", Points: ${guessData.points}`);
                    twitchClient.say(msg.channel, `🎉 BRAVO @${msg.username} ! Le mot était "${guessData.word}" ! +${guessData.points} points 🎉`);
                } else {
                    console.log(`[PICTIONARY BOT] ❌ WRONG: message="${guessData.message || 'no message'}", normalizedGuess="${guessData.normalizedGuess || 'N/A'}"`);
                }
                // For wrong guesses, don't respond - too spammy
            } catch (error) {
                console.error('[PICTIONARY BOT] Error:', error);
            }
            return;
        }

        // === Commande mod: !indice [score] (Cemantig hint) ===
        if (command === 'indice' || command === 'hint') {
            // Only mods and streamer can give hints
            if (!isModerator(msg)) {
                twitchClient.say(msg.channel, `@${msg.username} Seuls les modos peuvent donner des indices !`);
                return;
            }

            // Parse optional minimum score parameter
            const minScore = args[0] ? parseInt(args[0], 10) : 500;
            const validMinScore = isNaN(minScore) ? 500 : Math.max(300, Math.min(900, minScore));

            try {
                // Get the secret word from the API
                const secretPayload = { action: 'get_secret' };
                const secretAuth = signRequest(secretPayload, process.env.BOT_SECRET || '');
                const secretRes = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/cemantig/secret`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-timestamp': secretAuth.timestamp.toString(),
                        'x-signature': secretAuth.signature
                    },
                    body: JSON.stringify(secretPayload)
                });
                const secretData = await secretRes.json();

                if (!secretData.secret_word) {
                    twitchClient.say(msg.channel, `@${msg.username} Aucune session Cemantig en cours !`);
                    return;
                }

                // Get a hint (similar word) with custom min score
                const similarWords = embeddings.getSimilarWords(secretData.secret_word, 20, validMinScore, 850);
                if (similarWords.length === 0) {
                    twitchClient.say(msg.channel, `@${msg.username} Pas d'indice disponible avec un score >= ${validMinScore}.`);
                    return;
                }

                // Pick a random one from the top 10
                const randomIndex = Math.floor(Math.random() * Math.min(similarWords.length, 10));
                const hint = similarWords[randomIndex];

                twitchClient.say(msg.channel, `💡 INDICE: Un mot proche est « ${hint.word} » (${hint.similarity}/1000)`);
            } catch (error) {
                console.error('Hint error:', error);
                twitchClient.say(msg.channel, `@${msg.username} Erreur lors de la récupération de l'indice.`);
            }
            return;
        }

        // === Commande publique: !pileouface ===
        if (command === 'pileouface' || command === 'flip' || command === 'coin') {
            const isHeads = Math.random() < 0.5;
            const result = isHeads ? '🪙 Pile !' : '🪙 Face !';

            // Broadcast for overlay animation
            const channel = supabase.channel('coinflip-broadcast');
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channel.send({
                        type: 'broadcast',
                        event: 'coinflip',
                        payload: {
                            username: msg.username,
                            result: isHeads ? 'pile' : 'face',
                            resultText: result
                        }
                    }).then(() => {
                        supabase.removeChannel(channel);
                    });
                }
            });

            twitchClient.say(msg.channel, `@${msg.username} ${result}`);
            return;
        }

        // === Commande publique: !musique (Spotify via Discord) ===
        if (command === 'musique' || command === 'music' || command === 'song' || command === 'spotify') {
            if (!isDiscordReady()) {
                twitchClient.say(msg.channel, `@${msg.username} 🎵 Discord n'est pas connecté !`);
                return;
            }

            try {
                const spotify = await getSpotifyActivity();

                if (spotify.error) {
                    twitchClient.say(msg.channel, `@${msg.username} ⚠️ Erreur: ${spotify.error}`);
                    return;
                }

                if (spotify.notPlaying) {
                    twitchClient.say(msg.channel, `@${msg.username} 🎵 Pas de musique en cours sur Spotify !`);
                    return;
                }

                // Format: 🎵 Song - Artist (Album)
                let response = `🎵 ${spotify.song} - ${spotify.artist}`;
                if (spotify.album) {
                    response += ` (${spotify.album})`;
                }

                twitchClient.say(msg.channel, response);
            } catch (error) {
                console.error('Music command error:', error);
                twitchClient.say(msg.channel, `@${msg.username} ⚠️ Erreur lors de la récupération de la musique.`);
            }
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

                const { data: player } = await supabase
                    .from('players')
                    .select('id')
                    .eq('username', targetUser)
                    .single();

                if (!player) {
                    twitchClient.say(msg.channel, `@${msg.username} Aucune stat trouvée pour ${targetUser}`);
                    return;
                }

                const playerId = player.id;

                const { data: stats } = await supabase
                    .from('player_stats')
                    .select('total_points, games_played')
                    .eq('player_id', playerId)
                    .single();

                const { count: messageCount } = await supabase
                    .from('chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('player_id', playerId);

                const cemantixPoints = stats?.total_points || 0;
                const gamesPlayed = stats?.games_played || 0;
                const messages = messageCount || 0;

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
                const { data: newSession } = await supabase
                    .from('game_sessions')
                    .insert({ lang: lang, started_at: new Date().toISOString() })
                    .select('id')
                    .single();
                const sessionId = newSession?.id;

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

                await supabase.from('player_stats').delete().neq('player_id', 0);
                await supabase.from('session_guesses').delete().neq('session_id', 0);
                twitchClient.say(msg.channel, `🗑️ Leaderboard global réinitialisé !`);
                return;
            }

            // === !cemantix top ===
            if (action === 'top' || action === 'leaderboard') {
                try {
                    const { data: topResult } = await supabase
                        .from('player_stats')
                        .select('total_points, players!inner(username)')
                        .order('total_points', { ascending: false })
                        .limit(5);

                    if (!topResult || topResult.length === 0) {
                        twitchClient.say(msg.channel, `🏆 Leaderboard vide pour l'instant !`);
                        return;
                    }

                    const topList = topResult.map((r, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        const username = r.players?.username || (Array.isArray(r.players) ? r.players[0]?.username : 'Unknown');
                        return `${medal} ${username} (${r.total_points} pts)`;
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
    await supabase
        .from('session_guesses')
        .insert({
            session_id: gameSession.sessionId,
            player_id: playerId,
            word: word,
            score: result.score,
            degree: degree,
            points: points
        });

    // Broadcast the new guess for Cemantix page real-time updates
    await supabase.channel('cemantix-broadcast').send({
        type: 'broadcast',
        event: 'new_guess',
        payload: { username, word, points }
    });

    // If winner found - store silently but don't end session
    // Winner will be revealed when !cemantix stop is called
    if (isWinner && !gameSession.found) {
        gameSession.found = true;
        gameSession.winner = username;
        gameSession.winningWord = word;
        // Don't announce - wait for !cemantix stop
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
    const { data: guesses } = await supabase
        .from('session_guesses')
        .select('points, players!inner(id, username)')
        .eq('session_id', sessionId);

    // Aggregate points by player
    const sessionPoints = {};
    for (const g of guesses || []) {
        const username = g.players?.username || (Array.isArray(g.players) ? g.players[0]?.username : 'Unknown');
        const playerId = g.players?.id || (Array.isArray(g.players) ? g.players[0]?.id : null);
        if (!sessionPoints[username]) {
            sessionPoints[username] = { points: 0, playerId };
        }
        sessionPoints[username].points += g.points || 0;
    }

    // Update session in database
    await supabase
        .from('game_sessions')
        .update({
            word: winningWord,
            winner_id: winnerId,
            duration: duration,
            guess_count: guessCount,
            player_count: Object.keys(sessionPoints).length,
            ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    // Update player stats
    for (const [username, data] of Object.entries(sessionPoints)) {
        const playerId = data.playerId || await getOrCreatePlayer(username);
        const points = data.points;
        const wordsFound = username === winner ? 1 : 0;

        // Check if player stats exist
        const { data: existing } = await supabase
            .from('player_stats')
            .select('games_played, total_points, best_session_score, words_found')
            .eq('player_id', playerId)
            .single();

        if (existing) {
            await supabase
                .from('player_stats')
                .update({
                    games_played: existing.games_played + 1,
                    total_points: existing.total_points + points,
                    best_session_score: Math.max(existing.best_session_score, points),
                    words_found: existing.words_found + wordsFound
                })
                .eq('player_id', playerId);
        } else {
            await supabase
                .from('player_stats')
                .insert({
                    player_id: playerId,
                    games_played: 1,
                    total_points: points,
                    best_session_score: points,
                    words_found: wordsFound
                });
        }
    }

    // Sort by points for display
    const sortedPlayers = Object.entries(sessionPoints)
        .sort((a, b) => b[1].points - a[1].points)
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
            .map((p, i) => `${i + 1}. ${p[0]}: ${p[1].points} pts`)
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

    // Load word embeddings for Cemantig (in background, non-blocking)
    const embeddingsPath = path.join(__dirname, 'data', 'frWiki_no_phrase_no_postag_1000_skip_cut100.bin');
    embeddings.load(embeddingsPath).catch(err => {
        console.error('Failed to load embeddings:', err);
    });

    // Initialize Twitch client
    await initializeTwitchClient();

    // Initialize Discord client (for Spotify presence)
    await initDiscordClient();
    startDebugPolling(); // DEBUG: Log Spotify every 5s

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

        // Load rot counter from database
        try {
            const { data } = await supabase
                .from('counters')
                .select('value')
                .eq('name', 'rot')
                .single();
            global.rotCount = data?.value || 0;
            console.log(`🫧 Compteur de rôts chargé: ${global.rotCount}`);
        } catch (e) {
            global.rotCount = 0;
            console.log('🫧 Compteur de rôts initialisé à 0');
        }

        // Listen for alert events and save to database
        twitchClient.on('alert', async (alert) => {
            try {
                await supabase.from('alerts').insert({
                    type: alert.type,
                    username: alert.username,
                    user_id: alert.userId,
                    amount: alert.bits || alert.total || alert.viewers || alert.months || null,
                    tier: alert.tier || null,
                    message: alert.message || null,
                    created_at: new Date().toISOString()
                });
                console.log(`📢 Alert saved: ${alert.type} - ${alert.username}`);
            } catch (e) {
                console.error('Failed to save alert:', e);
            }
        });
        console.log('📢 Alert listener active');
    } catch (error) {
        console.error('❌ Erreur de connexion à Twitch:', error);
        console.log('⚠️ Le bot continuera sans connexion au chat. Veuillez autoriser le bot via /auth/bot-authorize');
    }
}

// Export for server
module.exports = { getTwitchClient: () => twitchClient };

start();
