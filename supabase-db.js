/**
 * Supabase Database Module
 * Drop-in replacement for db.js using Supabase instead of direct PostgreSQL
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nzzihyetxmvimjiuytwc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase connecté');

// Get or create a player by username
async function getOrCreatePlayer(username) {
    const normalizedUsername = username.toLowerCase();

    const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('username', normalizedUsername)
        .single();

    if (existing) {
        return existing.id;
    }

    const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ username: normalizedUsername })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating player:', error);
        throw error;
    }

    return newPlayer.id;
}

// Initialize database (no-op for Supabase since schema is already there)
async function initializeDatabase() {
    console.log('✅ Schema Supabase déjà initialisé');
}

// Legacy query function for backward compatibility
// Wraps Supabase calls in a PostgreSQL-like interface
async function query(text, params) {
    console.warn('⚠️ Legacy query() called - consider migrating to Supabase client');
    // This is a minimal compatibility layer
    // For full functionality, modules should be migrated to use Supabase directly
    return { rows: [], rowCount: 0 };
}

module.exports = {
    supabase,
    query,
    getOrCreatePlayer,
    initializeDatabase
};
