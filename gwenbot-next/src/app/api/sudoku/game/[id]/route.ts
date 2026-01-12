import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { id: gameId } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Fetch game details
        const { data: game, error } = await supabase
            .from('sudoku_games')
            .select(`
                id,
                puzzle,
                solution,
                difficulty,
                mode,
                time_seconds,
                winner_id,
                winner:players!sudoku_games_winner_id_fkey(username),
                host:players!sudoku_games_host_id_fkey(username)
            `)
            .eq('id', gameId)
            .single()

        if (error || !game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        // Determine target time and username
        // If there's a winner, use winner's time. 
        // If BR, time_seconds might be null on the game itself if it's the game record, but we want the winner's time.
        // For now rely on game.time_seconds which should be populated for 1v1 and Solo completed games.

        let targetTime = game.time_seconds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let targetUser = (game.winner as any)?.username

        // If no winner set on game (e.g. BR finished but winner relation weird), fallback to host or generic
        if (!targetUser) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            targetUser = (game.host as any)?.username || 'Inconnu'
        }

        // If time is null (shouldn't happen for completed games we link to), we can't really challenge
        if (targetTime === null) {
            targetTime = 0
        }

        return NextResponse.json({
            game: {
                puzzle: game.puzzle,
                solution: game.solution,
                difficulty: game.difficulty,
                targetTime,
                targetUser
            }
        })
    } catch (error) {
        console.error('Game Details API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
