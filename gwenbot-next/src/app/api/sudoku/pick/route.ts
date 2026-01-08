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
        const { username, challengerUsername, random } = body

        // Only streamer can pick
        if (username?.toLowerCase() !== 'xsgwen') {
            return NextResponse.json({ error: 'Only the streamer can pick challengers' }, { status: 403 })
        }

        // Get active waiting game
        const { data: game } = await supabase
            .from('sudoku_games')
            .select('id')
            .eq('status', 'waiting')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No waiting game found' }, { status: 404 })
        }

        // Get queue
        const { data: queue } = await supabase
            .from('sudoku_queue')
            .select('id, player_id, players!inner(id, username)')
            .eq('game_id', game.id)

        if (!queue || queue.length === 0) {
            return NextResponse.json({ error: 'Queue is empty' }, { status: 400 })
        }

        let selectedEntry
        if (random) {
            // Pick random challenger
            selectedEntry = queue[Math.floor(Math.random() * queue.length)]
        } else if (challengerUsername) {
            // Pick specific challenger
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selectedEntry = queue.find((q: any) => {
                const players = q.players as { username: string } | { username: string }[]
                const playerUsername = Array.isArray(players) ? players[0]?.username : players?.username
                return playerUsername?.toLowerCase() === challengerUsername.toLowerCase()
            })
            if (!selectedEntry) {
                return NextResponse.json({ error: 'Challenger not found in queue' }, { status: 404 })
            }
        } else {
            return NextResponse.json({ error: 'Specify challenger or use random' }, { status: 400 })
        }

        // Update game with challenger and start
        const { error: updateError } = await supabase
            .from('sudoku_games')
            .update({
                challenger_id: selectedEntry.player_id,
                status: 'playing',
                started_at: new Date().toISOString()
            })
            .eq('id', game.id)

        if (updateError) throw updateError

        // Clear the queue
        await supabase
            .from('sudoku_queue')
            .delete()
            .eq('game_id', game.id)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const players = (selectedEntry as any).players as { username: string } | { username: string }[]
        const challengerName = Array.isArray(players) ? players[0]?.username : players?.username

        return NextResponse.json({
            success: true,
            challenger: challengerName,
            message: `${challengerName} a été choisi comme adversaire !`
        })
    } catch (error) {
        console.error('Error picking challenger:', error)
        return NextResponse.json({ error: 'Failed to pick challenger' }, { status: 500 })
    }
}
