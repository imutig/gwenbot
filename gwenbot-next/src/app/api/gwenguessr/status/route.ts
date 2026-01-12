import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get active game
        const { data: game } = await supabase
            .from('gwenguessr_games')
            .select(`
                id,
                status,
                current_round,
                total_rounds,
                round_duration,
                created_at,
                host:players!gwenguessr_games_host_id_fkey(username)
            `)
            .in('status', ['lobby', 'playing', 'between_rounds', 'finished'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ game: null, round: null })
        }

        // Get current round if playing, between rounds OR finished (last round)
        let round = null
        if (game.status === 'playing' || game.status === 'between_rounds' || game.status === 'finished') {
            const { data: currentRound } = await supabase
                .from('gwenguessr_rounds')
                .select('*')
                .eq('game_id', game.id)
                .eq('round_number', game.current_round)
                .single()

            round = currentRound
        }

        // Get leaderboard for this game
        const { data: leaderboard } = await supabase
            .from('gwenguessr_guesses')
            .select(`
                player_id,
                points,
                player:players!gwenguessr_guesses_player_id_fkey(username, avatar_seed)
            `)
            .in('round_id', (
                await supabase
                    .from('gwenguessr_rounds')
                    .select('id')
                    .eq('game_id', game.id)
            ).data?.map(r => r.id) || [])

        // Aggregate points per player
        const playerPoints: Record<number, { username: string; avatar_seed: string | null; totalPoints: number }> = {}
        if (leaderboard) {
            for (const g of leaderboard) {
                if (!playerPoints[g.player_id]) {
                    // Supabase returns joined data as array or object depending on relation
                    const playerData = Array.isArray(g.player) ? g.player[0] : g.player
                    playerPoints[g.player_id] = {
                        username: (playerData as { username?: string })?.username || 'Unknown',
                        avatar_seed: (playerData as { avatar_seed?: string | null })?.avatar_seed || null,
                        totalPoints: 0
                    }
                }
                playerPoints[g.player_id].totalPoints += g.points || 0
            }
        }

        const sortedLeaderboard = Object.entries(playerPoints)
            .map(([id, data]) => ({ playerId: parseInt(id), ...data }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, 20)

        // Get round guesses if between rounds OR finished (for results map)
        let roundGuesses: Array<{
            playerId: number
            username: string
            guessLat: number
            guessLng: number
            distanceKm: number
            points: number
        }> = []

        if ((game.status === 'between_rounds' || game.status === 'finished') && round) {
            const { data: guesses } = await supabase
                .from('gwenguessr_guesses')
                .select(`
                    player_id,
                    guess_lat,
                    guess_lng,
                    distance_km,
                    points,
                    player:players!gwenguessr_guesses_player_id_fkey(username)
                `)
                .eq('round_id', round.id)
                .order('points', { ascending: false })

            if (guesses) {
                roundGuesses = guesses.map(g => {
                    const playerData = Array.isArray(g.player) ? g.player[0] : g.player
                    return {
                        playerId: g.player_id,
                        username: (playerData as { username?: string })?.username || 'Unknown',
                        guessLat: g.guess_lat,
                        guessLng: g.guess_lng,
                        distanceKm: g.distance_km || 0,
                        points: g.points || 0
                    }
                })
            }
        }

        return NextResponse.json({
            game: {
                ...game,
                host: Array.isArray(game.host)
                    ? (game.host[0] as { username?: string })?.username
                    : (game.host as { username?: string })?.username
            },
            round: round ? {
                id: round.id,
                roundNumber: round.round_number,
                imageUrl: round.image_url,
                startedAt: round.started_at,
                // Only show correct location if between rounds OR finished
                ...((game.status === 'between_rounds' || game.status === 'finished') ? {
                    correctLat: round.correct_lat,
                    correctLng: round.correct_lng,
                    country: round.country,
                    city: round.city
                } : {})
            } : null,
            leaderboard: sortedLeaderboard,
            roundGuesses: roundGuesses
        })
    } catch (error) {
        console.error('GwenGuessr status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
