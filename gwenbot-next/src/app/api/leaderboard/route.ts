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
        // Get global leaderboard (all-time points)
        const { data: globalStats } = await supabase
            .from('player_stats')
            .select(`
        total_points,
        players!inner(username)
      `)
            .order('total_points', { ascending: false })
            .limit(50)

        const globalLeaderboard = globalStats?.map(stat => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const players = stat.players as any
            return {
                user: players?.username ?? (Array.isArray(players) ? players[0]?.username : 'Unknown'),
                points: stat.total_points
            }
        }) || []

        // Get last/active session leaderboard
        const { data: lastSession } = await supabase
            .from('game_sessions')
            .select('id, lang, word, ended_at')
            .order('ended_at', { ascending: false })
            .limit(1)
            .single()

        let sessionLeaderboard: { user: string; points: number }[] = []
        let sessionActive = false
        let lang = 'fr'

        if (lastSession) {
            lang = lastSession.lang
            sessionActive = !lastSession.ended_at

            // Get guesses for this session grouped by player
            const { data: guesses } = await supabase
                .from('session_guesses')
                .select(`
          points,
          players!inner(username)
        `)
                .eq('session_id', lastSession.id)

            if (guesses) {
                const playerPoints: Record<string, number> = {}
                for (const guess of guesses) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const players = guess.players as any
                    const username = players?.username ?? (Array.isArray(players) ? players[0]?.username : 'Unknown')
                    playerPoints[username] = (playerPoints[username] || 0) + (guess.points || 0)
                }

                sessionLeaderboard = Object.entries(playerPoints)
                    .map(([user, points]) => ({ user, points }))
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 50)
            }
        }

        return NextResponse.json({
            globalLeaderboard,
            sessionLeaderboard,
            sessionActive,
            lastSession: !!lastSession,
            lang
        })
    } catch (error) {
        console.error('Error fetching leaderboard:', error)
        return NextResponse.json({
            globalLeaderboard: [],
            sessionLeaderboard: [],
            sessionActive: false
        })
    }
}
