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
        const { gameId } = await request.json()

        if (!gameId) {
            return NextResponse.json({ error: 'gameId required' }, { status: 400 })
        }

        // Get game
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, status, current_round, round_started_at')
            .eq('id', gameId)
            .single()

        if (!game || game.status !== 'playing') {
            return NextResponse.json({ error: 'No active game' }, { status: 404 })
        }

        // Check if round has actually expired (180 seconds)
        if (game.round_started_at) {
            const startTime = new Date(game.round_started_at).getTime()
            const elapsed = (Date.now() - startTime) / 1000
            if (elapsed < 180) {
                return NextResponse.json({
                    error: 'Round not expired yet',
                    timeRemaining: Math.ceil(180 - elapsed)
                }, { status: 400 })
            }
        }

        // End current round (no winner)
        await supabase
            .from('pictionary_rounds')
            .update({
                ended_at: new Date().toISOString()
            })
            .eq('game_id', gameId)
            .eq('round_number', game.current_round)

        // Move to next round
        await moveToNextRound(supabase, gameId, game.current_round)

        return NextResponse.json({
            success: true,
            message: 'Round expired, moved to next round'
        })

    } catch (error) {
        console.error('Error expiring round:', error)
        return NextResponse.json({ error: 'Failed to expire round' }, { status: 500 })
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function moveToNextRound(supabase: any, gameId: number, currentRound: number) {
    // Get next drawer
    const { data: players } = await supabase
        .from('pictionary_players')
        .select('player_id, draw_order, has_drawn')
        .eq('game_id', gameId)
        .order('draw_order', { ascending: true })

    // Mark current drawer as has_drawn
    await supabase
        .from('pictionary_players')
        .update({ has_drawn: true })
        .eq('game_id', gameId)
        .eq('draw_order', currentRound)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextDrawer = players?.find((p: any) => !p.has_drawn && p.draw_order > currentRound)

    if (!nextDrawer) {
        // Game finished!
        await supabase
            .from('pictionary_games')
            .update({
                status: 'finished',
                finished_at: new Date().toISOString(),
                current_word: null,
                current_drawer_id: null
            })
            .eq('id', gameId)
        return
    }

    // Start next round
    await supabase
        .from('pictionary_games')
        .update({
            current_round: currentRound + 1,
            current_drawer_id: nextDrawer.player_id,
            current_word: null,
            round_started_at: null
        })
        .eq('id', gameId)
}
