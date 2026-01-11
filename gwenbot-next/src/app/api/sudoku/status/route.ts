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
    const username = searchParams.get('username')?.toLowerCase()

    try {
        // Get player ID if username provided
        let playerId: number | null = null
        if (username) {
            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username)
                .single()
            playerId = player?.id || null
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatPlayer = (p: any) => {
            if (!p) return null
            if (Array.isArray(p)) return p[0] ? { id: p[0].id, username: p[0].username } : null
            return { id: p.id, username: p.username }
        }

        // ========== 1. Get ALL waiting lobbies (1v1 and BR) ==========
        const { data: waitingGames } = await supabase
            .from('sudoku_games')
            .select(`
                id,
                mode,
                difficulty,
                status,
                is_battle_royale,
                created_at,
                host:players!sudoku_games_host_id_fkey(id, username)
            `)
            .eq('status', 'waiting')
            .neq('mode', 'solo')
            .order('created_at', { ascending: false })

        // Format lobbies with player counts
        const lobbies = await Promise.all((waitingGames || []).map(async (game) => {
            let playerCount = 0

            if (game.is_battle_royale || game.mode === 'battle_royale') {
                // BR: count from sudoku_br_players
                const { count } = await supabase
                    .from('sudoku_br_players')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', game.id)
                playerCount = count || 0
            } else {
                // 1v1: count from sudoku_queue
                const { count } = await supabase
                    .from('sudoku_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', game.id)
                playerCount = count || 0
            }

            return {
                id: game.id,
                mode: game.mode,
                difficulty: game.difficulty,
                isBattleRoyale: game.is_battle_royale || game.mode === 'battle_royale',
                host: formatPlayer(game.host),
                playerCount,
                createdAt: game.created_at
            }
        }))

        // ========== 2. Get playing games (for spectate later) ==========
        const { data: playingGames } = await supabase
            .from('sudoku_games')
            .select(`
                id,
                mode,
                difficulty,
                is_battle_royale,
                host:players!sudoku_games_host_id_fkey(id, username),
                challenger:players!sudoku_games_challenger_id_fkey(id, username)
            `)
            .eq('status', 'playing')
            .neq('mode', 'solo')
            .order('created_at', { ascending: false })

        const activeSessions = (playingGames || []).map(game => ({
            id: game.id,
            mode: game.mode,
            difficulty: game.difficulty,
            isBattleRoyale: game.is_battle_royale || game.mode === 'battle_royale',
            host: formatPlayer(game.host),
            challenger: formatPlayer(game.challenger)
        }))

        // ========== 3. Get user's active game (if any) ==========
        let myGame = null

        if (playerId) {
            // Check 1v1 game where user is host or challenger
            const { data: my1v1 } = await supabase
                .from('sudoku_games')
                .select(`
                    id,
                    mode,
                    difficulty,
                    puzzle,
                    solution,
                    status,
                    host_progress,
                    challenger_progress,
                    is_battle_royale,
                    created_at,
                    started_at,
                    host:players!sudoku_games_host_id_fkey(id, username),
                    challenger:players!sudoku_games_challenger_id_fkey(id, username),
                    winner:players!sudoku_games_winner_id_fkey(id, username)
                `)
                .in('status', ['waiting', 'playing'])
                .or(`host_id.eq.${playerId},challenger_id.eq.${playerId}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (my1v1) {
                const isThisGameBR = my1v1.is_battle_royale || my1v1.mode === 'battle_royale'

                if (isThisGameBR) {
                    // This is actually a BR game where user is host
                    // Get BR players
                    const { data: brPlayersData } = await supabase
                        .from('sudoku_br_players')
                        .select('player_id, progress, cells_filled, errors, status, finish_rank, finish_time, players!inner(username)')
                        .eq('game_id', my1v1.id)
                        .order('cells_filled', { ascending: false })

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const brPlayers = (brPlayersData || []).map((p: any) => ({
                        playerId: p.player_id,
                        username: Array.isArray(p.players) ? p.players[0]?.username : p.players?.username,
                        progress: p.progress,
                        cellsFilled: p.cells_filled,
                        errors: p.errors,
                        status: p.status,
                        finishRank: p.finish_rank,
                        finishTime: p.finish_time
                    })).sort((a: { status: string; finishRank?: number; finishTime?: number; cellsFilled: number }, b: { status: string; finishRank?: number; finishTime?: number; cellsFilled: number }) => {
                        // Finished players first, sorted by finish rank (1st place first)
                        if (a.status === 'finished' && b.status === 'finished') {
                            return (a.finishRank || 999) - (b.finishRank || 999)
                        }
                        // Finished players before playing/eliminated
                        if (a.status === 'finished') return -1
                        if (b.status === 'finished') return 1
                        // Playing players before eliminated
                        if (a.status === 'playing' && b.status === 'eliminated') return -1
                        if (a.status === 'eliminated' && b.status === 'playing') return 1
                        // Among same status, sort by cells filled (most first)
                        return b.cellsFilled - a.cellsFilled
                    })

                    const activePlayers = brPlayers.filter((p: { status: string }) => p.status === 'playing')
                    const leader = activePlayers.length > 0 ? activePlayers[0] : brPlayers[0]

                    // Find current player's status
                    const myBRData = brPlayers.find((p: { playerId: number }) => p.playerId === playerId)

                    myGame = {
                        id: my1v1.id,
                        mode: my1v1.mode,
                        difficulty: my1v1.difficulty,
                        puzzle: my1v1.puzzle,
                        solution: my1v1.solution,
                        status: my1v1.status,
                        isBattleRoyale: true,
                        createdAt: my1v1.created_at,
                        startedAt: my1v1.started_at,
                        host: formatPlayer(my1v1.host),
                        winner: formatPlayer(my1v1.winner),
                        brPlayers,
                        leaderProgress: leader?.progress || '',
                        leaderUsername: leader?.username || '',
                        myStatus: myBRData?.status || 'playing',
                        myRank: myBRData?.finishRank || null,
                        myErrors: myBRData?.errors || 0
                    }
                } else {
                    // Regular 1v1 game
                    let queue: { username: string }[] = []
                    if (my1v1.status === 'waiting') {
                        const { data: queueData } = await supabase
                            .from('sudoku_queue')
                            .select('player_id, players!inner(username)')
                            .eq('game_id', my1v1.id)
                            .order('joined_at', { ascending: true })

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        queue = (queueData || []).map((q: any) => ({
                            username: Array.isArray(q.players) ? q.players[0]?.username : q.players?.username
                        }))
                    }

                    myGame = {
                        id: my1v1.id,
                        mode: my1v1.mode,
                        difficulty: my1v1.difficulty,
                        puzzle: my1v1.puzzle,
                        solution: my1v1.solution,
                        status: my1v1.status,
                        isBattleRoyale: false,
                        hostProgress: my1v1.host_progress,
                        challengerProgress: my1v1.challenger_progress,
                        createdAt: my1v1.created_at,
                        startedAt: my1v1.started_at,
                        host: formatPlayer(my1v1.host),
                        challenger: formatPlayer(my1v1.challenger),
                        winner: formatPlayer(my1v1.winner),
                        queue
                    }
                }
            }

            // Check BR game where user is active participant (not abandoned/eliminated)
            if (!myGame) {
                const { data: brParticipant } = await supabase
                    .from('sudoku_br_players')
                    .select('game_id, status')
                    .eq('player_id', playerId)
                    .in('status', ['waiting', 'playing', 'finished']) // Include finished, exclude eliminated (abandoned)
                    .limit(1)
                    .maybeSingle()

                if (brParticipant) {
                    const { data: brGame } = await supabase
                        .from('sudoku_games')
                        .select(`
                            id,
                            mode,
                            difficulty,
                            puzzle,
                            solution,
                            status,
                            is_battle_royale,
                            created_at,
                            started_at,
                            host:players!sudoku_games_host_id_fkey(id, username),
                            winner:players!sudoku_games_winner_id_fkey(id, username)
                        `)
                        .eq('id', brParticipant.game_id)
                        .in('status', ['waiting', 'playing'])
                        .maybeSingle()

                    if (brGame) {
                        // Get all BR players
                        const { data: brPlayersData } = await supabase
                            .from('sudoku_br_players')
                            .select('player_id, progress, cells_filled, errors, status, finish_rank, finish_time, players!inner(username)')
                            .eq('game_id', brGame.id)
                            .order('cells_filled', { ascending: false })

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const brPlayers = (brPlayersData || []).map((p: any) => ({
                            playerId: p.player_id,
                            username: Array.isArray(p.players) ? p.players[0]?.username : p.players?.username,
                            progress: p.progress,
                            cellsFilled: p.cells_filled,
                            errors: p.errors,
                            status: p.status,
                            finishRank: p.finish_rank,
                            finishTime: p.finish_time
                        })).sort((a: { status: string; finishRank?: number; cellsFilled: number }, b: { status: string; finishRank?: number; cellsFilled: number }) => {
                            // Finished players first, sorted by finish rank
                            if (a.status === 'finished' && b.status === 'finished') {
                                return (a.finishRank || 999) - (b.finishRank || 999)
                            }
                            if (a.status === 'finished') return -1
                            if (b.status === 'finished') return 1
                            if (a.status === 'playing' && b.status === 'eliminated') return -1
                            if (a.status === 'eliminated' && b.status === 'playing') return 1
                            return b.cellsFilled - a.cellsFilled
                        })

                        const activePlayers = brPlayers.filter((p: { status: string }) => p.status === 'playing')
                        const leader = activePlayers.length > 0 ? activePlayers[0] : brPlayers[0]

                        myGame = {
                            id: brGame.id,
                            mode: brGame.mode,
                            difficulty: brGame.difficulty,
                            puzzle: brGame.puzzle,
                            solution: brGame.solution,
                            status: brGame.status,
                            isBattleRoyale: true,
                            createdAt: brGame.created_at,
                            startedAt: brGame.started_at,
                            host: formatPlayer(brGame.host),
                            winner: formatPlayer(brGame.winner),
                            brPlayers,
                            leaderProgress: leader?.progress || '',
                            leaderUsername: leader?.username || ''
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            myGame,
            lobbies,
            activeSessions
        })

    } catch (error) {
        console.error('Error fetching status:', error)
        return NextResponse.json({
            myGame: null,
            lobbies: [],
            activeSessions: [],
            error: 'Failed to fetch status'
        })
    }
}
