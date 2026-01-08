import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireBotAuth } from '@/lib/verify-bot'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()

        // Verify HMAC signature (with backward compatibility for legacy header)
        const auth = requireBotAuth(body, request.headers)
        if (!auth.valid) {
            console.warn('[Guess] Auth failed:', auth.error)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { username, word, similarity } = body

        if (!username || !word || similarity === undefined) {
            return NextResponse.json({ error: 'Username, word and similarity required' }, { status: 400 })
        }

        // Get active session
        const { data: session, error: sessionError } = await supabase
            .from('cemantig_sessions')
            .select('id, secret_word')
            .eq('status', 'active')
            .single()

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Aucune session active' }, { status: 404 })
        }

        // Get or create player
        let { data: player } = await supabase
            .from('players')
            .select('id')
            .ilike('username', username.toLowerCase())
            .single()

        if (!player) {
            const { data: newPlayer } = await supabase
                .from('players')
                .insert({ username: username.toLowerCase() })
                .select('id')
                .single()
            player = newPlayer
        }

        // Check if this exact word was already guessed in this session
        const { data: existingGuess } = await supabase
            .from('cemantig_guesses')
            .select('id, similarity')
            .eq('session_id', session.id)
            .ilike('word', word.toLowerCase())
            .single()

        if (existingGuess) {
            return NextResponse.json({
                success: false,
                already_guessed: true,
                similarity: existingGuess.similarity,
                message: `"${word}" a déjà été proposé (${existingGuess.similarity}/1000)`
            })
        }

        // Save the guess
        const { data: guess, error: guessError } = await supabase
            .from('cemantig_guesses')
            .insert({
                session_id: session.id,
                player_id: player?.id,
                word: word.toLowerCase(),
                similarity
            })
            .select('id')
            .single()

        if (guessError) throw guessError

        // Broadcast the new guess for real-time updates
        await supabase.channel('cemantig-broadcast').send({
            type: 'broadcast',
            event: 'new_guess',
            payload: { word: word.toLowerCase(), similarity, username }
        })

        // Update total guesses count (simple increment)
        try {
            const { data: currentSession } = await supabase
                .from('cemantig_sessions')
                .select('total_guesses')
                .eq('id', session.id)
                .single()

            await supabase
                .from('cemantig_sessions')
                .update({ total_guesses: (currentSession?.total_guesses || 0) + 1 })
                .eq('id', session.id)
        } catch {
            // Ignore count update errors
        }

        // Check if winner (similarity === 1000)
        const isWinner = similarity === 1000

        if (isWinner) {
            // End the session
            await supabase
                .from('cemantig_sessions')
                .update({
                    status: 'finished',
                    finished_at: new Date().toISOString(),
                    winner_id: player?.id
                })
                .eq('id', session.id)
        }

        // Get rank (how many words have higher similarity)
        const { count: higherCount } = await supabase
            .from('cemantig_guesses')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .gt('similarity', similarity)

        const rank = (higherCount || 0) + 1

        return NextResponse.json({
            success: true,
            guess_id: guess?.id,
            similarity,
            rank,
            is_winner: isWinner,
            secret_word: isWinner ? session.secret_word : undefined,
            message: isWinner
                ? `BRAVO ! "${word}" était le mot secret !`
                : `${similarity}/1000 - Rang #${rank}`
        })
    } catch (error) {
        console.error('Error processing guess:', error)
        return NextResponse.json({ error: 'Erreur lors du guess' }, { status: 500 })
    }
}
