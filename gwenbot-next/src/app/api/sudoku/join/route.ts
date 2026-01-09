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
        const body = await request.json()
        const { userId, username, gameId } = body

        if (!userId || !username) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        // Get waiting game - either specific one by ID or any waiting game
        let gameQuery = supabase
            .from('sudoku_games')
            .select('id, status, mode, is_battle_royale')
            .eq('status', 'waiting')

        if (gameId) {
            // Join specific lobby
            gameQuery = gameQuery.eq('id', gameId)
        }

        const { data: game } = await gameQuery.limit(1).single()

        if (!game) {
            return NextResponse.json({ error: 'No waiting game found' }, { status: 404 })
        }

        // Get or create player
        console.log('[Sudoku Join] Looking for player:', username.toLowerCase())
        let { data: player, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            console.log('[Sudoku Join] Player not found, creating new player')
            const { data: newPlayer, error: insertError } = await supabase
                .from('players')
                .insert({ username: username.toLowerCase() })
                .select('id')
                .single()

            if (insertError) {
                console.error('[Sudoku Join] Failed to create player:', insertError)
            }
            player = newPlayer
        }

        if (!player) {
            console.error('[Sudoku Join] Failed to get player, playerError:', playerError)
            return NextResponse.json({ error: 'Failed to get player' }, { status: 500 })
        }

        // Handle Battle Royale mode (check both column and mode field for compatibility)
        const isBattleRoyale = game.is_battle_royale || game.mode === 'battle_royale'
        if (isBattleRoyale) {
            // Check if already registered
            const { data: existing } = await supabase
                .from('sudoku_br_players')
                .select('id')
                .eq('game_id', game.id)
                .eq('player_id', player.id)
                .single()

            if (existing) {
                return NextResponse.json({ error: 'Already registered' }, { status: 400 })
            }

            // Add to BR players
            const { error } = await supabase
                .from('sudoku_br_players')
                .insert({
                    game_id: game.id,
                    player_id: player.id,
                    progress: '',
                    cells_filled: 0,
                    errors: 0,
                    status: 'playing'
                })

            if (error) throw error

            // Get updated player count
            const { count } = await supabase
                .from('sudoku_br_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id)

            // Broadcast player joined
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: { action: 'br_player_joined', username: username.toLowerCase(), playerCount: count }
            })

            return NextResponse.json({
                success: true,
                playerCount: count,
                message: `Tu as rejoint le Battle Royale !`
            })
        }

        // 1v1 mode - add to queue
        // Check if already in queue
        const { data: existing } = await supabase
            .from('sudoku_queue')
            .select('id')
            .eq('game_id', game.id)
            .eq('player_id', player.id)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Already in queue' }, { status: 400 })
        }

        // Add to queue
        const { error } = await supabase
            .from('sudoku_queue')
            .insert({
                game_id: game.id,
                player_id: player.id
            })

        if (error) throw error

        // Get updated queue count
        const { count } = await supabase
            .from('sudoku_queue')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)

        // Broadcast queue update
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: { action: 'queue_updated', username: username.toLowerCase() }
        })

        return NextResponse.json({
            success: true,
            position: count,
            message: `Tu as rejoint la file d'attente !`
        })
    } catch (error) {
        console.error('Error joining queue:', error)
        return NextResponse.json({ error: 'Failed to join queue' }, { status: 500 })
    }
}
