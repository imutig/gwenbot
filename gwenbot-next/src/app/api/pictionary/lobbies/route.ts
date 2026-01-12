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
        // Get all waiting games
        const { data: games } = await supabase
            .from('pictionary_games')
            .select(`
                id,
                max_players,
                status,
                created_at,
                host:players!pictionary_games_host_id_fkey(id, username, avatar_seed)
            `)
            .eq('status', 'waiting')
            .order('created_at', { ascending: false })

        if (!games) {
            return NextResponse.json({ lobbies: [] })
        }

        // Get player counts for each game
        const lobbies = await Promise.all(games.map(async (game) => {
            const { count } = await supabase
                .from('pictionary_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hostData = game.host as any

            return {
                id: game.id,
                maxPlayers: game.max_players,
                playerCount: count || 0,
                host: {
                    id: Array.isArray(hostData) ? hostData[0]?.id : hostData?.id,
                    username: Array.isArray(hostData) ? hostData[0]?.username : hostData?.username,
                    avatar_seed: Array.isArray(hostData) ? hostData[0]?.avatar_seed : hostData?.avatar_seed
                },
                createdAt: game.created_at
            }
        }))

        return NextResponse.json({ lobbies })

    } catch (error) {
        console.error('Error fetching pictionary lobbies:', error)
        return NextResponse.json({ lobbies: [] })
    }
}
