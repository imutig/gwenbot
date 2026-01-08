import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const TWITCH_BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID || '1140958587' // xsgwen's ID

// Supabase client for fetching broadcaster token
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface TwitchStream {
    id: string
    user_id: string
    game_name: string
    title: string
    viewer_count: number
    started_at: string
}

interface TwitchToken {
    id: number
    token_type: string
    user_id: string
    access_token: string
    refresh_token: string
    expires_at: string
    scopes: string
    updated_at: string
}

// Get user token from database and refresh if needed
async function getUserToken(tokenType: 'broadcaster' | 'bot'): Promise<string | null> {
    if (!supabaseUrl || !supabaseServiceKey) {
        console.log('[Twitch API] No Supabase credentials configured')
        return null
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Fetch token from database
        const { data: tokenData, error } = await supabase
            .from('twitch_tokens')
            .select('*')
            .eq('token_type', tokenType)
            .single()

        if (error || !tokenData) {
            console.log(`[Twitch API] No ${tokenType} token found in database:`, error?.message)
            return null
        }

        const token = tokenData as TwitchToken

        // Check if token is expired (or will expire in 5 minutes)
        const expiresAt = new Date(token.expires_at).getTime()
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000

        if (expiresAt - now < fiveMinutes) {
            console.log(`[Twitch API] ${tokenType} token expired or expiring soon, refreshing...`)

            // Refresh the token
            const refreshResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: TWITCH_CLIENT_ID!,
                    client_secret: TWITCH_CLIENT_SECRET!,
                    grant_type: 'refresh_token',
                    refresh_token: token.refresh_token
                })
            })

            const refreshData = await refreshResponse.json()

            if (refreshData.access_token) {
                // Update token in database
                const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()

                await supabase
                    .from('twitch_tokens')
                    .update({
                        access_token: refreshData.access_token,
                        refresh_token: refreshData.refresh_token || token.refresh_token,
                        expires_at: newExpiresAt,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', token.id)

                console.log(`[Twitch API] ${tokenType} token refreshed successfully`)
                return refreshData.access_token
            } else {
                console.error(`[Twitch API] Failed to refresh ${tokenType} token:`, refreshData)
                return null
            }
        }

        return token.access_token
    } catch (error) {
        console.error(`[Twitch API] Error getting ${tokenType} token:`, error)
        return null
    }
}

// Cache app access token for stream status (doesn't need user token)
let appAccessToken: string | null = null
let tokenExpiry = 0

async function getAppAccessToken(): Promise<string | null> {
    if (appAccessToken && Date.now() < tokenExpiry) {
        return appAccessToken
    }

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        return null
    }

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        })

        const data = await response.json()
        if (data.access_token) {
            appAccessToken = data.access_token
            tokenExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000)
            return appAccessToken
        }
    } catch (error) {
        console.error('[Twitch API] Error getting app token:', error)
    }

    return null
}

export async function GET() {
    const appToken = await getAppAccessToken()

    if (!appToken || !TWITCH_CLIENT_ID) {
        return NextResponse.json({
            isLive: false,
            viewers: null,
            followers: 416,
            title: null,
            game: null
        })
    }

    try {
        const appHeaders = {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${appToken}`
        }

        // Fetch stream status with app token
        const streamRes = await fetch(
            `https://api.twitch.tv/helix/streams?user_id=${TWITCH_BROADCASTER_ID}`,
            { headers: appHeaders }
        )
        const streamData = await streamRes.json()

        console.log('[Twitch API] Stream response:', JSON.stringify(streamData))

        const stream = streamData.data?.[0] as TwitchStream | undefined
        const isLive = !!stream

        // Try to get follower count with user token (requires moderator:read:followers)
        // Try bot token first (has moderator scope), then broadcaster as fallback
        let followersCount = 416 // Fallback

        // Try bot token first (moderator on channel with moderator:read:followers scope)
        let userToken = await getUserToken('bot')
        let tokenSource = 'bot'

        // If no bot token, try broadcaster token as fallback
        if (!userToken) {
            userToken = await getUserToken('broadcaster')
            tokenSource = 'broadcaster'
        }

        if (userToken) {
            try {
                const userHeaders = {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${userToken}`
                }

                const followersRes = await fetch(
                    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${TWITCH_BROADCASTER_ID}`,
                    { headers: userHeaders }
                )
                const followersData = await followersRes.json()

                console.log(`[Twitch API] Followers response (${tokenSource}):`, JSON.stringify(followersData))

                if (followersData.total !== undefined) {
                    followersCount = followersData.total
                } else if (followersData.error) {
                    console.log(`[Twitch API] Followers error (${tokenSource}, scope missing?):`, followersData.message)
                }
            } catch (followersError) {
                console.error('[Twitch API] Error fetching followers:', followersError)
            }
        } else {
            console.log('[Twitch API] No user token available, using fallback followers')
        }

        return NextResponse.json({
            isLive,
            viewers: isLive ? stream.viewer_count : null,
            followers: followersCount,
            title: isLive ? stream.title : null,
            game: isLive ? stream.game_name : null
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
            }
        })
    } catch (error) {
        console.error('[Twitch API] Error fetching Twitch status:', error)
        return NextResponse.json({
            isLive: false,
            viewers: null,
            followers: 416,
            title: null,
            game: null
        })
    }
}
