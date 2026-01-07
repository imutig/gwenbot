/**
 * Database Module - Supabase Integration
 * Uses Supabase for all database operations
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://nzzihyetxmvimjiuytwc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.error('Please add: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Connection check
supabase.from('players').select('id').limit(1).then(() => {
    console.log('✅ Supabase connecté');
}).catch(err => {
    console.error('❌ Erreur Supabase:', err.message);
});

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
        // Handle conflict (player might have been created by concurrent request)
        if (error.code === '23505') {
            const { data: retryExisting } = await supabase
                .from('players')
                .select('id')
                .eq('username', normalizedUsername)
                .single();
            return retryExisting?.id;
        }
        console.error('Error creating player:', error);
        throw error;
    }

    return newPlayer.id;
}

// Initialize database (no-op for Supabase - schema already exists)
async function initializeDatabase() {
    console.log('✅ Schema Supabase déjà initialisé');
}

// Legacy query wrapper for PostgreSQL compatibility
// This provides a basic translation layer for existing code
async function query(text, params) {
    // Parse simple queries and convert to Supabase operations
    const lowerText = text.toLowerCase().trim();

    try {
        // SELECT queries
        if (lowerText.startsWith('select')) {
            // Extract table name (basic parsing)
            const tableMatch = text.match(/from\s+(\w+)/i);
            if (!tableMatch) return { rows: [], rowCount: 0 };
            const table = tableMatch[1];

            let query = supabase.from(table).select('*');

            // Handle WHERE clause with $1 params
            const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$1/i);
            if (whereMatch && params?.[0] !== undefined) {
                query = query.eq(whereMatch[1], params[0]);
            }

            // Handle ORDER BY
            const orderMatch = text.match(/order\s+by\s+(\w+)\s*(desc|asc)?/i);
            if (orderMatch) {
                query = query.order(orderMatch[1], { ascending: orderMatch[2]?.toLowerCase() !== 'desc' });
            }

            // Handle LIMIT
            const limitMatch = text.match(/limit\s+(\d+)/i);
            if (limitMatch) {
                query = query.limit(parseInt(limitMatch[1]));
            }

            const { data, error } = await query;
            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
        }

        // INSERT queries
        if (lowerText.startsWith('insert')) {
            const tableMatch = text.match(/into\s+(\w+)/i);
            if (!tableMatch) return { rows: [], rowCount: 0 };
            const table = tableMatch[1];

            // Extract column names
            const colsMatch = text.match(/\(([^)]+)\)\s*values/i);
            if (!colsMatch) return { rows: [], rowCount: 0 };
            const cols = colsMatch[1].split(',').map(c => c.trim());

            // Build insert object
            const insertData = {};
            cols.forEach((col, i) => {
                if (params?.[i] !== undefined) {
                    insertData[col] = params[i];
                }
            });

            const { data, error } = await supabase
                .from(table)
                .insert(insertData)
                .select();

            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
        }

        // UPDATE queries
        if (lowerText.startsWith('update')) {
            const tableMatch = text.match(/update\s+(\w+)/i);
            if (!tableMatch) return { rows: [], rowCount: 0 };
            const table = tableMatch[1];

            // Basic SET parsing
            const setMatch = text.match(/set\s+(.+?)\s+where/i);
            const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$(\d+)/i);

            if (!setMatch || !whereMatch) return { rows: [], rowCount: 0 };

            const updates = {};
            const setParts = setMatch[1].split(',');
            setParts.forEach(part => {
                const [col, paramNum] = part.split('=').map(s => s.trim());
                const paramIndex = parseInt(paramNum.replace('$', '')) - 1;
                if (params?.[paramIndex] !== undefined) {
                    updates[col] = params[paramIndex];
                }
            });

            const whereCol = whereMatch[1];
            const whereParamIndex = parseInt(whereMatch[2]) - 1;

            const { data, error } = await supabase
                .from(table)
                .update(updates)
                .eq(whereCol, params[whereParamIndex])
                .select();

            if (error) throw error;
            return { rows: data || [], rowCount: data?.length || 0 };
        }

        // DELETE queries
        if (lowerText.startsWith('delete')) {
            const tableMatch = text.match(/from\s+(\w+)/i);
            const whereMatch = text.match(/where\s+(\w+)\s*=\s*\$1/i);

            if (!tableMatch) return { rows: [], rowCount: 0 };

            let query = supabase.from(tableMatch[1]).delete();
            if (whereMatch && params?.[0] !== undefined) {
                query = query.eq(whereMatch[1], params[0]);
            }

            const { error, count } = await query;
            if (error) throw error;
            return { rows: [], rowCount: count || 0 };
        }

        console.warn('⚠️ Unsupported query type:', text.substring(0, 50));
        return { rows: [], rowCount: 0 };

    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
}

module.exports = {
    supabase,
    query,
    getOrCreatePlayer,
    initializeDatabase,
    // Alias for backward compatibility
    pool: { query }
};
