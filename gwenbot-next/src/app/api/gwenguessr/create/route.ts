import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient as createServerClient } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const supabaseAuth = await createServerClient()

    if (!supabaseAuth) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
    }

    // Check if user is admin
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Twitch stores username in 'slug' or 'name', not 'user_name'
    const username = (user.user_metadata?.slug || user.user_metadata?.name || user.user_metadata?.user_name)?.toLowerCase()
    console.log('[GwenGuessr] Checking admin access for username:', username)
    console.log('[GwenGuessr] User metadata:', JSON.stringify(user.user_metadata))

    const { data: adminUser, error: adminError } = await supabaseAdmin
        .from('authorized_users')
        .select('username')
        .eq('username', username)
        .single()

    if (!adminUser) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get player ID
    const { data: player } = await supabaseAdmin
        .from('players')
        .select('id')
        .ilike('username', username)
        .single()

    if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    try {
        const body = await request.json()
        const totalRounds = body.totalRounds || 5
        const roundDuration = body.roundDuration || 60

        // Create game
        const { data: game, error } = await supabaseAdmin
            .from('gwenguessr_games')
            .insert({
                host_id: player.id,
                status: 'lobby',
                total_rounds: totalRounds,
                round_duration: roundDuration
            })
            .select()
            .single()

        if (error) {
            console.error('Create game error:', error)
            return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
        }

        return NextResponse.json({ game })
    } catch (error) {
        console.error('GwenGuessr create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
