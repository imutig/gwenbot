import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ROWS = 6
const COLS = 7

// Check for a win
function checkWin(board: (string | null)[][], player: string): { win: boolean; cells: [number, number][] } {
    // Check horizontal
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            if (board[row][col] === player &&
                board[row][col + 1] === player &&
                board[row][col + 2] === player &&
                board[row][col + 3] === player) {
                return { win: true, cells: [[row, col], [row, col + 1], [row, col + 2], [row, col + 3]] }
            }
        }
    }

    // Check vertical
    for (let row = 0; row <= ROWS - 4; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] === player &&
                board[row + 1][col] === player &&
                board[row + 2][col] === player &&
                board[row + 3][col] === player) {
                return { win: true, cells: [[row, col], [row + 1, col], [row + 2, col], [row + 3, col]] }
            }
        }
    }

    // Check diagonal (down-right)
    for (let row = 0; row <= ROWS - 4; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            if (board[row][col] === player &&
                board[row + 1][col + 1] === player &&
                board[row + 2][col + 2] === player &&
                board[row + 3][col + 3] === player) {
                return { win: true, cells: [[row, col], [row + 1, col + 1], [row + 2, col + 2], [row + 3, col + 3]] }
            }
        }
    }

    // Check diagonal (up-right)
    for (let row = 3; row < ROWS; row++) {
        for (let col = 0; col <= COLS - 4; col++) {
            if (board[row][col] === player &&
                board[row - 1][col + 1] === player &&
                board[row - 2][col + 2] === player &&
                board[row - 3][col + 3] === player) {
                return { win: true, cells: [[row, col], [row - 1, col + 1], [row - 2, col + 2], [row - 3, col + 3]] }
            }
        }
    }

    return { win: false, cells: [] }
}

// Check for draw
function checkDraw(board: (string | null)[][]): boolean {
    return board[0].every(cell => cell !== null)
}

// Create empty board
function createEmptyBoard(): (string | null)[][] {
    return Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
}

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    if (gameId) {
        const { data: game } = await supabase
            .from('connect4_games')
            .select(`
                *,
                host:host_id(id, username),
                challenger:challenger_id(id, username),
                winner:winner_id(id, username)
            `)
            .eq('id', gameId)
            .single()

        return NextResponse.json({ game })
    }

    // Get open lobbies
    const { data: lobbies } = await supabase
        .from('connect4_games')
        .select(`
            id,
            status,
            host:host_id(id, username),
            created_at
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(10)

    return NextResponse.json({ lobbies: lobbies || [] })
}

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()
        const { action, playerId, gameId, column } = body

        const getPlayer = async (id: number) => {
            const { data } = await supabase
                .from('players')
                .select('id, username')
                .eq('id', id)
                .single()
            return data
        }

        switch (action) {
            case 'create': {
                const player = await getPlayer(playerId)
                if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

                const { data: game, error } = await supabase
                    .from('connect4_games')
                    .insert({
                        status: 'waiting',
                        host_id: playerId,
                        board: createEmptyBoard(),
                        current_turn: 'host'
                    })
                    .select(`
                        *,
                        host:host_id(id, username)
                    `)
                    .single()

                if (error) throw error
                return NextResponse.json({ success: true, game })
            }

            case 'join': {
                const player = await getPlayer(playerId)
                if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

                const { data: game, error } = await supabase
                    .from('connect4_games')
                    .update({
                        challenger_id: playerId,
                        status: 'playing'
                    })
                    .eq('id', gameId)
                    .eq('status', 'waiting')
                    .select(`
                        *,
                        host:host_id(id, username),
                        challenger:challenger_id(id, username)
                    `)
                    .single()

                if (error) throw error
                return NextResponse.json({ success: true, game })
            }

            case 'play': {
                const { data: game } = await supabase
                    .from('connect4_games')
                    .select('*')
                    .eq('id', gameId)
                    .single()

                if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
                if (game.status !== 'playing') return NextResponse.json({ error: 'Game not in progress' }, { status: 400 })

                // Check if it's player's turn
                const isHost = playerId === game.host_id
                const isChallenger = playerId === game.challenger_id
                if (!isHost && !isChallenger) return NextResponse.json({ error: 'Not a player' }, { status: 403 })

                const expectedTurn = game.current_turn
                if ((isHost && expectedTurn !== 'host') || (isChallenger && expectedTurn !== 'challenger')) {
                    return NextResponse.json({ error: 'Not your turn' }, { status: 400 })
                }

                // Validate column
                if (column < 0 || column >= COLS) {
                    return NextResponse.json({ error: 'Invalid column' }, { status: 400 })
                }

                const board: (string | null)[][] = game.board

                // Check if column is full
                if (board[0][column] !== null) {
                    return NextResponse.json({ error: 'Column is full' }, { status: 400 })
                }

                // Find the lowest empty row in the column
                let targetRow = ROWS - 1
                for (let row = ROWS - 1; row >= 0; row--) {
                    if (board[row][column] === null) {
                        targetRow = row
                        break
                    }
                }

                // Place the piece
                const playerColor = isHost ? 'red' : 'yellow'
                board[targetRow][column] = playerColor

                // Check for win
                const winResult = checkWin(board, playerColor)
                const isDraw = !winResult.win && checkDraw(board)

                let status = game.status
                let winnerId = null

                if (winResult.win) {
                    status = 'finished'
                    winnerId = playerId
                } else if (isDraw) {
                    status = 'finished'
                }

                const nextTurn = isHost ? 'challenger' : 'host'

                const { data: updatedGame, error } = await supabase
                    .from('connect4_games')
                    .update({
                        board,
                        current_turn: nextTurn,
                        status,
                        winner_id: winnerId
                    })
                    .eq('id', gameId)
                    .select(`
                        *,
                        host:host_id(id, username),
                        challenger:challenger_id(id, username),
                        winner:winner_id(id, username)
                    `)
                    .single()

                if (error) throw error
                return NextResponse.json({
                    success: true,
                    game: updatedGame,
                    move: { row: targetRow, column },
                    winCells: winResult.cells,
                    isDraw
                })
            }

            case 'cancel': {
                const { error } = await supabase
                    .from('connect4_games')
                    .delete()
                    .eq('id', gameId)
                    .or(`host_id.eq.${playerId},status.eq.waiting`)

                if (error) throw error
                return NextResponse.json({ success: true })
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
        }
    } catch (error) {
        console.error('Connect4 API error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
