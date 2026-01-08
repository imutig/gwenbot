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
        const { data: session, error: sessionError } = await supabase
            .from('cemantig_sessions')
            .select('id')
            .eq('status', 'active')
            .single()

        if (sessionError || !session) {
            return NextResponse.json({
                bestGuess: null,
                sessionActive: false
            })
        }

        // Get the best guess (highest similarity) from this session
        const { data: bestGuess, error: guessError } = await supabase
            .from('cemantig_guesses')
            .select(`
                word,
                similarity,
                player:players!cemantig_guesses_player_id_fkey(username)
            `)
            .eq('session_id', session.id)
            .order('similarity', { ascending: false })
            .limit(1)
            .single()

        if (guessError || !bestGuess) {
            return NextResponse.json({
                bestGuess: null,
                sessionActive: true
            })
        }

        // Extract username from player relation
        const player = bestGuess.player as { username: string } | { username: string }[] | null
        const username = Array.isArray(player)
            ? player[0]?.username
            : player?.username

        return NextResponse.json({
            bestGuess: {
                word: bestGuess.word,
                similarity: bestGuess.similarity,
                username: username || 'Unknown'
            },
            sessionActive: true
        })
    } catch (error) {
        console.error('Error fetching best guess:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
