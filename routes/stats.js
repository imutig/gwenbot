/**
 * Stats Routes - Public statistics endpoints
 */

const express = require('express');

let query;

function createRouter(deps) {
    query = deps.query;

    const router = express.Router();

    // Public records endpoint
    router.get('/records', async (req, res) => {
        try {
            const result = await query(`
                SELECT lang, record_type, value, month
                FROM streamer_records
                ORDER BY lang, record_type
            `);

            const records = {
                fr: { alltime: null, monthly: null, monthlyPeriod: null },
                en: { alltime: null, monthly: null, monthlyPeriod: null }
            };

            for (const row of result.rows) {
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
            // First, check for active session
            const activeSession = await query(`
                SELECT id, lang FROM game_sessions
                WHERE ended_at IS NULL
                ORDER BY started_at DESC LIMIT 1
            `);

            let sessionActive = activeSession.rows.length > 0;
            let sessionId = activeSession.rows[0]?.id;
            let lang = activeSession.rows[0]?.lang || 'fr';
            let lastSessionInfo = null;

            // If no active session, get the most recent completed session
            if (!sessionActive) {
                const lastSession = await query(`
                    SELECT id, lang, word, ended_at, duration
                    FROM game_sessions
                    WHERE ended_at IS NOT NULL
                    ORDER BY ended_at DESC LIMIT 1
                `);

                if (lastSession.rows.length > 0) {
                    sessionId = lastSession.rows[0].id;
                    lang = lastSession.rows[0].lang;
                    lastSessionInfo = {
                        word: lastSession.rows[0].word,
                        ended_at: lastSession.rows[0].ended_at,
                        duration: lastSession.rows[0].duration
                    };
                }
            }

            let sessionLeaderboard = [];
            let guessCount = 0;

            if (sessionId) {
                const sessionResult = await query(`
                    SELECT p.username as user, SUM(sg.points) as points
                    FROM session_guesses sg
                    JOIN players p ON sg.player_id = p.id
                    WHERE sg.session_id = $1
                    GROUP BY p.username
                    ORDER BY points DESC
                    LIMIT 50
                `, [sessionId]);
                sessionLeaderboard = sessionResult.rows.map(r => ({ user: r.user, points: parseInt(r.points) }));

                const countResult = await query('SELECT COUNT(*) FROM session_guesses WHERE session_id = $1', [sessionId]);
                guessCount = parseInt(countResult.rows[0].count);
            }

            const globalResult = await query(`
                SELECT p.username as user, ps.total_points as points
                FROM player_stats ps
                JOIN players p ON ps.player_id = p.id
                ORDER BY ps.total_points DESC
                LIMIT 50
            `);
            const globalLeaderboard = globalResult.rows.map(r => ({ user: r.user, points: parseInt(r.points) }));

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

            const playerResult = await query('SELECT id FROM players WHERE username = $1', [username]);

            if (playerResult.rows.length === 0) {
                return res.json({ found: false, username, stats: null });
            }

            const playerId = playerResult.rows[0].id;

            const statsResult = await query(`
                SELECT games_played, total_points, best_session_score, words_found
                FROM player_stats WHERE player_id = $1
            `, [playerId]);

            if (statsResult.rows.length === 0) {
                return res.json({ found: false, username, stats: null });
            }

            const stats = statsResult.rows[0];

            const rankResult = await query(`
                SELECT COUNT(*) + 1 as rank FROM player_stats
                WHERE total_points > (SELECT total_points FROM player_stats WHERE player_id = $1)
            `, [playerId]);
            const globalRank = parseInt(rankResult.rows[0].rank);

            const bestWordsResult = await query(`
                SELECT word, degree FROM session_guesses
                WHERE player_id = $1 AND degree > 0
                ORDER BY degree DESC
                LIMIT 5
            `, [playerId]);

            const messageCountResult = await query(
                'SELECT COUNT(*) FROM chat_messages WHERE player_id = $1',
                [playerId]
            );
            const messageCount = parseInt(messageCountResult.rows[0].count);

            res.json({
                found: true,
                username,
                stats: {
                    games_played: parseInt(stats.games_played),
                    total_points: parseInt(stats.total_points),
                    best_session_score: parseInt(stats.best_session_score),
                    words_found: parseInt(stats.words_found),
                    global_rank: globalRank,
                    best_words: bestWordsResult.rows,
                    message_count: messageCount
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
            const historyResult = await query(`
                SELECT 
                    gs.id, gs.lang, gs.word, gs.duration, gs.guess_count as "guessCount",
                    gs.player_count as "playerCount", gs.ended_at as date,
                    p.username as winner
                FROM game_sessions gs
                LEFT JOIN players p ON gs.winner_id = p.id
                WHERE gs.ended_at IS NOT NULL
                ORDER BY gs.ended_at DESC
                LIMIT 50
            `);

            res.json({ history: historyResult.rows });
        } catch (error) {
            console.error('History API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Contributors
    router.get('/contributors', async (req, res) => {
        try {
            const result = await query(`
                SELECT p.username FROM player_stats ps
                JOIN players p ON ps.player_id = p.id
                ORDER BY ps.total_points DESC
            `);
            res.json({ contributors: result.rows.map(r => r.username) });
        } catch (error) {
            console.error('Contributors API error:', error);
            res.status(500).json({ error: 'Internal error' });
        }
    });

    // Top messages
    router.get('/stats/top-messages', async (req, res) => {
        try {
            const result = await query(`
                SELECT p.username, COUNT(*) as count
                FROM chat_messages cm
                JOIN players p ON cm.player_id = p.id
                GROUP BY p.username
                ORDER BY count DESC
                LIMIT 10
            `);
            res.json({ topMessages: result.rows.map(r => ({ username: r.username, count: parseInt(r.count) })) });
        } catch (error) {
            console.error('Top messages API error:', error);
            res.json({ topMessages: [] });
        }
    });

    // Top emojis
    router.get('/stats/top-emojis', async (req, res) => {
        try {
            const result = await query(`
                SELECT emoji, COUNT(*) as count
                FROM chat_messages, UNNEST(emojis) as emoji
                GROUP BY emoji
                ORDER BY count DESC
                LIMIT 15
            `);
            res.json({ topEmojis: result.rows.map(r => ({ emoji: r.emoji, count: parseInt(r.count) })) });
        } catch (error) {
            console.error('Top emojis API error:', error);
            res.json({ topEmojis: [] });
        }
    });

    // Stream history
    router.get('/stats/streams', async (req, res) => {
        try {
            const result = await query(`
                SELECT id, title, game_name, started_at, ended_at, peak_viewers, total_chatters,
                       EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 60 as duration_minutes
                FROM twitch_streams
                ORDER BY started_at DESC
                LIMIT 20
            `);

            res.json({
                streams: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    game: s.game_name,
                    started_at: s.started_at,
                    ended_at: s.ended_at,
                    peak_viewers: parseInt(s.peak_viewers) || 0,
                    chatters: parseInt(s.total_chatters) || 0,
                    duration_minutes: Math.round(parseFloat(s.duration_minutes) || 0)
                }))
            });
        } catch (error) {
            console.error('Streams API error:', error);
            res.json({ streams: [] });
        }
    });

    // Watch time leaderboard
    router.get('/stats/watch-time', async (req, res) => {
        try {
            const result = await query(`
                SELECT 
                    p.username,
                    COUNT(DISTINCT vp.stream_id) as streams_watched,
                    SUM(EXTRACT(EPOCH FROM (vp.last_seen - vp.first_seen)) / 60) as total_minutes,
                    SUM(vp.message_count) as total_messages
                FROM viewer_presence vp
                JOIN players p ON vp.player_id = p.id
                GROUP BY p.username
                ORDER BY total_minutes DESC
                LIMIT 15
            `);

            res.json({
                leaderboard: result.rows.map(r => ({
                    username: r.username,
                    streams_watched: parseInt(r.streams_watched) || 0,
                    watch_time_minutes: Math.round(parseFloat(r.total_minutes) || 0),
                    messages: parseInt(r.total_messages) || 0
                }))
            });
        } catch (error) {
            console.error('Watch time API error:', error);
            res.json({ leaderboard: [] });
        }
    });

    // Player watch time
    router.get('/stats/watch-time/:username', async (req, res) => {
        try {
            const username = req.params.username.toLowerCase();

            const playerRes = await query('SELECT id FROM players WHERE username = $1', [username]);

            if (playerRes.rows.length === 0) {
                return res.json({
                    username: req.params.username,
                    streams_watched: 0,
                    watch_time_minutes: 0,
                    messages: 0,
                    top_emojis: []
                });
            }

            const playerId = playerRes.rows[0].id;

            const statsResult = await query(`
                SELECT 
                    COUNT(DISTINCT vp.stream_id) as streams_watched,
                    SUM(EXTRACT(EPOCH FROM (vp.last_seen - vp.first_seen)) / 60) as total_minutes
                FROM viewer_presence vp
                WHERE vp.player_id = $1
            `, [playerId]);

            const stats = statsResult.rows[0] || {};

            const messageCountResult = await query(
                'SELECT COUNT(*) as count FROM chat_messages WHERE player_id = $1',
                [playerId]
            );
            const totalMessages = parseInt(messageCountResult.rows[0]?.count) || 0;

            const emojisResult = await query(`
                SELECT emoji, COUNT(*) as count
                FROM chat_messages, UNNEST(emojis) as emoji
                WHERE player_id = $1
                GROUP BY emoji
                ORDER BY count DESC
                LIMIT 5
            `, [playerId]);

            res.json({
                username,
                streams_watched: parseInt(stats.streams_watched) || 0,
                watch_time_minutes: Math.round(parseFloat(stats.total_minutes) || 0),
                messages: totalMessages,
                top_emojis: emojisResult.rows.map(r => ({ emoji: r.emoji, count: parseInt(r.count) }))
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
