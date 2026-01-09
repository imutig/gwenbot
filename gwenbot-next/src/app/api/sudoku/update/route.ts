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
        const { username, progress, time_seconds, errors = 0, lost = false, eliminated = false } = body

        if (!username || progress === undefined) {
            return NextResponse.json({ error: 'Username and progress required' }, { status: 400 })
        }

        // Get active game
        const { data: game } = await supabase
            .from('sudoku_games')
            .select(`
                id, 
                solution,
                host_id,
                challenger_id,
                host_errors,
                challenger_errors,
                is_battle_royale
            `)
            .eq('status', 'playing')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active game' }, { status: 404 })
        }

        // Get player id
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }

        // ========== BATTLE ROYALE MODE ==========
        if (game.is_battle_royale) {
            // Get current BR player record
            const { data: brPlayer } = await supabase
                .from('sudoku_br_players')
                .select('id, status, errors, cells_filled')
                .eq('game_id', game.id)
                .eq('player_id', player.id)
                .single()

            if (!brPlayer) {
                return NextResponse.json({ error: 'Player not in this BR game' }, { status: 404 })
            }

            // If already eliminated or finished, don't update
            if (brPlayer.status !== 'playing') {
                return NextResponse.json({
                    success: true,
                    complete: brPlayer.status === 'finished',
                    eliminated: brPlayer.status === 'eliminated'
                })
            }

            // Calculate cells filled (count non-zero matching solution cells)
            let cellsFilled = 0
            for (let i = 0; i < 81; i++) {
                if (progress[i] !== '0' && progress[i] === game.solution[i]) {
                    cellsFilled++
                }
            }

            // Check if this player is eliminated (3 errors or explicit elimination)
            if (lost || eliminated || errors >= 3) {
                await supabase
                    .from('sudoku_br_players')
                    .update({
                        progress,
                        cells_filled: cellsFilled,
                        errors,
                        status: 'eliminated',
                        finished_at: new Date().toISOString()
                    })
                    .eq('id', brPlayer.id)

                // Broadcast elimination
                await supabase.channel('sudoku-broadcast').send({
                    type: 'broadcast',
                    event: 'sudoku_update',
                    payload: { action: 'br_player_eliminated', username }
                })

                return NextResponse.json({
                    success: true,
                    complete: false,
                    eliminated: true,
                    message: `${username} a été éliminé !`
                })
            }

            // Check if completed (progress matches solution)
            const isComplete = progress === game.solution

            if (isComplete) {
                // Calculate finish rank
                const { count: finishedCount } = await supabase
                    .from('sudoku_br_players')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', game.id)
                    .eq('status', 'finished')

                const finishRank = (finishedCount || 0) + 1

                // Update player as finished
                await supabase
                    .from('sudoku_br_players')
                    .update({
                        progress,
                        cells_filled: 81,
                        status: 'finished',
                        finish_rank: finishRank,
                        finish_time: time_seconds || 0,
                        finished_at: new Date().toISOString()
                    })
                    .eq('id', brPlayer.id)

                // If first to finish (rank 1), update player_stats.sudoku_br_wins
                if (finishRank === 1) {
                    // Get or create player_stats
                    const { data: stats } = await supabase
                        .from('player_stats')
                        .select('id, sudoku_br_wins')
                        .eq('player_id', player.id)
                        .single()

                    if (stats) {
                        await supabase
                            .from('player_stats')
                            .update({ sudoku_br_wins: (stats.sudoku_br_wins || 0) + 1 })
                            .eq('id', stats.id)
                    } else {
                        await supabase
                            .from('player_stats')
                            .insert({ player_id: player.id, sudoku_br_wins: 1 })
                    }

                    // Set game winner
                    await supabase
                        .from('sudoku_games')
                        .update({ winner_id: player.id })
                        .eq('id', game.id)
                }

                // Broadcast finish
                await supabase.channel('sudoku-broadcast').send({
                    type: 'broadcast',
                    event: 'sudoku_update',
                    payload: {
                        action: 'br_player_finished',
                        username,
                        finishRank,
                        finishTime: time_seconds || 0
                    }
                })

                // Check if all players are done (finished or eliminated)
                const { count: playingCount } = await supabase
                    .from('sudoku_br_players')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', game.id)
                    .eq('status', 'playing')

                if (playingCount === 0) {
                    // Game over - mark as finished
                    await supabase
                        .from('sudoku_games')
                        .update({
                            status: 'finished',
                            finished_at: new Date().toISOString(),
                            time_seconds: time_seconds || null
                        })
                        .eq('id', game.id)

                    // Get winner info
                    const { data: winnerData } = await supabase
                        .from('sudoku_br_players')
                        .select('player_id, players!inner(username)')
                        .eq('game_id', game.id)
                        .eq('finish_rank', 1)
                        .maybeSingle()

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const winnerUsername = winnerData ? (Array.isArray((winnerData as any).players) ? (winnerData as any).players[0]?.username : (winnerData as any).players?.username) : null

                    // Broadcast game end with winner
                    await supabase.channel('sudoku-broadcast').send({
                        type: 'broadcast',
                        event: 'sudoku_update',
                        payload: {
                            action: 'br_game_finished',
                            winner: winnerUsername,
                            gameId: game.id
                        }
                    })
                }

                return NextResponse.json({
                    success: true,
                    complete: true,
                    finishRank,
                    finishTime: time_seconds || 0,
                    message: finishRank === 1
                        ? `🏆 ${username} a gagné le Battle Royale !`
                        : `${username} a terminé #${finishRank} !`
                })
            }

            // Just update progress
            await supabase
                .from('sudoku_br_players')
                .update({
                    progress,
                    cells_filled: cellsFilled,
                    errors
                })
                .eq('id', brPlayer.id)

            // Broadcast progress update
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: { action: 'br_progress_update', username, cellsFilled, errors }
            })

            return NextResponse.json({
                success: true,
                complete: false,
                cellsFilled,
                errors
            })
        }

        // ========== 1v1 MODE (existing logic) ==========
        // Get host username
        const { data: hostPlayer } = await supabase
            .from('players')
            .select('username')
            .eq('id', game.host_id)
            .single()
        const hostUsername = hostPlayer?.username || ''

        // Get challenger username
        const { data: challengerPlayer } = await supabase
            .from('players')
            .select('username')
            .eq('id', game.challenger_id)
            .single()
        const challengerUsername = challengerPlayer?.username || ''

        // Determine if user is host or challenger
        const isHost = hostUsername?.toLowerCase() === username.toLowerCase()

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
            const winnerId = isHost ? game.challenger_id : game.host_id
            const winnerUsername = isHost ? challengerUsername : hostUsername

            await supabase
                .from('sudoku_games')
                .update({
                    status: 'finished',
                    winner_id: winnerId,
                    finished_at: new Date().toISOString()
                })
                .eq('id', game.id)

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

        // Check if opponent has lost
        const opponentErrors = isHost ? game.challenger_errors : game.host_errors
        if (opponentErrors >= 3) {
            return NextResponse.json({
                success: true,
                complete: false,
                opponentLost: true
            })
        }

        // Check if completed
        const isComplete = progress === game.solution

        if (isComplete) {
            await supabase
                .from('sudoku_games')
                .update({
                    status: 'finished',
                    winner_id: player?.id,
                    time_seconds: time_seconds || null,
                    finished_at: new Date().toISOString()
                })
                .eq('id', game.id)

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
