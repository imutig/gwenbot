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
        const { difficulty, time_seconds, username, puzzle, solution } = body

        if (!difficulty || time_seconds === undefined) {
            return NextResponse.json({ error: 'Difficulty and time required' }, { status: 400 })
        }

        // Get or create player
        let playerId = null
        if (username) {
            let { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username.toLowerCase())
                .single()

            if (!player) {
                const { data: newPlayer } = await supabase
                    .from('players')
                    .insert({ username: username.toLowerCase() })
                    .select('id')
                    .single()
                player = newPlayer
            }
            playerId = player?.id
        }

        // Save completed game
        const { data: game, error } = await supabase
            .from('sudoku_games')
            .insert({
                mode: 'solo',
                difficulty,
                puzzle: puzzle || '000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                solution: solution || puzzle || '000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                status: 'finished',
                winner_id: playerId,
                time_seconds,
                finished_at: new Date().toISOString()
            })
            .select('id')
            .single()

        if (error) throw error

        // Update player stats (sudoku_players) if player exists
        if (playerId) {
            const { data: existingStats } = await supabase
                .from('sudoku_players')
                .select('id, games_played, games_won')
                .eq('player_id', playerId)
                .single()

            if (existingStats) {
                await supabase
                    .from('sudoku_players')
                    .update({
                        games_played: existingStats.games_played + 1,
                        games_won: existingStats.games_won + 1
                    })
                    .eq('id', existingStats.id)
            } else {
                await supabase
                    .from('sudoku_players')
                    .insert({
                        player_id: playerId,
                        games_played: 1,
                        games_won: 1
                    })
            }
        }

        return NextResponse.json({
            success: true,
            gameId: game?.id,
            message: 'Game saved!'
        })
    } catch (error) {
        console.error('Error saving game:', error)
        return NextResponse.json({ error: 'Failed to save game' }, { status: 500 })
    }
}
