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
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')
    const roundNumber = searchParams.get('round')

    try {
        // If specific round requested
        if (gameId && roundNumber) {
            const { data: round } = await supabase
                .from('gwenguessr_rounds')
                .select('*')
                .eq('game_id', parseInt(gameId))
                .eq('round_number', parseInt(roundNumber))
                .single()

            if (!round) {
                return NextResponse.json({ error: 'Round not found' }, { status: 404 })
            }

            // Get guesses for this round
            const { data: guesses } = await supabase
                .from('gwenguessr_guesses')
                .select('*, player:players!gwenguessr_guesses_player_id_fkey(username, avatar_seed)')
                .eq('round_id', round.id)
                .order('points', { ascending: false })

            return NextResponse.json({
                round: {
                    roundNumber: round.round_number,
                    imageUrl: round.image_url,
                    correctLat: round.correct_lat,
                    correctLng: round.correct_lng,
                    country: round.country,
                    city: round.city
                },
                guesses: guesses?.map(g => ({
                    username: (g.player as { username: string })?.username || 'Unknown',
                    avatarSeed: (g.player as { avatar_seed: string | null })?.avatar_seed,
                    guessLat: g.guess_lat,
                    guessLng: g.guess_lng,
                    distanceKm: g.distance_km,
                    points: g.points
                })) || []
            })
        }

        // Get latest game results
        const { data: game } = await supabase
            .from('gwenguessr_games')
            .select('*')
            .in('status', ['between_rounds', 'finished'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No results available' }, { status: 404 })
        }

        // Get all rounds for this game
        const { data: rounds } = await supabase
            .from('gwenguessr_rounds')
            .select('*')
            .eq('game_id', game.id)
            .order('round_number', { ascending: true })

        // Get all guesses grouped by player
        const { data: allGuesses } = await supabase
            .from('gwenguessr_guesses')
            .select('*, player:players!gwenguessr_guesses_player_id_fkey(username, avatar_seed)')
            .in('round_id', rounds?.map(r => r.id) || [])

        // Aggregate totals
        const playerTotals: Record<number, {
            username: string
            avatarSeed: string | null
            totalPoints: number
            totalDistance: number
            roundsPlayed: number
        }> = {}

        if (allGuesses) {
            for (const g of allGuesses) {
                if (!playerTotals[g.player_id]) {
                    playerTotals[g.player_id] = {
                        username: (g.player as { username: string })?.username || 'Unknown',
                        avatarSeed: (g.player as { avatar_seed: string | null })?.avatar_seed,
                        totalPoints: 0,
                        totalDistance: 0,
                        roundsPlayed: 0
                    }
                }
                playerTotals[g.player_id].totalPoints += g.points || 0
                playerTotals[g.player_id].totalDistance += g.distance_km || 0
                playerTotals[g.player_id].roundsPlayed += 1
            }
        }

        const finalLeaderboard = Object.values(playerTotals)
            .sort((a, b) => b.totalPoints - a.totalPoints)

        return NextResponse.json({
            game: {
                id: game.id,
                status: game.status,
                currentRound: game.current_round,
                totalRounds: game.total_rounds
            },
            rounds: rounds?.map(r => ({
                roundNumber: r.round_number,
                country: r.country,
                city: r.city
            })),
            leaderboard: finalLeaderboard
        })
    } catch (error) {
        console.error('Results error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
