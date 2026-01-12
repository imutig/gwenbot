import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
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

    // Check if user is logged in
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Please log in to play' }, { status: 401 })
    }

    // Twitch stores username in 'slug' or 'name', not 'user_name'
    const username = (user.user_metadata?.slug || user.user_metadata?.name || user.user_metadata?.user_name)?.toLowerCase()

    // Get player ID - create if not exists
    let { data: player } = await supabaseAdmin
        .from('players')
        .select('id')
        .ilike('username', username)
        .single()

    // Auto-create player if not found
    if (!player) {
        const { data: newPlayer, error: createError } = await supabaseAdmin
            .from('players')
            .insert({ username: username })
            .select('id')
            .single()

        if (createError) {
            console.error('Failed to create player:', createError)
            return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
        }
        player = newPlayer
    }

    try {
        const body = await request.json()
        const { lat, lng } = body

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
        }

        // Get active game
        const { data: game } = await supabaseAdmin
            .from('gwenguessr_games')
            .select('*')
            .eq('status', 'playing')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active round' }, { status: 404 })
        }

        // Get current round
        const { data: round } = await supabaseAdmin
            .from('gwenguessr_rounds')
            .select('id')
            .eq('game_id', game.id)
            .eq('round_number', game.current_round)
            .single()

        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 })
        }

        // Check if player already guessed
        const { data: existingGuess } = await supabaseAdmin
            .from('gwenguessr_guesses')
            .select('id')
            .eq('round_id', round.id)
            .eq('player_id', player.id)
            .single()

        if (existingGuess) {
            return NextResponse.json({ error: 'You already guessed for this round' }, { status: 400 })
        }

        // Insert guess
        const { data: guess, error } = await supabaseAdmin
            .from('gwenguessr_guesses')
            .insert({
                round_id: round.id,
                player_id: player.id,
                guess_lat: lat,
                guess_lng: lng
            })
            .select()
            .single()

        if (error) {
            console.error('Guess insert error:', error)
            return NextResponse.json({ error: 'Failed to save guess' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            guessId: guess.id,
            message: 'Guess submitted! Wait for round results.'
        })
    } catch (error) {
        console.error('Guess error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
