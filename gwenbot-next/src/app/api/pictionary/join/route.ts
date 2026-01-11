import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { gameId, username } = await request.json()

        if (!gameId || !username) {
            return NextResponse.json({ error: 'gameId and username required' }, { status: 400 })
        }

        // Get game
        const { data: game, error: gameError } = await supabase
            .from('pictionary_games')
            .select('id, status, max_players, host_id')
            .eq('id', gameId)
            .single()

        if (gameError || !game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        if (game.status !== 'waiting') {
            return NextResponse.json({ error: 'Game already started' }, { status: 400 })
        }

        // Get or create player
        let { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            const { data: newPlayer, error } = await supabase
                .from('players')
                .insert({ username: username.toLowerCase() })
                .select('id')
                .single()

            if (error) throw error
            player = newPlayer
        }

        // Check if already joined
        const { data: existing } = await supabase
            .from('pictionary_players')
            .select('id')
            .eq('game_id', gameId)
            .eq('player_id', player.id)
            .single()

        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'Already in game'
            })
        }

        // Check player count
        const { count } = await supabase
            .from('pictionary_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', gameId)

        if ((count || 0) >= game.max_players) {
            return NextResponse.json({ error: 'Game is full' }, { status: 400 })
        }

        // Add player to game
        const { error: joinError } = await supabase
            .from('pictionary_players')
            .insert({
                game_id: gameId,
                player_id: player.id,
                draw_order: (count || 0) + 1
            })

        if (joinError) throw joinError

        return NextResponse.json({
            success: true,
            message: 'Joined game!',
            drawOrder: (count || 0) + 1
        })

    } catch (error) {
        console.error('Error joining pictionary game:', error)
        return NextResponse.json({ error: 'Failed to join game' }, { status: 500 })
    }
}
