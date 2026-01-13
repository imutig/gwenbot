import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { LOCATIONS } from '@/data/gwenguessr-locations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MAPILLARY_ACCESS_TOKEN = process.env.MAPILLARY_ACCESS_TOKEN || ''

// Try to find a Mapillary image near a random city from our list
async function findMapillaryImage(): Promise<{
    imageId: string;
    imageUrl: string;
    exactLat: number;
    exactLng: number;
    country: string;
    city: string;
} | null> {
    if (!MAPILLARY_ACCESS_TOKEN) {
        console.log('No Mapillary token configured')
        return null
    }

    // Shuffle and try up to 10 random cities
    const shuffled = [...LOCATIONS].sort(() => Math.random() - 0.5)
    const maxAttempts = Math.min(10, shuffled.length)

    for (let i = 0; i < maxAttempts; i++) {
        const location = shuffled[i]

        // Add random offset to avoid always getting city center images
        // Offset range of ~10km in each direction for more variety
        const offsetRange = 0.1 // ~10km
        const randomLat = location.lat + (Math.random() - 0.5) * offsetRange
        const randomLng = location.lng + (Math.random() - 0.5) * offsetRange

        console.log(`[GwenGuessr] Trying ${location.city}, ${location.country} (attempt ${i + 1}/${maxAttempts}) with offset [${randomLat.toFixed(4)}, ${randomLng.toFixed(4)}]`)

        try {
            // Larger bbox for more variety (~5km radius)
            const bboxSize = 0.05
            const bbox = `${randomLng - bboxSize},${randomLat - bboxSize},${randomLng + bboxSize},${randomLat + bboxSize}`

            const response = await fetch(
                `https://graph.mapillary.com/images?fields=id,thumb_2048_url,computed_geometry&bbox=${bbox}&limit=50`,
                {
                    headers: {
                        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
                    },
                    signal: AbortSignal.timeout(5000)
                }
            )

            if (!response.ok) {
                console.error(`Mapillary API error in ${location.city}:`, response.status)
                continue
            }

            const data = await response.json()
            if (!data.data || data.data.length === 0) {
                console.log(`No images found in ${location.city} (offset area), trying next...`)
                continue
            }

            // Success! Pick a random image from the results
            const randomImage = data.data[Math.floor(Math.random() * data.data.length)]
            const coords = randomImage.computed_geometry?.coordinates || [randomLng, randomLat]

            console.log(`[GwenGuessr] Found image ${randomImage.id} in ${location.city}, ${location.country} (${data.data.length} images available)`)
            return {
                imageId: randomImage.id,
                imageUrl: randomImage.thumb_2048_url,
                exactLat: coords[1],
                exactLng: coords[0],
                country: location.country,
                city: location.city
            }
        } catch (error) {
            console.error(`Error fetching from ${location.city}:`, error)
            continue
        }
    }

    console.error('[GwenGuessr] Failed to find any Mapillary images after', maxAttempts, 'attempts')
    return null
}

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const supabaseAuth = await createServerClient()

    if (!supabaseAuth) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
    }

    // Check if user is admin
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Twitch stores username in 'slug' or 'name', not 'user_name'
    const username = (user.user_metadata?.slug || user.user_metadata?.name || user.user_metadata?.user_name)?.toLowerCase()
    const { data: adminUser } = await supabaseAdmin
        .from('authorized_users')
        .select('username')
        .eq('username', username)
        .single()

    if (!adminUser) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    try {
        // Get active game
        const { data: game } = await supabaseAdmin
            .from('gwenguessr_games')
            .select('*')
            .in('status', ['lobby', 'between_rounds'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active game found' }, { status: 404 })
        }

        // Check if we have more rounds
        const nextRound = game.current_round + 1
        if (nextRound > game.total_rounds) {
            return NextResponse.json({ error: 'All rounds completed' }, { status: 400 })
        }

        // Find a Mapillary image (tries multiple cities)
        const imageData = await findMapillaryImage()

        if (!imageData) {
            return NextResponse.json({ error: 'Failed to find any images. Please check Mapillary token.' }, { status: 500 })
        }

        // Create round
        const { data: round, error: roundError } = await supabaseAdmin
            .from('gwenguessr_rounds')
            .insert({
                game_id: game.id,
                round_number: nextRound,
                image_id: imageData.imageId,
                image_url: imageData.imageUrl,
                correct_lat: imageData.exactLat,
                correct_lng: imageData.exactLng,
                country: imageData.country,
                city: imageData.city,
                started_at: new Date().toISOString()
            })
            .select()
            .single()

        if (roundError) {
            console.error('Create round error:', roundError)
            return NextResponse.json({ error: 'Failed to create round' }, { status: 500 })
        }

        // Update game status
        await supabaseAdmin
            .from('gwenguessr_games')
            .update({
                status: 'playing',
                current_round: nextRound
            })
            .eq('id', game.id)

        // Send announcement to Twitch chat
        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000'
        const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hopital-pillbox.fr'

        console.log('[GwenGuessr] Sending announce to:', `${BOT_API_URL}/api/announce`)
        try {
            const announceRes = await fetch(`${BOT_API_URL}/api/announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-secret': process.env.BOT_SECRET || ''
                },
                body: JSON.stringify({
                    message: `GwenGuessr Round ${nextRound}/${game.total_rounds} ! Devinez la localisation via ce lien -> ${SITE_URL}/gwenguessr ! N'oubliez pas de vous connecter!`,
                    color: 'purple'
                })
            })
            if (!announceRes.ok) {
                const errText = await announceRes.text()
                console.error('[GwenGuessr] Announce failed:', announceRes.status, errText)
            } else {
                console.log('[GwenGuessr] Announce sent successfully')
            }
        } catch (announceError) {
            console.error('[GwenGuessr] Bot announce error:', announceError)
            // Don't fail the round start if announce fails
        }

        return NextResponse.json({
            round: {
                id: round.id,
                roundNumber: round.round_number,
                imageUrl: round.image_url,
                totalRounds: game.total_rounds,
                duration: game.round_duration
            }
        })
    } catch (error) {
        console.error('Start round error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
