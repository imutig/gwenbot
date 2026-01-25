import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Bot Authorization Callback - Handles Twitch OAuth callback for broadcaster
 * Saves the broadcaster token to the database
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const savedState = request.cookies.get('bot_authorize_state')?.value

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
    const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Validate state
    if (!code || state !== savedState) {
        return NextResponse.redirect(`${baseUrl}?error=invalid_state`)
    }

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        return NextResponse.redirect(`${baseUrl}?error=missing_config`)
    }

    try {
        const redirectUri = `${baseUrl}/auth/bot-authorize-callback`

        // Exchange code for tokens
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        })

        const tokenData = await tokenResponse.json()

        if (!tokenData.access_token) {
            console.error('Token exchange failed:', tokenData)
            return NextResponse.redirect(`${baseUrl}?error=token_failed`)
        }

        // Get user info
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        })

        const userData = await userResponse.json()
        const user = userData.data?.[0]

        if (!user) {
            return NextResponse.redirect(`${baseUrl}?error=user_failed`)
        }

        // Save to database
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
            const scopes = tokenData.scope || []

            // Check if exists
            const { data: existing } = await supabase
                .from('twitch_tokens')
                .select('id')
                .eq('token_type', 'broadcaster')
                .eq('user_id', user.id)
                .single()

            if (existing) {
                await supabase
                    .from('twitch_tokens')
                    .update({
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
            } else {
                await supabase
                    .from('twitch_tokens')
                    .insert({
                        token_type: 'broadcaster',
                        user_id: user.id,
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes
                    })
            }

            console.log(`✅ Broadcaster authorized: ${user.display_name} (${user.id})`)
        }

        // Clear state cookie and redirect with success
        const response = NextResponse.redirect(`${baseUrl}?success=broadcaster_authorized&user=${user.display_name}`)
        response.cookies.delete('bot_authorize_state')

        return response
    } catch (error) {
        console.error('Bot authorize callback error:', error)
        return NextResponse.redirect(`${baseUrl}?error=callback_failed`)
    }
}
