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
        const { username } = await request.json()
        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 })
        }

        // Get waiting BR game where user is host
        const { data: game } = await supabase
            .from('sudoku_games')
            .select('id, mode, puzzle, solution, host_id, is_battle_royale, players!sudoku_games_host_id_fkey(username)')
            .eq('status', 'waiting')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No waiting game found' }, { status: 404 })
        }

        // Check if BR mode
        const isBR = game.is_battle_royale || game.mode === 'battle_royale'
        if (!isBR) {
            return NextResponse.json({ error: 'Not a Battle Royale game' }, { status: 400 })
        }

        // Check if user is host
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hostUsername = Array.isArray(game.players) ? (game.players as any)[0]?.username : (game.players as any)?.username
        if (hostUsername?.toLowerCase() !== username.toLowerCase()) {
            return NextResponse.json({ error: 'Only host can start the game' }, { status: 403 })
        }

        // Check minimum players (2 including host)
        const { count } = await supabase
            .from('sudoku_br_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)

        if (!count || count < 2) {
            return NextResponse.json({ error: 'Minimum 2 players required' }, { status: 400 })
        }

        // Start the game
        const { error: updateError } = await supabase
            .from('sudoku_games')
            .update({
                status: 'playing',
                started_at: new Date().toISOString()
            })
            .eq('id', game.id)

        if (updateError) throw updateError

        // Broadcast game start
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: {
                action: 'br_game_started',
                gameId: game.id,
                puzzle: game.puzzle,
                playerCount: count
            }
        })

        return NextResponse.json({
            success: true,
            message: `Battle Royale lancé avec ${count} joueurs!`,
            puzzle: game.puzzle,
            solution: game.solution
        })
    } catch (error) {
        console.error('Error starting BR game:', error)
        return NextResponse.json({ error: 'Failed to start game' }, { status: 500 })
    }
}
