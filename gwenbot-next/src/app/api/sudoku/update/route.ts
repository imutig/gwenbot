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
        const { username, progress, time_seconds, errors = 0, lost = false } = body

        if (!username || progress === undefined) {
            return NextResponse.json({ error: 'Username and progress required' }, { status: 400 })
        }

        // Get active game with both host and challenger info
        const { data: game } = await supabase
            .from('sudoku_games')
            .select(`
                id, 
                solution,
                host_id,
                challenger_id,
                host_errors,
                challenger_errors
            `)
            .eq('status', 'playing')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active game' }, { status: 404 })
        }

        // Get host username
        const { data: hostPlayer } = await supabase
            .from('players')
            .select('username')
            .eq('id', game.host_id)
            .single()
        const hostUsername = hostPlayer?.username || ''
        console.log('[Sudoku API] Host player:', { host_id: game.host_id, hostUsername })

        // Get challenger username
        const { data: challengerPlayer } = await supabase
            .from('players')
            .select('username')
            .eq('id', game.challenger_id)
            .single()
        const challengerUsername = challengerPlayer?.username || ''
        console.log('[Sudoku API] Challenger player:', { challenger_id: game.challenger_id, challengerUsername })

        // Determine if user is host or challenger
        const isHost = hostUsername?.toLowerCase() === username.toLowerCase()
        console.log('[Sudoku API] User info:', { username, isHost, errors })

        // Update the correct progress and error fields
        const progressField = isHost ? 'host_progress' : 'challenger_progress'
        const errorField = isHost ? 'host_errors' : 'challenger_errors'

        const updateData: Record<string, unknown> = { [progressField]: progress }
        if (errors > 0) {
            updateData[errorField] = errors
        }

        const { error: updateError } = await supabase
            .from('sudoku_games')
            .update(updateData)
            .eq('id', game.id)

        if (updateError) throw updateError

        // Check if this player lost by 3 errors
        if (lost || errors >= 3) {
            // Get opponent player id (the winner)
            const winnerId = isHost ? game.challenger_id : game.host_id
            const winnerUsername = isHost ? challengerUsername : hostUsername
            console.log('[Sudoku API] GAME OVER by errors!', { loser: username, winner: winnerUsername, winnerId })

            // Mark game as finished with opponent as winner
            await supabase
                .from('sudoku_games')
                .update({
                    status: 'finished',
                    winner_id: winnerId,
                    finished_at: new Date().toISOString()
                })
                .eq('id', game.id)

            // Broadcast the update - opponent wins by errors (include winner name!)
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: {
                    action: 'game_finished',
                    winner: winnerUsername,
                    loser: username,
                    reason: 'errors'
                }
            })

            return NextResponse.json({
                success: true,
                complete: false,
                lost: true,
                winner: winnerUsername,
                message: `${username} a fait 3 erreurs !`
            })
        }

        // Check if opponent has lost (3 errors)
        const opponentErrors = isHost ? game.challenger_errors : game.host_errors
        if (opponentErrors >= 3) {
            return NextResponse.json({
                success: true,
                complete: false,
                opponentLost: true
            })
        }

        // Check if completed (progress matches solution)
        const isComplete = progress === game.solution

        if (isComplete) {
            // Get player id
            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username.toLowerCase())
                .single()

            // Mark game as finished with winner
            await supabase
                .from('sudoku_games')
                .update({
                    status: 'finished',
                    winner_id: player?.id,
                    time_seconds: time_seconds || null,
                    finished_at: new Date().toISOString()
                })
                .eq('id', game.id)

            // Broadcast the update with winning time
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: { action: 'game_finished', winner: username, time_seconds: time_seconds || 0 }
            })

            return NextResponse.json({
                success: true,
                complete: true,
                winner: username,
                time_seconds: time_seconds || 0,
                message: `🎉 ${username} a gagné !`
            })
        }

        // Broadcast progress update
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: { action: 'progress_update', username, errors }
        })

        return NextResponse.json({
            success: true,
            complete: false,
            errors
        })
    } catch (error) {
        console.error('Error updating progress:', error)
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }
}

