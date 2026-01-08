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
        // Get all viewer presence data with player info
        const { data: presences } = await supabase
            .from('viewer_presence')
            .select(`
                watch_time_seconds,
                message_count,
                players!inner(username)
            `)

        // Aggregate by player
        const playerStats: Record<string, { username: string; watch_time_minutes: number; streams_watched: number }> = {}

        if (presences) {
            for (const p of presences) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const players = p.players as any
                const username = players?.username ?? (Array.isArray(players) ? players[0]?.username : 'Unknown')
                // Use watch_time_seconds from DB, convert to minutes
                const minutes = Math.floor((p.watch_time_seconds || 0) / 60)

                if (!playerStats[username]) {
                    playerStats[username] = { username, watch_time_minutes: 0, streams_watched: 0 }
                }
                playerStats[username].watch_time_minutes += minutes
                playerStats[username].streams_watched++
            }
        }

        const leaderboard = Object.values(playerStats)
            .sort((a, b) => b.watch_time_minutes - a.watch_time_minutes)
            .slice(0, 10)

        return NextResponse.json({ leaderboard })
    } catch (error) {
        console.error('Error fetching watch time leaderboard:', error)
        return NextResponse.json({ leaderboard: [] })
    }
}
