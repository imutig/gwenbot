import { NextResponse } from 'next/server'

// Cache avatars for 1 hour to avoid hitting Twitch API too often
const avatarCache: Record<string, { url: string; timestamp: number }> = {}
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    // Check cache first
    const cached = avatarCache[username.toLowerCase()]
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json({ avatar_url: cached.url })
    }

    try {
        // Get app access token
        const clientId = process.env.TWITCH_CLIENT_ID
        const clientSecret = process.env.TWITCH_CLIENT_SECRET

        if (!clientId || !clientSecret) {
            return NextResponse.json({ avatar_url: null })
        }

        // Get token
        const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
        })
        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
            return NextResponse.json({ avatar_url: null })
        }

        // Get user info
        const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        })
        const userData = await userRes.json()

        const avatarUrl = userData.data?.[0]?.profile_image_url || null

        // Cache the result
        if (avatarUrl) {
            avatarCache[username.toLowerCase()] = { url: avatarUrl, timestamp: Date.now() }
        }

        return NextResponse.json({ avatar_url: avatarUrl })
    } catch (error) {
        console.error('Twitch avatar error:', error)
        return NextResponse.json({ avatar_url: null })
    }
}
