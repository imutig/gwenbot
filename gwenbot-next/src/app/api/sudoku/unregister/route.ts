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
        const { username, gameId } = await request.json()
        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 })
        }

        // Get player ID
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }

        // Get the game to check if it's BR and user is not host
        const { data: game } = await supabase
            .from('sudoku_games')
            .select('id, host_id, is_battle_royale, mode, status')
            .eq('id', gameId)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        // Can only unregister/abandon from waiting or playing BR games
        if (game.status !== 'waiting' && game.status !== 'playing') {
            return NextResponse.json({ error: 'Game already finished' }, { status: 400 })
        }

        const isBR = game.is_battle_royale || game.mode === 'battle_royale'
        if (!isBR) {
            return NextResponse.json({ error: 'Not a Battle Royale game' }, { status: 400 })
        }

        // Host cannot unregister - they must cancel the game
        if (game.host_id === player.id) {
            return NextResponse.json({ error: 'Host cannot unregister. Use cancel instead.' }, { status: 400 })
        }

        if (game.status === 'waiting') {
            // Waiting: Remove player from BR players
            const { error: deleteError } = await supabase
                .from('sudoku_br_players')
                .delete()
                .eq('game_id', gameId)
                .eq('player_id', player.id)

            if (deleteError) throw deleteError

            // Broadcast player left
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: {
                    action: 'br_player_left',
                    gameId,
                    username: username.toLowerCase()
                }
            })

            return NextResponse.json({
                success: true,
                message: 'Désinscrit du Battle Royale'
            })
        } else {
            // Playing: Mark player as eliminated (abandon)
            const { count } = await supabase
                .from('sudoku_br_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameId)
                .eq('status', 'eliminated')

            const eliminationRank = (count || 0) + 1

            await supabase
                .from('sudoku_br_players')
                .update({
                    status: 'eliminated',
                    finish_rank: eliminationRank
                })
                .eq('game_id', gameId)
                .eq('player_id', player.id)

            // Broadcast player eliminated
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: {
                    action: 'br_player_eliminated',
                    gameId,
                    username: username.toLowerCase(),
                    rank: eliminationRank
                }
            })

            return NextResponse.json({
                success: true,
                message: 'Tu as abandonné la partie'
            })
        }
    } catch (error) {
        console.error('Error unregistering from BR:', error)
        return NextResponse.json({ error: 'Failed to unregister' }, { status: 500 })
    }
}
