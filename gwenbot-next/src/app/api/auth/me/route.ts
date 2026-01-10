import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Need service key to select/insert from/into players securely
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
    }

    try {
        const cookieStore = await cookies()

        // Helper to create client similar to session route
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Determine username exactly as session/route.ts does
        const userMetadata = user.user_metadata || {}
        const username = userMetadata.full_name || userMetadata.name || userMetadata.preferred_username || user.email

        if (!username) {
            return NextResponse.json({ error: 'No username found in metadata' }, { status: 400 })
        }

        // Use service client to query/insert players (admin privileges needed for insert if RLS restricts)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Try to find player by username (since players table doesn't have user_id link yet)
        const { data: player } = await supabaseAdmin
            .from('players')
            .select('id, username')
            .eq('username', username)
            .single()

        if (player) {
            return NextResponse.json({
                id: player.id,
                username: player.username,
                auth_id: user.id
            })
        }

        // 2. If not found, create player
        // Note: This relies on username being unique in DB schema.
        console.log(`Creating new player for user: ${username}`)
        const { data: newPlayer, error: createError } = await supabaseAdmin
            .from('players')
            .insert({ username })
            .select('id, username')
            .single()

        if (createError) {
            console.error('Error creating player:', createError)
            // Handle race condition or duplicate key if parallel requests
            return NextResponse.json({ error: 'Failed to create player profile: ' + createError.message }, { status: 500 })
        }

        return NextResponse.json({
            id: newPlayer.id,
            username: newPlayer.username,
            auth_id: user.id
        })

    } catch (error) {
        console.error('Me endpoint error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
