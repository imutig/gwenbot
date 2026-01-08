import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { searchParams } = new URL(request.url)
        const difficulty = searchParams.get('difficulty') // optional filter

        // Build query for leaderboard
        let query = supabase
            .from('sudoku_games')
            .select(`
                id,
                difficulty,
                time_seconds,
                finished_at,
                winner:players!sudoku_games_winner_id_fkey(username)
            `)
            .eq('mode', 'solo')
            .eq('status', 'finished')
            .not('time_seconds', 'is', null)
            .order('time_seconds', { ascending: true })
            .limit(20)

        if (difficulty) {
            query = query.eq('difficulty', difficulty)
        }

        const { data: games, error } = await query

        if (error) throw error

        // Format leaderboard with unique usernames (best time per player)
        const userBestTimes = new Map<string, { time: number; difficulty: string; date: string }>()

        if (games) {
            for (const game of games) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const winner = game.winner as any
                const username = Array.isArray(winner) ? winner[0]?.username : winner?.username
                if (!username) continue

                const key = difficulty ? username : `${username}-${game.difficulty}`
                const existing = userBestTimes.get(key)

                if (!existing || game.time_seconds < existing.time) {
                    userBestTimes.set(key, {
                        time: game.time_seconds,
                        difficulty: game.difficulty,
                        date: game.finished_at
                    })
                }
            }
        }

        // Convert to array and sort
        const leaderboard = Array.from(userBestTimes.entries())
            .map(([key, data]) => ({
                username: difficulty ? key : key.split('-')[0],
                difficulty: data.difficulty,
                time_seconds: data.time,
                finished_at: data.date
            }))
            .sort((a, b) => a.time_seconds - b.time_seconds)
            .slice(0, 10)

        // Also get counts by difficulty
        const { data: easyCounts } = await supabase
            .from('sudoku_games')
            .select('*', { count: 'exact', head: true })
            .eq('mode', 'solo')
            .eq('status', 'finished')
            .eq('difficulty', 'easy')

        const { data: mediumCounts } = await supabase
            .from('sudoku_games')
            .select('*', { count: 'exact', head: true })
            .eq('mode', 'solo')
            .eq('status', 'finished')
            .eq('difficulty', 'medium')

        const { data: hardCounts } = await supabase
            .from('sudoku_games')
            .select('*', { count: 'exact', head: true })
            .eq('mode', 'solo')
            .eq('status', 'finished')
            .eq('difficulty', 'hard')

        return NextResponse.json({
            leaderboard,
            stats: {
                easy: easyCounts,
                medium: mediumCounts,
                hard: hardCounts
            }
        })
    } catch (error) {
        console.error('Error fetching leaderboard:', error)
        return NextResponse.json({ leaderboard: [], error: 'Failed to fetch leaderboard' })
    }
}
