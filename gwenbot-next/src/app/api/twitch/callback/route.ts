import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const state = searchParams.get('state')
    const tokenType = (state === 'bot' || state === 'broadcaster') ? state : 'broadcaster'

    // Debug logging - show all received params
    console.log('[Twitch Callback] ============ CALLBACK HIT ============')
    console.log('[Twitch Callback] Full URL:', request.nextUrl.toString())
    console.log('[Twitch Callback] Code:', code ? 'received' : 'MISSING')
    console.log('[Twitch Callback] State:', state)
    console.log('[Twitch Callback] TokenType:', tokenType)
    console.log('[Twitch Callback] Error:', error)
    console.log('[Twitch Callback] BASE_URL:', BASE_URL)

    // Handle OAuth errors
    if (error) {
        console.error('[Twitch Callback] OAuth error:', error, errorDescription)
        return NextResponse.redirect(
            new URL(`/maintenance?error=${encodeURIComponent(errorDescription || error)}`, BASE_URL)
        )
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/maintenance?error=No authorization code received', BASE_URL)
        )
    }

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        console.error('[Twitch Callback] Missing Twitch credentials')
        return NextResponse.redirect(
            new URL('/maintenance?error=Server configuration error', BASE_URL)
        )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[Twitch Callback] Missing Supabase credentials')
        return NextResponse.redirect(
            new URL('/maintenance?error=Database configuration error', BASE_URL)
        )
    }

    try {
        // Exchange code for access token
        const redirectUri = `${BASE_URL}/api/twitch/callback`

        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        })

        const tokenData = await tokenResponse.json()

        if (tokenData.error) {
            console.error('[Twitch Callback] Token exchange error:', tokenData)
            return NextResponse.redirect(
                new URL(`/maintenance?error=${encodeURIComponent(tokenData.message || tokenData.error)}`, BASE_URL)
            )
        }

        const { access_token, refresh_token, expires_in, scope } = tokenData

        // Get user info to verify this is the broadcaster
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${access_token}`
            }
        })

        const userData = await userResponse.json()
        const user = userData.data?.[0]

        if (!user) {
            console.error('[Twitch Callback] Could not get user info')
            return NextResponse.redirect(
                new URL('/maintenance?error=Could not verify user', BASE_URL)
            )
        }

        console.log(`[Twitch Callback] Authorized ${tokenType}:`, user.login, user.id)

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString()

        // Format scopes as array for PostgreSQL ARRAY column
        let scopesArray: string[]
        if (Array.isArray(scope)) {
            scopesArray = scope
        } else if (typeof scope === 'string') {
            scopesArray = scope.split(' ')
        } else {
            scopesArray = []
        }
        const scopes = scopesArray

        console.log('[Twitch Callback] Scopes array:', scopesArray)

        // Store or update token in database
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Check if token already exists for this user and type
        const { data: existingToken } = await supabase
            .from('twitch_tokens')
            .select('id')
            .eq('user_id', user.id)
            .eq('token_type', tokenType)
            .single()

        if (existingToken) {
            // Update existing token
            const { error: updateError } = await supabase
                .from('twitch_tokens')
                .update({
                    access_token,
                    refresh_token,
                    expires_at: expiresAt,
                    scopes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingToken.id)

            if (updateError) {
                console.error('[Twitch Callback] Error updating token:', updateError)
                return NextResponse.redirect(
                    new URL('/maintenance?error=Failed to update token', BASE_URL)
                )
            }

            console.log('[Twitch Callback] Token updated for user:', user.login)
        } else {
            // Insert new token
            const { error: insertError } = await supabase
                .from('twitch_tokens')
                .insert({
                    token_type: tokenType,
                    user_id: user.id,
                    access_token,
                    refresh_token,
                    expires_at: expiresAt,
                    scopes,
                    updated_at: new Date().toISOString()
                })

            if (insertError) {
                console.error('[Twitch Callback] Error inserting token:', insertError)
                return NextResponse.redirect(
                    new URL('/maintenance?error=Failed to save token', BASE_URL)
                )
            }

            console.log('[Twitch Callback] New token saved for user:', user.login)
        }

        // Success! Redirect back to maintenance with success message
        return NextResponse.redirect(
            new URL(`/maintenance?success=Bot autorisé pour ${user.display_name}`, BASE_URL)
        )

    } catch (error) {
        console.error('[Twitch Callback] Unexpected error:', error)
        return NextResponse.redirect(
            new URL('/maintenance?error=Unexpected error during authorization', BASE_URL)
        )
    }
}
