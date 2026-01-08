import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get active game (waiting or playing)
        const { data: game } = await supabase
            .from('sudoku_games')
            .select(`
                id,
                mode,
                difficulty,
                puzzle,
                solution,
                status,
                host_progress,
                challenger_progress,
                created_at,
                started_at,
                host:players!sudoku_games_host_id_fkey(id, username),
                challenger:players!sudoku_games_challenger_id_fkey(id, username),
                winner:players!sudoku_games_winner_id_fkey(id, username)
            `)
            .in('status', ['waiting', 'playing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({
                active: false,
                game: null,
                queue: []
            })
        }

        // Get queue if game is waiting
        let queue: { username: string }[] = []
        if (game.status === 'waiting') {
            const { data: queueData } = await supabase
                .from('sudoku_queue')
                .select('player_id, players!inner(username)')
                .eq('game_id', game.id)
                .order('joined_at', { ascending: true })

            if (queueData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                queue = queueData.map((q: any) => {
                    const players = q.players as { username: string } | { username: string }[]
                    return {
                        username: Array.isArray(players) ? players[0]?.username : players?.username
                    }
                })
            }
        }

        // Format host/challenger/winner
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatPlayer = (p: any) => {
            if (!p) return null
            if (Array.isArray(p)) return p[0] ? { id: p[0].id, username: p[0].username } : null
            return { id: p.id, username: p.username }
        }

        return NextResponse.json({
            active: true,
            game: {
                id: game.id,
                mode: game.mode,
                difficulty: game.difficulty,
                puzzle: game.puzzle,
                solution: game.solution,
                status: game.status,
                hostProgress: game.host_progress,
                challengerProgress: game.challenger_progress,
                createdAt: game.created_at,
                startedAt: game.started_at,
                host: formatPlayer(game.host),
                challenger: formatPlayer(game.challenger),
                winner: formatPlayer(game.winner)
            },
            queue
        })
    } catch (error) {
        console.error('Error fetching status:', error)
        return NextResponse.json({
            active: false,
            game: null,
            queue: [],
            error: 'Failed to fetch status'
        })
    }
}
