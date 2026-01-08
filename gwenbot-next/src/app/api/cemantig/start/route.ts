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
        const { username, secret_word } = body

        // Check if user is authorized (streamer or mod)
        const { data: authorized } = await supabase
            .from('authorized_users')
            .select('id')
            .ilike('username', username?.toLowerCase() || '')
            .single()

        if (!authorized) {
            return NextResponse.json({ error: 'Seuls les modos peuvent démarrer une session' }, { status: 403 })
        }

        // Check if there's already an active session
        const { data: activeSession } = await supabase
            .from('cemantig_sessions')
            .select('id')
            .eq('status', 'active')
            .single()

        if (activeSession) {
            return NextResponse.json({ error: 'Une session est déjà en cours' }, { status: 400 })
        }

        // Generate or use provided secret word
        let wordToUse = secret_word?.toLowerCase().trim()

        if (!wordToUse) {
            // Generate random word - this will be done by the bot which has embeddings loaded
            return NextResponse.json({ error: 'Mot secret requis' }, { status: 400 })
        }

        // Create new session
        const { data: session, error } = await supabase
            .from('cemantig_sessions')
            .insert({
                secret_word: wordToUse,
                status: 'active'
            })
            .select('id, started_at')
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                started_at: session.started_at
            },
            message: 'Session Cemantig démarrée !'
        })
    } catch (error) {
        console.error('Error starting session:', error)
        return NextResponse.json({ error: 'Erreur lors du démarrage' }, { status: 500 })
    }
}
