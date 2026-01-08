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
        const body = await request.json()
        const { userId, username } = body

        if (!userId || !username) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        // Get active waiting game
        const { data: game } = await supabase
            .from('sudoku_games')
            .select('id, status')
            .eq('status', 'waiting')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No waiting game found' }, { status: 404 })
        }

        // Get or create player
        let { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            const { data: newPlayer } = await supabase
                .from('players')
                .insert({ username: username.toLowerCase() })
                .select('id')
                .single()
            player = newPlayer
        }

        if (!player) {
            return NextResponse.json({ error: 'Failed to get player' }, { status: 500 })
        }

        // Check if already in queue
        const { data: existing } = await supabase
            .from('sudoku_queue')
            .select('id')
            .eq('game_id', game.id)
            .eq('player_id', player.id)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Already in queue' }, { status: 400 })
        }

        // Add to queue
        const { error } = await supabase
            .from('sudoku_queue')
            .insert({
                game_id: game.id,
                player_id: player.id
            })

        if (error) throw error

        // Get updated queue count
        const { count } = await supabase
            .from('sudoku_queue')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)

        return NextResponse.json({
            success: true,
            position: count,
            message: `Tu as rejoint la file d'attente !`
        })
    } catch (error) {
        console.error('Error joining queue:', error)
        return NextResponse.json({ error: 'Failed to join queue' }, { status: 500 })
    }
}
