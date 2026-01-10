import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'

    // Calculate date filter
    let dateFilter = null
    const now = new Date()
    if (period === 'week') {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (period === 'month') {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    // Helper function to get solo leaderboard
    const getSoloLeaderboard = async (difficulty: 'easy' | 'hard', orderBy: 'moves' | 'time') => {
        let query = supabase
            .from('memory_games')
            .select('*, host:host_id(id, username)')
            .eq('mode', 'solo')
            .eq('status', 'finished')
            .eq('difficulty', difficulty)
            .not('end_time', 'is', null)

        if (dateFilter) {
            query = query.gte('created_at', dateFilter)
        }

        const { data: games } = await query

        if (!games || games.length === 0) return []

        // Calculate time for each game and sort
        const gamesWithTime = games.map((game: any) => {
            const startTime = new Date(game.start_time).getTime()
            const endTime = new Date(game.end_time).getTime()
            const timeSeconds = Math.floor((endTime - startTime) / 1000)
            return {
                username: game.host?.username || 'Unknown',
                moves: game.moves,
                time: timeSeconds
            }
        })

        // Sort based on orderBy
        if (orderBy === 'moves') {
            gamesWithTime.sort((a, b) => a.moves - b.moves)
        } else {
            gamesWithTime.sort((a, b) => a.time - b.time)
        }

        // Get unique players (best result per player)
        const seen = new Set()
        const unique = gamesWithTime.filter((g: any) => {
            if (seen.has(g.username)) return false
            seen.add(g.username)
            return true
        })

        return unique.slice(0, 10)
    }

    // 1v1 wins count
    let winsQuery = supabase
        .from('memory_games')
        .select('winner_id, players:winner_id(id, username)')
        .eq('mode', '1v1')
        .eq('status', 'finished')
        .not('winner_id', 'is', null)

    if (dateFilter) {
        winsQuery = winsQuery.gte('created_at', dateFilter)
    }

    const { data: winGames } = await winsQuery

    // Aggregate wins
    const winsMap: Record<number, { username: string; wins: number }> = {}
    if (winGames) {
        for (const game of winGames as any[]) {
            const winnerId = game.winner_id
            if (!winsMap[winnerId]) {
                winsMap[winnerId] = {
                    username: game.players?.username || 'Unknown',
                    wins: 0
                }
            }
            winsMap[winnerId].wins++
        }
    }

    const winsLeaderboard = Object.entries(winsMap)
        .map(([id, data]) => ({ playerId: parseInt(id), ...data }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 10)

    // Get all leaderboards
    const [easyMoves, easyTime, hardMoves, hardTime] = await Promise.all([
        getSoloLeaderboard('easy', 'moves'),
        getSoloLeaderboard('easy', 'time'),
        getSoloLeaderboard('hard', 'moves'),
        getSoloLeaderboard('hard', 'time')
    ])

    return NextResponse.json({
        easyMoves,
        easyTime,
        hardMoves,
        hardTime,
        winsLeaderboard,
        // Legacy compatibility
        soloLeaderboard: easyMoves
    })
}
