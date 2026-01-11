import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isCorrectGuess, normalizeText, calculatePoints } from '@/lib/pictionary-words'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { gameId, username, guess } = await request.json()

        if (!gameId || !username || !guess) {
            return NextResponse.json({ error: 'gameId, username, and guess required' }, { status: 400 })
        }

        // Get game
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, status, current_word, current_drawer_id, current_round, round_started_at')
            .eq('id', gameId)
            .single()

        if (!game || game.status !== 'playing' || !game.current_word) {
            return NextResponse.json({ correct: false, message: 'No active round' })
        }

        // Get guesser
        const { data: guesser } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!guesser) {
            return NextResponse.json({ correct: false, message: 'Player not found' })
        }

        // Drawer can't guess
        if (guesser.id === game.current_drawer_id) {
            return NextResponse.json({ correct: false, message: 'Drawer cannot guess' })
        }

        // NOTE: We don't require the guesser to be in pictionary_players
        // because Twitch viewers can guess without being a drawer

        // Debug logging
        console.log('[PICTIONARY GUESS]', {
            gameId,
            username,
            guess: guess.toLowerCase(),
            currentWord: game.current_word,
            currentRound: game.current_round,
            normalizedGuess: normalizeText(guess),
            normalizedWord: normalizeText(game.current_word)
        })

        // Check guess
        if (!isCorrectGuess(guess, game.current_word)) {
            return NextResponse.json({
                correct: false,
                normalizedGuess: normalizeText(guess)
            })
        }

        // Correct guess! Calculate points
        const startTime = new Date(game.round_started_at!).getTime()
        const timeRemaining = Math.max(0, 180 - (Date.now() - startTime) / 1000)
        const points = calculatePoints(timeRemaining)

        // Update guesser score in pictionary_guessers table (for viewers who guess)
        const { data: existingGuesser } = await supabase
            .from('pictionary_guessers')
            .select('score, correct_guesses')
            .eq('game_id', gameId)
            .eq('player_id', guesser.id)
            .single()

        if (existingGuesser) {
            await supabase
                .from('pictionary_guessers')
                .update({
                    score: (existingGuesser.score || 0) + points,
                    correct_guesses: (existingGuesser.correct_guesses || 0) + 1
                })
                .eq('game_id', gameId)
                .eq('player_id', guesser.id)
        } else {
            await supabase
                .from('pictionary_guessers')
                .insert({
                    game_id: gameId,
                    player_id: guesser.id,
                    score: points,
                    correct_guesses: 1
                })
        }

        // Update current round record
        await supabase
            .from('pictionary_rounds')
            .update({
                guessed_by: guesser.id,
                guessed_at: new Date().toISOString(),
                ended_at: new Date().toISOString()
            })
            .eq('game_id', gameId)
            .eq('round_number', game.current_round)

        // Move to next round
        await moveToNextRound(supabase, gameId, game.current_round)

        return NextResponse.json({
            correct: true,
            word: game.current_word,
            points,
            timeRemaining: Math.floor(timeRemaining),
            winner: username
        })

    } catch (error) {
        console.error('Error processing guess:', error)
        return NextResponse.json({ error: 'Failed to process guess' }, { status: 500 })
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

