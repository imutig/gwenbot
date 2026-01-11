import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check if user has an active game
export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')?.toLowerCase()

    try {
        if (!username) {
            return NextResponse.json({ hasActiveGame: false })
        }

        // Get player ID
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username)
            .single()

        if (!player) {
            return NextResponse.json({ hasActiveGame: false })
        }

        // Check if player is in any active game (waiting or playing)
        const { data: activeParticipation } = await supabase
            .from('pictionary_players')
            .select(`
                game_id,
                pictionary_games!inner(id, status, max_players, host_id)
            `)
            .eq('player_id', player.id)
            .in('pictionary_games.status', ['waiting', 'playing'])
            .limit(1)

        if (!activeParticipation || activeParticipation.length === 0) {
            return NextResponse.json({ hasActiveGame: false })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gameData = activeParticipation[0].pictionary_games as any
        const gameId = Array.isArray(gameData) ? gameData[0]?.id : gameData?.id
        const hostId = Array.isArray(gameData) ? gameData[0]?.host_id : gameData?.host_id
        const status = Array.isArray(gameData) ? gameData[0]?.status : gameData?.status

        return NextResponse.json({
            hasActiveGame: true,
            gameId,
            isHost: hostId === player.id,
            status,
            // Add game object for bot compatibility
            game: {
                id: gameId,
                status
            }
        })

    } catch (error) {
        console.error('Error checking active game:', error)
        return NextResponse.json({ hasActiveGame: false })
    }
}
