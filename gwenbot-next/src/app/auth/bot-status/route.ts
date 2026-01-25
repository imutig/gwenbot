import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Bot Status Route - Check authorization status of bot and broadcaster tokens
 */
export async function GET() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        const { data: botToken } = await supabase
            .from('twitch_tokens')
            .select('user_id, expires_at, scopes')
            .eq('token_type', 'bot')
            .limit(1)
            .single()

        const { data: broadcasterToken } = await supabase
            .from('twitch_tokens')
            .select('user_id, expires_at, scopes')
            .eq('token_type', 'broadcaster')
            .limit(1)
            .single()

        return NextResponse.json({
            botAuthorized: !!botToken,
            botUserId: botToken?.user_id || null,
            botExpiresAt: botToken?.expires_at || null,
            broadcasterAuthorized: !!broadcasterToken,
            broadcasterUserId: broadcasterToken?.user_id || null,
            broadcasterExpiresAt: broadcasterToken?.expires_at || null
        })
    } catch (error) {
        console.error('Error checking bot status:', error)
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
    }
}
