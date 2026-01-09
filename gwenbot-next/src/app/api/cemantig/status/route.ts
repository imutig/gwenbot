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
        // Get active session
        const { data: session } = await supabase
            .from('cemantig_sessions')
            .select('id, status, started_at, total_guesses, is_random')
            .eq('status', 'active')
            .single()

        if (!session) {
            // Check for most recent finished session
            const { data: lastSession } = await supabase
                .from('cemantig_sessions')
                .select(`
                    id, 
                    status, 
                    secret_word,
                    started_at, 
                    finished_at, 
                    total_guesses,
                    winner:players!cemantig_sessions_winner_id_fkey(username)
                `)
                .eq('status', 'finished')
                .order('finished_at', { ascending: false })
                .limit(1)
                .single()

            // Also get the guesses from the last session so results stay visible
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formatGuess = (guesses: any[]) => {
                if (!guesses) return []
                return guesses.map(g => ({
                    id: g.id,
                    word: g.word,
                    similarity: g.similarity,
                    guessed_at: g.guessed_at,
                    username: Array.isArray(g.player) ? g.player[0]?.username : g.player?.username
                }))
            }

            let topGuessesData: ReturnType<typeof formatGuess> = []
            let recentGuessesData: ReturnType<typeof formatGuess> = []

            if (lastSession) {
                const { data: topGuesses } = await supabase
                    .from('cemantig_guesses')
                    .select(`
                        id,
                        word,
                        similarity,
                        guessed_at,
                        player:players!cemantig_guesses_player_id_fkey(username)
                    `)
                    .eq('session_id', lastSession.id)
                    .order('similarity', { ascending: false })
                    .limit(10)

                const { data: recentGuesses } = await supabase
                    .from('cemantig_guesses')
                    .select(`
                        id,
                        word,
                        similarity,
                        guessed_at,
                        player:players!cemantig_guesses_player_id_fkey(username)
                    `)
                    .eq('session_id', lastSession.id)
                    .order('guessed_at', { ascending: false })
                    .limit(20)

                topGuessesData = formatGuess(topGuesses || [])
                recentGuessesData = formatGuess(recentGuesses || [])
            }

            return NextResponse.json({
                active: false,
                lastSession: lastSession ? {
                    id: lastSession.id,
                    secret_word: lastSession.secret_word,
                    started_at: lastSession.started_at,
                    finished_at: lastSession.finished_at,
                    total_guesses: lastSession.total_guesses,
                    winner: Array.isArray(lastSession.winner)
                        ? lastSession.winner[0]?.username
                        : (lastSession.winner as { username?: string })?.username,
                    topGuesses: topGuessesData,
                    recentGuesses: recentGuessesData
                } : null
            })
        }

        // Get top 10 closest guesses
        const { data: topGuesses } = await supabase
            .from('cemantig_guesses')
            .select(`
                id,
                word,
                similarity,
                guessed_at,
                player:players!cemantig_guesses_player_id_fkey(username)
            `)
            .eq('session_id', session.id)
            .order('similarity', { ascending: false })
            .limit(10)

        // Get recent guesses (last 20)
        const { data: recentGuesses } = await supabase
            .from('cemantig_guesses')
            .select(`
                id,
                word,
                similarity,
                guessed_at,
                player:players!cemantig_guesses_player_id_fkey(username)
            `)
            .eq('session_id', session.id)
            .order('guessed_at', { ascending: false })
            .limit(20)

        // Format guesses
        const formatGuesses = (guesses: typeof topGuesses) => {
            if (!guesses) return []
            return guesses.map(g => ({
                id: g.id,
                word: g.word,
                similarity: g.similarity,
                guessed_at: g.guessed_at,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                username: Array.isArray(g.player) ? (g.player as any)[0]?.username : (g.player as any)?.username
            }))
        }

        // Get all guesses to calculate contributors leaderboard
        const { data: allGuesses } = await supabase
            .from('cemantig_guesses')
            .select(`
                player_id,
                similarity,
                player:players!cemantig_guesses_player_id_fkey(username)
            `)
            .eq('session_id', session.id)

        // Aggregate contributors
        const contributorMap = new Map<string, { guessCount: number; bestSimilarity: number }>()
        for (const guess of allGuesses || []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const username = Array.isArray(guess.player) ? (guess.player as any)[0]?.username : (guess.player as any)?.username
            if (!username) continue

            const existing = contributorMap.get(username)
            if (existing) {
                existing.guessCount++
                existing.bestSimilarity = Math.max(existing.bestSimilarity, guess.similarity)
            } else {
                contributorMap.set(username, { guessCount: 1, bestSimilarity: guess.similarity })
            }
        }

        // Sort by guess count and take top 10
        const contributors = Array.from(contributorMap.entries())
            .map(([username, data]) => ({ username, ...data }))
            .sort((a, b) => b.guessCount - a.guessCount)
            .slice(0, 10)

        return NextResponse.json({
            active: true,
            session: {
                id: session.id,
                started_at: session.started_at,
                total_guesses: session.total_guesses || 0,
                is_random: session.is_random || false
            },
            topGuesses: formatGuesses(topGuesses),
            recentGuesses: formatGuesses(recentGuesses),
            contributors
        })
    } catch (error) {
        console.error('Error getting status:', error)
        return NextResponse.json({ active: false, error: 'Erreur' })
    }
}
