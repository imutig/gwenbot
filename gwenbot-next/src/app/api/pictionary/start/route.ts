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
        const { gameId, hostUsername } = await request.json()

        if (!gameId || !hostUsername) {
            return NextResponse.json({ error: 'gameId and hostUsername required' }, { status: 400 })
        }

        // Verify host
        const { data: host } = await supabase
            .from('players')
            .select('id')
            .eq('username', hostUsername.toLowerCase())
            .single()

        if (!host) {
            return NextResponse.json({ error: 'Host not found' }, { status: 404 })
        }

        // Get game and verify host
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, host_id, status')
            .eq('id', gameId)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        if (game.host_id !== host.id) {
            return NextResponse.json({ error: 'Only host can start the game' }, { status: 403 })
        }

        if (game.status !== 'waiting') {
            return NextResponse.json({ error: 'Game already started' }, { status: 400 })
        }

        // Get players and shuffle draw order
        const { data: players } = await supabase
            .from('pictionary_players')
            .select('id, player_id')
            .eq('game_id', gameId)

        if (!players || players.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 })
        }

        // Shuffle and assign random draw order
        const shuffled = players.sort(() => Math.random() - 0.5)
        for (let i = 0; i < shuffled.length; i++) {
            await supabase
                .from('pictionary_players')
                .update({ draw_order: i + 1 })
                .eq('id', shuffled[i].id)
        }

        // Get first drawer
        const firstDrawerId = shuffled[0].player_id

        // Update game status
        await supabase
            .from('pictionary_games')
            .update({
                status: 'playing',
                started_at: new Date().toISOString(),
                current_round: 1,
                current_drawer_id: firstDrawerId
            })
            .eq('id', gameId)

        return NextResponse.json({
            success: true,
            message: 'Game started!',
            totalRounds: players.length
        })

    } catch (error) {
        console.error('Error starting pictionary game:', error)
        return NextResponse.json({ error: 'Failed to start game' }, { status: 500 })
    }
}
