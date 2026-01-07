/**
 * Migration Script: Redis → PostgreSQL
 * Run once to migrate existing data
 */

require('dotenv').config();
const Redis = require('ioredis');
const { query, getOrCreatePlayer, initializeDatabase } = require('./db');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function migrate() {
    console.log('🚀 Starting migration Redis → PostgreSQL...\n');

    // 1. Initialize schema
    console.log('1️⃣ Initializing database schema...');
    await initializeDatabase();

    // 2. Migrate global leaderboard (players + points)
    console.log('\n2️⃣ Migrating leaderboard...');
    const leaderboard = await redis.zrevrange('cemantix_leaderboard', 0, -1, 'WITHSCORES');
    for (let i = 0; i < leaderboard.length; i += 2) {
        const username = leaderboard[i];
        const points = parseInt(leaderboard[i + 1]);

        const playerId = await getOrCreatePlayer(username);

        // Check if stats exist
        const existing = await query('SELECT id FROM player_stats WHERE player_id = $1', [playerId]);
        if (existing.rows.length === 0) {
            await query(
                'INSERT INTO player_stats (player_id, total_points) VALUES ($1, $2)',
                [playerId, points]
            );
        } else {
            await query(
                'UPDATE player_stats SET total_points = $1 WHERE player_id = $2',
                [points, playerId]
            );
        }
        console.log(`  ✓ ${username}: ${points} points`);
    }

    // 3. Migrate player detailed stats
    console.log('\n3️⃣ Migrating player stats...');
    const playerKeys = await redis.keys('cemantix_player:*');
    for (const key of playerKeys) {
        if (key.includes(':best_words')) continue; // Skip best_words keys

        const username = key.replace('cemantix_player:', '');
        const stats = await redis.hgetall(key);

        if (Object.keys(stats).length > 0) {
            const playerId = await getOrCreatePlayer(username);

            await query(`
                INSERT INTO player_stats (player_id, games_played, total_points, best_session_score, words_found)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (player_id) DO UPDATE SET
                    games_played = $2,
                    best_session_score = GREATEST(player_stats.best_session_score, $4),
                    words_found = $5
            `, [
                playerId,
                parseInt(stats.games_played || 0),
                parseInt(stats.total_points || 0),
                parseInt(stats.best_session_score || 0),
                parseInt(stats.words_found || 0)
            ]);
            console.log(`  ✓ ${username}: ${stats.games_played || 0} games, ${stats.words_found || 0} words found`);
        }
    }

    // 4. Migrate history
    console.log('\n4️⃣ Migrating game history...');
    const historyRaw = await redis.lrange('cemantix_history', 0, -1);
    for (const item of historyRaw) {
        const session = JSON.parse(item);

        let winnerId = null;
        if (session.winner) {
            winnerId = await getOrCreatePlayer(session.winner);
        }

        await query(`
            INSERT INTO game_sessions (lang, word, winner_id, duration, guess_count, player_count, ended_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            session.lang || 'fr',
            session.word || null,
            winnerId,
            session.duration || 0,
            session.guessCount || 0,
            session.playerCount || 0,
            session.date || new Date().toISOString()
        ]);
        console.log(`  ✓ Session: ${session.word || 'unknown'} (${session.lang})`);
    }

    // 5. Migrate records
    console.log('\n5️⃣ Migrating streamer records...');
    const records = [
        { key: 'cemantix_fr_alltime', lang: 'fr', type: 'alltime' },
        { key: 'cemantix_fr_monthly', lang: 'fr', type: 'monthly' },
        { key: 'cemantix_en_alltime', lang: 'en', type: 'alltime' },
        { key: 'cemantix_en_monthly', lang: 'en', type: 'monthly' }
    ];

    const currentMonth = new Date().toISOString().slice(0, 7);

    for (const rec of records) {
        const value = await redis.get(rec.key);
        if (value) {
            const month = rec.type === 'monthly' ? currentMonth : null;
            await query(`
                INSERT INTO streamer_records (lang, record_type, value, month)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [rec.lang, rec.type, parseInt(value), month]);
            console.log(`  ✓ ${rec.lang} ${rec.type}: ${value}`);
        }
    }

    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  You can now update your code to use PostgreSQL.');
    console.log('⚠️  Keep Redis running until you\'ve verified everything works.\n');

    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
