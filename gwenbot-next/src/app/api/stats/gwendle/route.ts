import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'
    const wordLength = parseInt(searchParams.get('wordLength') || '5')

    // Calculate date filter
    let dateFilter = null
    const now = new Date()
    if (period === 'week') {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (period === 'month') {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    // Best average attempts (minimum 1 game)
    let query = supabase
        .from('gwendle_games')
        .select('player_id, players(username)')
        .eq('won', true)
        .eq('word_length', wordLength) // Filter by word length

    if (dateFilter) {
        query = query.gte('played_at', dateFilter)
    }

    const { data: games } = await query

    // Aggregate stats per player
    const playerStats: Record<number, { username: string; attempts: number[]; wins: number }> = {}

    if (games) {
        for (const game of games as any[]) {
            const pid = game.player_id
            if (!playerStats[pid]) {
                playerStats[pid] = {
                    username: game.players?.username || 'Unknown',
                    attempts: [],
                    wins: 0
                }
            }
            playerStats[pid].wins++
        }
    }

    // Get attempts data
    let attemptsQuery = supabase
        .from('gwendle_games')
        .select('player_id, attempts')
        .eq('won', true)
        .eq('word_length', wordLength)

    if (dateFilter) {
        attemptsQuery = attemptsQuery.gte('played_at', dateFilter)
    }

    const { data: attemptsData } = await attemptsQuery

    if (attemptsData) {
        for (const game of attemptsData) {
            if (playerStats[game.player_id]) {
                playerStats[game.player_id].attempts.push(game.attempts)
            }
        }
    }

    // Calculate averages and create leaderboard
    const leaderboard = Object.entries(playerStats)
        .filter(([_, stats]) => stats.attempts.length >= 1) // At least 1 game
        .map(([playerId, stats]) => ({
            playerId: parseInt(playerId),
            username: stats.username,
            wins: stats.wins,
            avgAttempts: stats.attempts.reduce((a, b) => a + b, 0) / stats.attempts.length,
            gamesPlayed: stats.attempts.length
        }))
        .sort((a, b) => a.avgAttempts - b.avgAttempts)
        .slice(0, 10)

    // Get best streaks (all time - streaks don't filter by period, but should filtering by length?)
    // Streaks currently are global per game type usually. Let's filter by length too for fairness.
    const { data: streakData } = await supabase
        .from('gwendle_games')
        .select('player_id, current_streak, players(username)')
        .eq('word_length', wordLength)
        .not('current_streak', 'is', null)
        .order('current_streak', { ascending: false })
        .limit(50)

    // Get max streak per player
    const maxStreaks: Record<number, { username: string; streak: number }> = {}
    if (streakData) {
        for (const g of streakData as any[]) {
            const pid = g.player_id
            const streak = g.current_streak || 0
            if (!maxStreaks[pid] || streak > maxStreaks[pid].streak) {
                maxStreaks[pid] = {
                    username: g.players?.username || 'Unknown',
                    streak
                }
            }
        }
    }

    const streakLeaderboard = Object.entries(maxStreaks)
        .map(([id, data]) => ({ playerId: parseInt(id), ...data }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 10)

    return NextResponse.json({ leaderboard, streakLeaderboard })
}

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { playerId, word, attempts, won, wordLength = 5 } = await request.json()

        // Check if game already exists FIRST (before calculating streak)
        const { data: existingGame } = await supabase
            .from('gwendle_games')
            .select('id, current_streak')
            .eq('player_id', playerId)
            .eq('word', word)
            .eq('word_length', wordLength)
            .maybeSingle()

        if (existingGame) {
            // Return the existing game's streak 
            return NextResponse.json({ success: true, message: 'Game already recorded', streak: existingGame.current_streak || 0 })
        }

        // Calculate streak for new game
        let currentStreak = 0
        if (won) {
            // Get last game for this player & word length
            const { data: lastGame } = await supabase
                .from('gwendle_games')
                .select('current_streak, won')
                .eq('player_id', playerId)
                .eq('word_length', wordLength)
                .order('played_at', { ascending: false })
                .limit(1)
                .single()

            // Continue streak only if last game was won  
            currentStreak = (lastGame?.won && lastGame?.current_streak) ? lastGame.current_streak + 1 : 1
        }

        const { error } = await supabase
            .from('gwendle_games')
            .insert({
                player_id: playerId,
                word,
                attempts,
                won,
                current_streak: currentStreak,
                word_length: wordLength
            })

        if (error) throw error
        return NextResponse.json({ success: true, streak: currentStreak })
    } catch (error) {
        console.error('Gwendle save error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
