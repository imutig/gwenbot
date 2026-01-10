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

    // Get wins count per player
    let query = supabase
        .from('cemantig_sessions')
        .select('winner_id, players:winner_id(id, username)')
        .eq('status', 'finished')
        .not('winner_id', 'is', null)

    if (dateFilter) {
        query = query.gte('finished_at', dateFilter)
    }

    const { data: sessions } = await query

    // Aggregate wins
    const winsMap: Record<number, { username: string; wins: number }> = {}
    if (sessions) {
        for (const session of sessions as any[]) {
            const winnerId = session.winner_id
            if (!winsMap[winnerId]) {
                winsMap[winnerId] = {
                    username: session.players?.username || 'Unknown',
                    wins: 0
                }
            }
            winsMap[winnerId].wins++
        }
    }

    const leaderboard = Object.entries(winsMap)
        .map(([id, data]) => ({ playerId: parseInt(id), ...data }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 10)

    return NextResponse.json({ leaderboard })
}
