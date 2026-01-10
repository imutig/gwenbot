import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
    request: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { username } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get player ID
    const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('username', username.toLowerCase())
        .single()

    if (!player) {
        return NextResponse.json({
            watch_time_minutes: 0,
            streams_watched: 0,
            messages: 0,
            top_emojis: [],
            game_stats: {}
        })
    }

    // Get watch time
    const { data: presence } = await supabase
        .from('viewer_presence')
        .select('watch_time_seconds, stream_id')
        .eq('player_id', player.id)

    const watch_time_minutes = Math.floor((presence || []).reduce((acc, p) => acc + (p.watch_time_seconds || 0), 0) / 60)
    const streams_watched = new Set((presence || []).map(p => p.stream_id)).size

    // Get message count and emojis
    const { data: messages } = await supabase
        .from('chat_messages')
        .select('id, emojis')
        .eq('player_id', player.id)

    const messageCount = messages?.length || 0

    // Count emojis
    const emojiCount: Record<string, number> = {}
    messages?.forEach(m => {
        m.emojis?.forEach((e: string) => {
            emojiCount[e] = (emojiCount[e] || 0) + 1
        })
    })
    const top_emojis = Object.entries(emojiCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emoji, count]) => ({ emoji, count }))

    // Get game stats
    // Sudoku wins
    const { count: sudokuWins } = await supabase
        .from('sudoku_games')
        .select('id', { count: 'exact', head: true })
        .eq('winner_id', player.id)
        .eq('status', 'finished')

    // Memory wins
    const { count: memoryWins } = await supabase
        .from('memory_games')
        .select('id', { count: 'exact', head: true })
        .eq('winner_id', player.id)
        .eq('status', 'finished')
        .eq('mode', '1v1')

    // Memory best solo (fewest moves)
    const { data: memorySolo } = await supabase
        .from('memory_games')
        .select('moves')
        .eq('host_id', player.id)
        .eq('mode', 'solo')
        .eq('status', 'finished')
        .order('moves', { ascending: true })
        .limit(1)

    // Gwendle stats
    const { data: gwendleGames } = await supabase
        .from('gwendle_games')
        .select('attempts, won')
        .eq('player_id', player.id)

    const gwendleWins = gwendleGames?.filter(g => g.won).length || 0
    const gwendleAvgAttempts = gwendleGames?.length
        ? (gwendleGames.filter(g => g.won).reduce((a, g) => a + g.attempts, 0) / Math.max(gwendleWins, 1)).toFixed(1)
        : null

    // Cemantig wins
    const { count: cemantigWins } = await supabase
        .from('cemantig_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('winner_id', player.id)

    // Connect4 wins
    const { count: connect4Wins } = await supabase
        .from('connect4_games')
        .select('id', { count: 'exact', head: true })
        .eq('winner_id', player.id)
        .eq('status', 'finished')

    // BR wins
    const { data: brPlayer } = await supabase
        .from('player_stats')
        .select('sudoku_br_wins')
        .eq('player_id', player.id)
        .single()

    return NextResponse.json({
        watch_time_minutes,
        streams_watched,
        messages: messageCount,
        top_emojis,
        game_stats: {
            sudoku_wins: sudokuWins || 0,
            sudoku_br_wins: brPlayer?.sudoku_br_wins || 0,
            memory_wins: memoryWins || 0,
            memory_best_solo: memorySolo?.[0]?.moves || null,
            gwendle_wins: gwendleWins,
            gwendle_avg_attempts: gwendleAvgAttempts,
            cemantig_wins: cemantigWins || 0,
            connect4_wins: connect4Wins || 0
        }
    })
}
