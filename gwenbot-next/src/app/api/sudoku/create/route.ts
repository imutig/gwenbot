import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Simple Sudoku generator
function generateSudoku(difficulty: 'easy' | 'medium' | 'hard'): { puzzle: string, solution: string } {
    // This is a simplified generator - for production use a proper library
    const solution = [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 1, 5, 3, 7, 2, 8, 4],
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 5, 2, 8, 6, 1, 7, 9]
    ]

    // Shuffle rows within blocks
    for (let block = 0; block < 3; block++) {
        const rows = [block * 3, block * 3 + 1, block * 3 + 2]
        for (let i = rows.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
                ;[solution[rows[i]], solution[rows[j]]] = [solution[rows[j]], solution[rows[i]]]
        }
    }

    const solutionStr = solution.flat().join('')

    // Remove cells based on difficulty
    const cellsToRemove = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 55
    const puzzle = solution.flat()
    const indices = [...Array(81).keys()]

    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    for (let i = 0; i < cellsToRemove; i++) {
        puzzle[indices[i]] = 0
    }

    return {
        puzzle: puzzle.join(''),
        solution: solutionStr
    }
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

        // 1v1 mode - must be authenticated and be xsgwen
        if (!userId || !username) {
            return NextResponse.json({ error: 'Authentication required for 1v1' }, { status: 401 })
        }

        if (username.toLowerCase() !== 'xsgwen') {
            return NextResponse.json({ error: 'Only the streamer can create 1v1 games' }, { status: 403 })
        }

        // Check for existing active game
        const { data: existingGame } = await supabase
            .from('sudoku_games')
            .select('id')
            .in('status', ['waiting', 'picking', 'playing'])
            .single()

        if (existingGame) {
            return NextResponse.json({ error: 'A game is already in progress' }, { status: 400 })
        }

        // Get or create player
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

        // Create game
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
                challenger_progress: ''
            })
            .select('id, mode, difficulty, puzzle, status, created_at')
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            game
        })
    } catch (error) {
        console.error('Error creating game:', error)
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
    }
}
