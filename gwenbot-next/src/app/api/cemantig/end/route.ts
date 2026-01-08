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
        const { username } = body

        // Check if user is authorized (streamer or mod)
        const { data: authorized } = await supabase
            .from('authorized_users')
            .select('id')
            .ilike('username', username?.toLowerCase() || '')
            .single()

        if (!authorized) {
            return NextResponse.json({ error: 'Seuls les modos peuvent terminer une session' }, { status: 403 })
        }

        // Get active session
        const { data: session } = await supabase
            .from('cemantig_sessions')
            .select('id, secret_word')
            .eq('status', 'active')
            .single()

        if (!session) {
            return NextResponse.json({ error: 'Aucune session active' }, { status: 404 })
        }

        // End the session without a winner
        const { error } = await supabase
            .from('cemantig_sessions')
            .update({
                status: 'finished',
                finished_at: new Date().toISOString()
            })
            .eq('id', session.id)

        if (error) throw error

        return NextResponse.json({
            success: true,
            secret_word: session.secret_word,
            message: `Session terminée. Le mot était "${session.secret_word}"`
        })
    } catch (error) {
        console.error('Error ending session:', error)
        return NextResponse.json({ error: 'Erreur lors de la fin de session' }, { status: 500 })
    }
}
