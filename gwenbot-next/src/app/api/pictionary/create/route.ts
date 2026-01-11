import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { hostUsername, maxPlayers = 6 } = await request.json()

        if (!hostUsername) {
            return NextResponse.json({ error: 'Host username required' }, { status: 400 })
        }

        // Get or create host player
        let { data: host } = await supabase
            .from('players')
            .select('id')
            .eq('username', hostUsername.toLowerCase())
            .single()

        if (!host) {
            const { data: newHost, error: createError } = await supabase
                .from('players')
                .insert({ username: hostUsername.toLowerCase() })
                .select('id')
                .single()

            if (createError) throw createError
            host = newHost
        }

        // Check if host already has an active game
        const { data: existingGame } = await supabase
            .from('pictionary_games')
            .select('id')
            .eq('host_id', host.id)
            .in('status', ['waiting', 'playing'])
            .single()

        if (existingGame) {
            return NextResponse.json({
                error: 'You already have an active game',
                gameId: existingGame.id
            }, { status: 400 })
        }

        // Create new game
        const { data: game, error: gameError } = await supabase
            .from('pictionary_games')
            .insert({
                host_id: host.id,
                max_players: Math.min(Math.max(maxPlayers, 2), 12), // 2-12 players
                status: 'waiting'
            })
            .select('id')
            .single()

        if (gameError) throw gameError

        // Auto-add host to players
        await supabase
            .from('pictionary_players')
            .insert({
                game_id: game.id,
                player_id: host.id,
                draw_order: 1
            })

        return NextResponse.json({
            success: true,
            gameId: game.id,
            message: 'Game created! Players can now join.'
        })

    } catch (error) {
        console.error('Error creating pictionary game:', error)
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }
}
