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
        // Get top 20 players by BR wins
        const { data: leaders, error } = await supabase
            .from('player_stats')
            .select('player_id, sudoku_br_wins, players!inner(username, avatar_seed)')
            .gt('sudoku_br_wins', 0)
            .order('sudoku_br_wins', { ascending: false })
            .limit(20)

        if (error) throw error

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const leaderboard = (leaders || []).map((entry: any, index: number) => ({
            rank: index + 1,
            username: Array.isArray(entry.players) ? entry.players[0]?.username : entry.players?.username,
            avatar_seed: Array.isArray(entry.players) ? entry.players[0]?.avatar_seed : entry.players?.avatar_seed,
            wins: entry.sudoku_br_wins || 0
        }))

        return NextResponse.json({
            success: true,
            leaderboard
        })
    } catch (error) {
        console.error('Error fetching BR leaderboard:', error)
        return NextResponse.json({
            success: false,
            leaderboard: [],
            error: 'Failed to fetch leaderboard'
        }, { status: 500 })
    }
}
