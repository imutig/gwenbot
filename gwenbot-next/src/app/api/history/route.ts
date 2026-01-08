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
        // Get last 20 game sessions
        const { data: sessions } = await supabase
            .from('game_sessions')
            .select(`
        id,
        lang,
        word,
        guess_count,
        player_count,
        ended_at,
        players!winner_id(username)
      `)
            .not('ended_at', 'is', null)
            .order('ended_at', { ascending: false })
            .limit(20)

        const history = sessions?.map(session => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const players = session.players as any
            const winnerName = players?.username ?? (Array.isArray(players) ? players[0]?.username : null)
            return {
                id: session.id,
                date: session.ended_at,
                lang: session.lang,
                word: session.word,
                guessCount: session.guess_count,
                playerCount: session.player_count,
                winner: winnerName
            }
        }) || []

        return NextResponse.json({ history })
    } catch (error) {
        console.error('Error fetching history:', error)
        return NextResponse.json({ history: [] })
    }
}
