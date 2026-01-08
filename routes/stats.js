/**
 * Stats Routes - Public statistics endpoints
 */

const express = require('express');
const { supabase } = require('../db');

function createRouter(deps) {
    const router = express.Router();

    // Public records endpoint
    router.get('/records', async (req, res) => {
        try {
            const { data: result } = await supabase
                .from('streamer_records')
                .select('lang, record_type, value, month')
                .order('lang')
                .order('record_type');

            const records = {
                fr: { alltime: null, monthly: null, monthlyPeriod: null },
                en: { alltime: null, monthly: null, monthlyPeriod: null }
            };

            for (const row of result || []) {
                if (records[row.lang]) {
                    if (row.record_type === 'alltime') {
                        records[row.lang].alltime = row.value;
                    } else if (row.record_type === 'monthly') {
                        records[row.lang].monthly = row.value;
                        records[row.lang].monthlyPeriod = row.month;
                    }
                }
            }

            res.json(records);
        } catch (error) {
            console.error('Get records error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Leaderboard data
    router.get('/leaderboard', async (req, res) => {
        try {
            // Check for active session
            const { data: activeSession } = await supabase
                .from('game_sessions')
                .select('id, lang')
                .is('ended_at', null)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let sessionActive = !!activeSession;
            let sessionId = activeSession?.id;
            let lang = activeSession?.lang || 'fr';
            let lastSessionInfo = null;

            // If no active session, get the most recent completed session
            if (!sessionActive) {
                const { data: lastSession } = await supabase
                    .from('game_sessions')
                    .select('id, lang, word, ended_at, duration')
                    .not('ended_at', 'is', null)
                    .order('ended_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastSession) {
                    sessionId = lastSession.id;
                    lang = lastSession.lang;
                    lastSessionInfo = {
                        word: lastSession.word,
                        ended_at: lastSession.ended_at,
                        duration: lastSession.duration
                    };
                }
            }

            let sessionLeaderboard = [];
            let guessCount = 0;

            if (sessionId) {
                // Get session guesses with player info
                const { data: sessionGuesses } = await supabase
                    .from('session_guesses')
                    .select('points, players!inner(username)')
                    .eq('session_id', sessionId);

                // Aggregate points by player
                const playerPoints = {};
                for (const g of sessionGuesses || []) {
                    const username = g.players?.username || (Array.isArray(g.players) ? g.players[0]?.username : 'Unknown');
                    playerPoints[username] = (playerPoints[username] || 0) + (g.points || 0);
                }

                sessionLeaderboard = Object.entries(playerPoints)
                    .map(([user, points]) => ({ user, points }))
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 50);

                guessCount = (sessionGuesses || []).length;
            }

            // Get global leaderboard
            const { data: globalStats } = await supabase
                .from('player_stats')
                .select('total_points, players!inner(username)')
                .order('total_points', { ascending: false })
                .limit(50);

            const globalLeaderboard = (globalStats || []).map(s => {
                const username = s.players?.username || (Array.isArray(s.players) ? s.players[0]?.username : 'Unknown');
                return { user: username, points: s.total_points || 0 };
            });

            res.json({
                sessionActive,
                lang,
                guessCount,
                sessionLeaderboard,
                globalLeaderboard,
                lastSession: lastSessionInfo
            });
        } catch (error) {
            console.error('Leaderboard API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Player stats
    router.get('/player/:username', async (req, res) => {
        try {
            const username = req.params.username.toLowerCase();

            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username)
                .single();

            if (!player) {
                return res.json({ found: false, username, stats: null });
            }

            const playerId = player.id;

            const { data: stats } = await supabase
                .from('player_stats')
                .select('games_played, total_points, best_session_score, words_found')
                .eq('player_id', playerId)
                .single();

            if (!stats) {
                return res.json({ found: false, username, stats: null });
            }

            // Get rank (count players with more points)
            const { count: rank } = await supabase
                .from('player_stats')
                .select('*', { count: 'exact', head: true })
                .gt('total_points', stats.total_points);

            const { data: bestWords } = await supabase
                .from('session_guesses')
                .select('word, degree')
                .eq('player_id', playerId)
                .gt('degree', 0)
                .order('degree', { ascending: false })
                .limit(5);

            const { count: messageCount } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('player_id', playerId);

            res.json({
                found: true,
                username,
                stats: {
                    games_played: stats.games_played || 0,
                    total_points: stats.total_points || 0,
                    best_session_score: stats.best_session_score || 0,
                    words_found: stats.words_found || 0,
                    global_rank: (rank || 0) + 1,
                    best_words: bestWords || [],
                    message_count: messageCount || 0
                }
            });
        } catch (error) {
            console.error('Player API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Session history
    router.get('/history', async (req, res) => {
        try {
            const { data: sessions } = await supabase
                .from('game_sessions')
                .select('id, lang, word, duration, guess_count, player_count, ended_at, players!winner_id(username)')
                .not('ended_at', 'is', null)
                .order('ended_at', { ascending: false })
                .limit(50);

            const history = (sessions || []).map(gs => {
                const winner = gs.players?.username || (Array.isArray(gs.players) ? gs.players[0]?.username : null);
                return {
                    id: gs.id,
                    lang: gs.lang,
                    word: gs.word,
                    duration: gs.duration,
                    guessCount: gs.guess_count,
                    playerCount: gs.player_count,
                    date: gs.ended_at,
                    winner
                };
            });

            res.json({ history });
        } catch (error) {
            console.error('History API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Contributors
    router.get('/contributors', async (req, res) => {
        try {
            const { data: result } = await supabase
                .from('player_stats')
                .select('players!inner(username), total_points')
                .order('total_points', { ascending: false });

            const contributors = (result || []).map(r => {
                return r.players?.username || (Array.isArray(r.players) ? r.players[0]?.username : 'Unknown');
            });

            res.json({ contributors });
        } catch (error) {
            console.error('Contributors API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Top messages
    router.get('/stats/top-messages', async (req, res) => {
        try {
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('players!inner(username)')
                .limit(5000);

            // Count messages per user
            const counts = {};
            for (const m of messages || []) {
                const username = m.players?.username || (Array.isArray(m.players) ? m.players[0]?.username : 'Unknown');
                counts[username] = (counts[username] || 0) + 1;
            }

            const topMessages = Object.entries(counts)
                .map(([username, count]) => ({ username, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            res.json({ topMessages });
        } catch (error) {
            console.error('Top messages API error:', error);
            res.json({ topMessages: [] });
        }
    });

    // Top emojis
    router.get('/stats/top-emojis', async (req, res) => {
        try {
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('emojis')
                .not('emojis', 'is', null)
                .limit(5000);

            // Count emojis
            const counts = {};
            for (const m of messages || []) {
                if (Array.isArray(m.emojis)) {
                    for (const emoji of m.emojis) {
                        counts[emoji] = (counts[emoji] || 0) + 1;
                    }
                }
            }

            const topEmojis = Object.entries(counts)
                .map(([emoji, count]) => ({ emoji, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 15);

            res.json({ topEmojis });
        } catch (error) {
            console.error('Top emojis API error:', error);
            res.json({ topEmojis: [] });
        }
    });

    // Stream history
    router.get('/stats/streams', async (req, res) => {
        try {
            const { data: result } = await supabase
                .from('twitch_streams')
                .select('id, title, game_name, started_at, ended_at, peak_viewers, total_chatters')
                .order('started_at', { ascending: false })
                .limit(20);

            const streams = (result || []).map(s => {
                const start = new Date(s.started_at);
                const end = s.ended_at ? new Date(s.ended_at) : new Date();
                const durationMinutes = Math.round((end - start) / (1000 * 60));

                return {
                    id: s.id,
                    title: s.title,
                    game: s.game_name,
                    started_at: s.started_at,
                    ended_at: s.ended_at,
                    peak_viewers: s.peak_viewers || 0,
                    chatters: s.total_chatters || 0,
                    duration_minutes: durationMinutes
                };
            });

            res.json({ streams });
        } catch (error) {
            console.error('Streams API error:', error);
            res.json({ streams: [] });
        }
    });

    // Watch time leaderboard
    router.get('/stats/watch-time', async (req, res) => {
        try {
            const { data: presences } = await supabase
                .from('viewer_presence')
                .select('stream_id, first_seen, last_seen, message_count, players!inner(username)');

            // Aggregate by user
            const userStats = {};
            for (const p of presences || []) {
                const username = p.players?.username || (Array.isArray(p.players) ? p.players[0]?.username : 'Unknown');
                if (!userStats[username]) {
                    userStats[username] = { streams: new Set(), totalMinutes: 0, totalMessages: 0 };
                }
                userStats[username].streams.add(p.stream_id);
                const start = new Date(p.first_seen);
                const end = new Date(p.last_seen);
                userStats[username].totalMinutes += (end - start) / (1000 * 60);
                userStats[username].totalMessages += p.message_count || 0;
            }

            const leaderboard = Object.entries(userStats)
                .map(([username, data]) => ({
                    username,
                    streams_watched: data.streams.size,
                    watch_time_minutes: Math.round(data.totalMinutes),
                    messages: data.totalMessages
                }))
                .sort((a, b) => b.watch_time_minutes - a.watch_time_minutes)
                .slice(0, 15);

            res.json({ leaderboard });
        } catch (error) {
            console.error('Watch time API error:', error);
            res.json({ leaderboard: [] });
        }
    });

    // Player watch time
    router.get('/stats/watch-time/:username', async (req, res) => {
        try {
            const username = req.params.username.toLowerCase();

            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (!player) {
                return res.json({
                    username: req.params.username,
                    streams_watched: 0,
                    watch_time_minutes: 0,
                    messages: 0,
                    top_emojis: []
                });
            }

            const playerId = player.id;

            const { data: presences } = await supabase
                .from('viewer_presence')
                .select('stream_id, first_seen, last_seen')
                .eq('player_id', playerId);

            const streams = new Set();
            let totalMinutes = 0;
            for (const p of presences || []) {
                streams.add(p.stream_id);
                const start = new Date(p.first_seen);
                const end = new Date(p.last_seen);
                totalMinutes += (end - start) / (1000 * 60);
            }

            const { count: totalMessages } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('player_id', playerId);

            const { data: messages } = await supabase
                .from('chat_messages')
                .select('emojis')
                .eq('player_id', playerId)
                .not('emojis', 'is', null)
                .limit(500);

            // Count emojis
            const emojiCounts = {};
            for (const m of messages || []) {
                if (Array.isArray(m.emojis)) {
                    for (const emoji of m.emojis) {
                        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
                    }
                }
            }

            const topEmojis = Object.entries(emojiCounts)
                .map(([emoji, count]) => ({ emoji, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            res.json({
                username,
                streams_watched: streams.size,
                watch_time_minutes: Math.round(totalMinutes),
                messages: totalMessages || 0,
                top_emojis: topEmojis
            });
        } catch (error) {
            console.error('Player watch time API error:', error);
            res.json({
                username: req.params.username,
                streams_watched: 0,
                watch_time_minutes: 0,
                messages: 0,
                top_emojis: []
            });
        }
    });

    return router;
}

module.exports = { createRouter };
