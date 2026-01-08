import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireBotAuth } from '@/lib/verify-bot'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// This endpoint is for the bot to get the secret word
// Protected by HMAC signature verification
export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    try {
        const body = await request.json()

        // Verify HMAC signature (with backward compatibility for legacy header)
        const auth = requireBotAuth(body, request.headers)
        if (!auth.valid) {
            console.warn('[Secret] Auth failed:', auth.error)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get active session with secret word
        const { data: session } = await supabase
            .from('cemantig_sessions')
            .select('id, secret_word')
            .eq('status', 'active')
            .single()

        if (!session) {
            return NextResponse.json({ error: 'Aucune session active' }, { status: 404 })
        }

        return NextResponse.json({
            secret_word: session.secret_word
        })
    } catch (error) {
        console.error('Error getting secret:', error)
        return NextResponse.json({ error: 'Erreur' }, { status: 500 })
    }
}

// Keep GET for backward compatibility during migration
export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Legacy: check for bot secret or localhost
    const botSecret = request.headers.get('x-bot-secret')
    const host = request.headers.get('host') || ''

    // Allow localhost or valid bot secret
    if (!host.includes('localhost') && botSecret !== process.env.BOT_SECRET) {
        console.warn('[Secret] Legacy auth failed - please migrate to HMAC')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get active session with secret word
        const { data: session } = await supabase
            .from('cemantig_sessions')
            .select('id, secret_word')
            .eq('status', 'active')
            .single()

        if (!session) {
            return NextResponse.json({ error: 'Aucune session active' }, { status: 404 })
        }

        return NextResponse.json({
            secret_word: session.secret_word
        })
    } catch (error) {
        console.error('Error getting secret:', error)
        return NextResponse.json({ error: 'Erreur' }, { status: 500 })
    }
}
