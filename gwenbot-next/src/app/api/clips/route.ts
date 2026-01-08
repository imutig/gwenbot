import { NextResponse } from 'next/server'

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!
const BROADCASTER_ID = process.env.BROADCASTER_ID || '101246465' // xsgwen

// Cache for app access token
let appAccessToken: string | null = null
let tokenExpiry = 0

async function getAppAccessToken() {
    if (appAccessToken && Date.now() < tokenExpiry) {
        return appAccessToken
    }

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            client_secret: TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    })

    const data = await res.json()
    appAccessToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return appAccessToken
}

export async function GET() {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        return NextResponse.json({ error: 'Twitch API not configured', clips: [] }, { status: 500 })
    }

    try {
        const accessToken = await getAppAccessToken()

        // Fetch more clips from Twitch API for better sorting options
        // Twitch returns clips sorted by views by default
        const clipsRes = await fetch(
            `https://api.twitch.tv/helix/clips?broadcaster_id=${BROADCASTER_ID}&first=50`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': TWITCH_CLIENT_ID
                }
            }
        )

        if (!clipsRes.ok) {
            console.error('Twitch clips error:', await clipsRes.text())
            return NextResponse.json({ error: 'Failed to fetch clips', clips: [] })
        }

        const clipsData = await clipsRes.json()

        const clips = clipsData.data?.map((clip: {
            id: string
            url: string
            embed_url: string
            title: string
            thumbnail_url: string
            view_count: number
            created_at: string
            creator_name: string
            duration: number
        }) => ({
            id: clip.id,
            url: clip.url,
            embedUrl: clip.embed_url,
            title: clip.title,
            thumbnail: clip.thumbnail_url,
            views: clip.view_count,
            createdAt: clip.created_at,
            creator: clip.creator_name,
            duration: clip.duration
        })) || []

        return NextResponse.json({ clips })
    } catch (error) {
        console.error('Clips API error:', error)
        return NextResponse.json({ error: 'Failed to fetch clips', clips: [] })
    }
}
