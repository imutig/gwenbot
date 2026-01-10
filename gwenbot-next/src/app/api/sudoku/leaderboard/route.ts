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

        // Build query for leaderboard (includes both solo and 1v1)
        let query = supabase
            .from('sudoku_games')
            .select(`
                id,
                difficulty,
                time_seconds,
                finished_at,
                winner:players!sudoku_games_winner_id_fkey(username)
            `)
            .eq('status', 'finished')
            .not('time_seconds', 'is', null)
            .order('time_seconds', { ascending: true })
            .limit(20)

        if (difficulty) {
            query = query.eq('difficulty', difficulty)
        }

        const { data: games, error } = await query

        if (error) throw error

        // Format leaderboard - each game entry with its difficulty
        const allEntries = (games || []).map(game => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const winner = game.winner as any
            const username = Array.isArray(winner) ? winner[0]?.username : winner?.username
            return {
                username: username || 'Anonyme',
                difficulty: game.difficulty,
                time_seconds: game.time_seconds,
                finished_at: game.finished_at
            }
        }).filter(g => g.username !== 'Anonyme')
            .sort((a, b) => a.time_seconds - b.time_seconds)

        // Deduplicate: keep only best time per player
        const seen = new Set<string>()
        const leaderboard = allEntries.filter(entry => {
            if (seen.has(entry.username)) return false
            seen.add(entry.username)
            return true
        }).slice(0, 50) // Return more entries for client-side filtering

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
