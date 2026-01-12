import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Calculate points based on distance (continuous exponential decay)
// Formula: 5000 * e^(-distance/2000) - gives smooth scoring where small differences matter
// Perfect guess (0m) = 5000 pts, 100km = 4756 pts, 500km = 3894 pts, 1000km = 3033 pts, 5000km = 410 pts
function calculatePoints(distanceKm: number): number {
    if (distanceKm <= 0.01) return 5000 // Within 10m = perfect score

    // Exponential decay formula: 5000 * e^(-d/2000)
    // Higher divisor = slower decay = more points at distance
    const points = Math.round(5000 * Math.exp(-distanceKm / 2000))

    // Minimum 0 points
    return Math.max(0, points)
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
        // Get active game in playing status
        const { data: game } = await supabaseAdmin
            .from('gwenguessr_games')
            .select('*')
            .eq('status', 'playing')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active round' }, { status: 404 })
        }

        // Get current round
        const { data: round } = await supabaseAdmin
            .from('gwenguessr_rounds')
            .select('*')
            .eq('game_id', game.id)
            .eq('round_number', game.current_round)
            .single()

        if (!round) {
            return NextResponse.json({ error: 'Round not found' }, { status: 404 })
        }

        // Calculate distances and points for all guesses
        const { data: guesses } = await supabaseAdmin
            .from('gwenguessr_guesses')
            .select('*, player:players!gwenguessr_guesses_player_id_fkey(username, avatar_seed)')
            .eq('round_id', round.id)

        const results = []
        if (guesses) {
            for (const guess of guesses) {
                const distance = calculateDistance(
                    round.correct_lat,
                    round.correct_lng,
                    guess.guess_lat,
                    guess.guess_lng
                )
                const points = calculatePoints(distance)

                // Update guess with calculated values
                await supabaseAdmin
                    .from('gwenguessr_guesses')
                    .update({
                        distance_km: Math.round(distance * 100) / 100,
                        points: points
                    })
                    .eq('id', guess.id)

                results.push({
                    playerId: guess.player_id,
                    username: (guess.player as { username: string })?.username || 'Unknown',
                    avatarSeed: (guess.player as { avatar_seed: string | null })?.avatar_seed,
                    guessLat: guess.guess_lat,
                    guessLng: guess.guess_lng,
                    distanceKm: Math.round(distance * 100) / 100,
                    points: points
                })
            }
        }

        // Sort by points descending
        results.sort((a, b) => b.points - a.points)

        // Update round end time
        await supabaseAdmin
            .from('gwenguessr_rounds')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', round.id)

        // Check if this was the last round
        const isLastRound = game.current_round >= game.total_rounds
        const newStatus = isLastRound ? 'finished' : 'between_rounds'

        // Update game status
        await supabaseAdmin
            .from('gwenguessr_games')
            .update({ status: newStatus })
            .eq('id', game.id)

        return NextResponse.json({
            roundNumber: round.round_number,
            correctLat: round.correct_lat,
            correctLng: round.correct_lng,
            country: round.country,
            city: round.city,
            results: results,
            isLastRound: isLastRound,
            gameStatus: newStatus
        })
    } catch (error) {
        console.error('End round error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
