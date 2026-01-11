import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSudoku } from 'sudoku-gen'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Map difficulty names to sudoku-gen format
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

function generateSudoku(difficulty: Difficulty): { puzzle: string, solution: string } {
    // sudoku-gen guarantees unique solutions
    const sudoku = getSudoku(difficulty)

    // sudoku-gen uses '-' for empty cells, we use '0'
    const puzzle = sudoku.puzzle.replace(/-/g, '0')
    const solution = sudoku.solution

    return { puzzle, solution }
}

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()
        const { mode, difficulty, userId, username } = body

        if (!mode || !difficulty) {
            return NextResponse.json({ error: 'Mode and difficulty required' }, { status: 400 })
        }

        // Generate puzzle
        const { puzzle, solution } = generateSudoku(difficulty)

        // Debug: Log solution for testing
        console.log(`[Sudoku Create] Solution for testing: ${solution}`)

        if (mode === 'solo') {
            // Solo mode - no DB storage, just return puzzle
            return NextResponse.json({
                success: true,
                game: {
                    mode: 'solo',
                    puzzle,
                    solution, // Client validates locally for solo
                    difficulty
                }
            })
        }

        // 1v1 or Battle Royale mode - must be authenticated
        if (!userId || !username) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        // Get or create player first (moved up)
        let { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            const { data: newPlayer } = await supabase
                .from('players')
                .insert({ username: username.toLowerCase() })
                .select('id')
                .single()
            player = newPlayer
        }

        // Check if user already hosts a lobby (waiting or playing)
        // Users can JOIN other lobbies, but can only CREATE one at a time
        const { data: existingLobby } = await supabase
            .from('sudoku_games')
            .select('id, status, mode')
            .eq('host_id', player?.id)
            .in('status', ['waiting', 'picking', 'playing'])
            .limit(1)
            .maybeSingle()

        console.log('[Sudoku Create] Host check:', { playerId: player?.id, existingLobby })

        if (existingLobby) {
            console.log('[Sudoku Create] BLOCKED - user already hosts a lobby')
            return NextResponse.json({
                error: 'Tu as déjà un lobby en cours',
                details: `Game #${existingLobby.id} (${existingLobby.mode}, ${existingLobby.status})`
            }, { status: 400 })
        }

        // Handle Battle Royale mode
        if (mode === 'battle_royale') {
            // Create BR game
            const { data: game, error } = await supabase
                .from('sudoku_games')
                .insert({
                    mode: 'battle_royale',
                    difficulty,
                    puzzle,
                    solution,
                    status: 'waiting',
                    host_id: player?.id,
                    is_battle_royale: true
                })
                .select('id, mode, difficulty, puzzle, status, created_at')
                .single()

            if (error) throw error

            // Add host as first BR player
            await supabase
                .from('sudoku_br_players')
                .insert({
                    game_id: game.id,
                    player_id: player?.id,
                    progress: '',
                    cells_filled: 0,
                    errors: 0,
                    status: 'playing'
                })

            // Broadcast session creation
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: { action: 'br_session_created', host: username, gameId: game.id }
            })

            return NextResponse.json({
                success: true,
                game
            })
        }

        // 1v1 mode
        const { data: game, error } = await supabase
            .from('sudoku_games')
            .insert({
                mode: '1v1',
                difficulty,
                puzzle,
                solution,
                status: 'waiting',
                host_id: player?.id,
                host_progress: '',
                challenger_progress: '',
                is_battle_royale: false
            })
            .select('id, mode, difficulty, puzzle, status, created_at')
            .single()

        if (error) throw error

        // Broadcast session creation so other players see the queue
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: { action: 'session_created', host: username }
        })

        return NextResponse.json({
            success: true,
            game
        })
    } catch (error) {
        console.error('Error creating game:', error)
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }
}
