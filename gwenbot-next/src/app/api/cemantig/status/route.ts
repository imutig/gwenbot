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
            .select('id, status, started_at, total_guesses')
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
                        : (lastSession.winner as { username?: string })?.username
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

        return NextResponse.json({
            active: true,
            session: {
                id: session.id,
                started_at: session.started_at,
                total_guesses: session.total_guesses || 0
            },
            topGuesses: formatGuesses(topGuesses),
            recentGuesses: formatGuesses(recentGuesses)
        })
    } catch (error) {
        console.error('Error getting status:', error)
        return NextResponse.json({ active: false, error: 'Erreur' })
    }
}
