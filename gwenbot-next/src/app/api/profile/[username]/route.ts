import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { username } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // 1. Get Player ID
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, username, created_at, avatar_seed')
            .ilike('username', username)
            .single()

        if (playerError || !player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }

        // 2. Get Player Stats
        const { data: stats } = await supabase
            .from('player_stats')
            .select('*')
            .eq('player_id', player.id)
            .single()

        // 3. Get Recent Sudoku Games (Solo & 1v1)
        const { data: games } = await supabase
            .from('sudoku_games')
            .select(`
                id,
                mode,
                difficulty,
                status,
                started_at,
                finished_at,
                time_seconds,
                winner_id,
                host_id,
                challenger_id,
                is_battle_royale,
                host:players!sudoku_games_host_id_fkey(username),
                challenger:players!sudoku_games_challenger_id_fkey(username),
                winner:players!sudoku_games_winner_id_fkey(username)
            `)
            .or(`host_id.eq.${player.id},challenger_id.eq.${player.id},winner_id.eq.${player.id}`)
            .eq('status', 'finished')
            .order('finished_at', { ascending: false })
            .limit(20)

        // 4. Get Recent Sudoku BR Games
        const { data: brGames } = await supabase
            .from('sudoku_br_players')
            .select(`
                id,
                finish_rank,
                finish_time,
                status,
                game:sudoku_games!sudoku_br_players_game_id_fkey (
                    id,
                    started_at,
                    finished_at,
                    difficulty,
                    mode
                )
            `)
            .eq('player_id', player.id)
            .eq('status', 'finished')
            .order('finished_at', { ascending: false })
            .limit(20)

        // 5. Get Accurate Counts
        const { count: sudokuCount } = await supabase
            .from('sudoku_games')
            .select('id', { count: 'exact', head: true })
            .or(`host_id.eq.${player.id},challenger_id.eq.${player.id},winner_id.eq.${player.id}`)
            .eq('status', 'finished')

        const { count: brCount } = await supabase
            .from('sudoku_br_players')
            .select('id', { count: 'exact', head: true })
            .eq('player_id', player.id)
            .eq('status', 'finished')

        // Get Pictionary Games Count
        const { count: pictionaryCount } = await supabase
            .from('pictionary_players')
            .select('player_id', { count: 'exact', head: true })
            .eq('player_id', player.id)

        // Get Wins
        const { count: sudokuWins } = await supabase
            .from('sudoku_games')
            .select('id', { count: 'exact', head: true })
            .eq('winner_id', player.id)
            .eq('status', 'finished')

        const { count: brWins } = await supabase
            .from('sudoku_br_players')
            .select('id', { count: 'exact', head: true })
            .eq('player_id', player.id)
            .eq('finish_rank', 1)
            .eq('status', 'finished')

        const totalSudokuGames = (sudokuCount || 0) + (brCount || 0)
        const totalPictionaryGames = pictionaryCount || 0
        const totalWins = (sudokuWins || 0) + (brWins || 0)

        // Combine and format history
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history: any[] = []

        // Format standard games
        if (games) {
            for (const game of games) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const isWinner = game.winner_id === player.id
                let result = 'Terminé'

                if (game.mode === '1v1') {
                    result = isWinner ? 'Victoire' : 'Défaite'
                }

                history.push({
                    id: `sudoku-${game.id}`,
                    date: game.finished_at || game.started_at,
                    mode: game.mode === '1v1' ? 'Duel 1v1' : 'Solo',
                    difficulty: game.difficulty,
                    time: game.time_seconds,
                    result,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    opponent: game.host_id === player.id ? (game.challenger as any)?.username : (game.host as any)?.username,
                    isWinner
                })
            }
        }

        // Format BR games
        if (brGames) {
            for (const br of brGames) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const game = br.game as any
                history.push({
                    id: `br-${br.id}`,
                    date: br.game ? (game.finished_at || game.started_at) : null,
                    mode: 'Battle Royale',
                    difficulty: game?.difficulty || 'medium',
                    time: br.finish_time,
                    result: `Rang #${br.finish_rank}`,
                    opponent: `${br.finish_rank === 1 ? 'Victoire' : 'Top ' + br.finish_rank}`,
                    isWinner: br.finish_rank === 1
                })
            }
        }

        // Sort combined history by date desc
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        return NextResponse.json({
            player,
            stats: stats || {},
            totalSudokuGames,
            totalPictionaryGames,
            totalWins,
            history: history.slice(0, 20)
        })
    } catch (error) {
        console.error('Profile API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
