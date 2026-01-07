/**
 * Data Migration Script: PostgreSQL → Supabase
 * 
 * Run this script to migrate all data from your local PostgreSQL to Supabase.
 * Make sure both databases are accessible before running.
 * 
 * Prerequisites:
 * - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env
 * - Local PostgreSQL must be running with existing data
 * 
 * Usage: node migrate-to-supabase.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Local PostgreSQL connection
const localPool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Supabase connection
const supabaseUrl = 'https://nzzihyetxmvimjiuytwc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.log('Add this to your .env file:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateTable(tableName, orderBy = 'id') {
    console.log(`\n📦 Migrating ${tableName}...`);

    try {
        // Get data from local PostgreSQL
        const { rows } = await localPool.query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);

        if (rows.length === 0) {
            console.log(`   ⏭️  No data in ${tableName}`);
            return 0;
        }

        // Insert into Supabase in batches
        const batchSize = 100;
        let inserted = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);

            const { error } = await supabase
                .from(tableName)
                .upsert(batch, { onConflict: 'id' });

            if (error) {
                console.error(`   ❌ Error inserting batch: ${error.message}`);
                // Try inserting one by one if batch fails
                for (const row of batch) {
                    const { error: singleError } = await supabase
                        .from(tableName)
                        .upsert(row, { onConflict: 'id' });
                    if (!singleError) inserted++;
                }
            } else {
                inserted += batch.length;
            }
        }

        console.log(`   ✅ Migrated ${inserted}/${rows.length} rows`);
        return inserted;
    } catch (error) {
        console.error(`   ❌ Failed to migrate ${tableName}:`, error.message);
        return 0;
    }
}

async function migrate() {
    console.log('🚀 Starting data migration to Supabase...\n');
    console.log('Source: Local PostgreSQL');
    console.log('Target: Supabase (nzzihyetxmvimjiuytwc)');

    try {
        // Test connections
        console.log('\n🔌 Testing connections...');
        await localPool.query('SELECT 1');
        console.log('   ✅ PostgreSQL connected');

        const { data, error } = await supabase.from('players').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
            throw new Error(`Supabase: ${error.message}`);
        }
        console.log('   ✅ Supabase connected');

        // Migrate tables in order (respecting foreign key constraints)
        const tables = [
            'players',
            'authorized_users',
            'player_stats',
            'twitch_streams',
            'game_sessions',
            'session_guesses',
            'streamer_records',
            'chat_messages',
            'viewer_presence',
            'twitch_tokens',
            'sudoku_games',
            'sudoku_players',
            'sudoku_queue'
        ];

        const results = {};
        for (const table of tables) {
            results[table] = await migrateTable(table);
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Migration Summary:');
        console.log('='.repeat(50));

        let total = 0;
        for (const [table, count] of Object.entries(results)) {
            console.log(`   ${table}: ${count} rows`);
            total += count;
        }
        console.log('='.repeat(50));
        console.log(`   Total: ${total} rows migrated`);
        console.log('\n✅ Migration complete!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
    } finally {
        await localPool.end();
    }
}

migrate();
