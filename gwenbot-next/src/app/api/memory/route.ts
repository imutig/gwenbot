import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Available emotes for cards
const EMOTES = [
    'xsgwenHug',
    'xsgwenHype',
    'xsgwenLol',
    'xsgwenLove',
    'xsgwenOuin',
    'xsgwenSip',
    'xsgwenWow'
]

// Shuffle array
function shuffle<T>(array: T[]): T[] {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

// Generate cards for a game
function generateCards(difficulty: 'easy' | 'hard'): string[] {
    const pairCount = difficulty === 'easy' ? 8 : 18
    // Select emotes, repeating if needed
    const selectedEmotes: string[] = []
    for (let i = 0; i < pairCount; i++) {
        selectedEmotes.push(EMOTES[i % EMOTES.length])
    }
    // Create pairs
    const cards = [...selectedEmotes, ...selectedEmotes]
    return shuffle(cards)
}

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    // If gameId provided, fetch that specific game
    if (gameId) {
        const { data: game } = await supabase
            .from('memory_games')
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

    // Otherwise get open lobbies
    const { data: lobbies } = await supabase
        .from('memory_games')
        .select(`
            id,
            mode,
            difficulty,
            status,
            host:host_id(id, username),
            created_at
        `)
        .eq('status', 'waiting')
        .eq('mode', '1v1')
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
        const { action, playerId, gameId, difficulty, cardIndex } = body

        // GET or CREATE player
        const getPlayer = async (id: number) => {
            const { data } = await supabase
                .from('players')
                .select('id, username')
                .eq('id', id)
                .single()
            return data
        }

        switch (action) {
            case 'create_solo': {
                const player = await getPlayer(playerId)
                if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

                const cards = generateCards(difficulty || 'easy')
                const { data: game, error } = await supabase
                    .from('memory_games')
                    .insert({
                        mode: 'solo',
                        difficulty: difficulty || 'easy',
                        status: 'playing',
                        host_id: playerId,
                        cards,
                        matched: [],
                        start_time: new Date().toISOString()
                    })
                    .select()
                    .single()

                if (error) throw error
                return NextResponse.json({ success: true, game })
            }

            case 'create_1v1': {
                const player = await getPlayer(playerId)
                if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

                const cards = generateCards(difficulty || 'easy')
                const { data: game, error } = await supabase
                    .from('memory_games')
                    .insert({
                        mode: '1v1',
                        difficulty: difficulty || 'easy',
                        status: 'waiting',
                        host_id: playerId,
                        cards,
                        matched: [],
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
                    .from('memory_games')
                    .update({
                        challenger_id: playerId,
                        status: 'playing',
                        start_time: new Date().toISOString()
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

            case 'flip': {
                // Get current game state
                const { data: game } = await supabase
                    .from('memory_games')
                    .select('*')
                    .eq('id', gameId)
                    .single()

                if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
                if (game.status !== 'playing') return NextResponse.json({ error: 'Game not in progress' }, { status: 400 })

                // Check if card is already matched
                const matched: number[] = game.matched || []
                if (matched.includes(cardIndex)) {
                    return NextResponse.json({ error: 'Card already matched' }, { status: 400 })
                }

                // Just return the card value - let client handle the logic
                const cards: string[] = game.cards
                return NextResponse.json({
                    success: true,
                    cardValue: cards[cardIndex],
                    game
                })
            }

            case 'match': {
                // Record a match
                const { card1, card2, isMatch } = body

                const { data: game } = await supabase
                    .from('memory_games')
                    .select('*')
                    .eq('id', gameId)
                    .single()

                if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

                const matched: number[] = [...(game.matched || [])]
                let hostPairs = game.host_pairs || 0
                let challengerPairs = game.challenger_pairs || 0
                let currentTurn = game.current_turn
                const moves = (game.moves || 0) + 1

                if (isMatch) {
                    matched.push(card1, card2)
                    if (game.mode === '1v1') {
                        if (currentTurn === 'host') {
                            hostPairs++
                        } else {
                            challengerPairs++
                        }
                        // Keep turn on match
                    }
                } else {
                    // Switch turn on mismatch in 1v1
                    if (game.mode === '1v1') {
                        currentTurn = currentTurn === 'host' ? 'challenger' : 'host'
                    }
                }

                // Check if game is complete
                const totalPairs = game.difficulty === 'easy' ? 8 : 18
                const isComplete = matched.length === totalPairs * 2

                let winnerId = null
                let status = game.status

                if (isComplete) {
                    status = 'finished'
                    if (game.mode === '1v1') {
                        if (hostPairs > challengerPairs) winnerId = game.host_id
                        else if (challengerPairs > hostPairs) winnerId = game.challenger_id
                        // null = tie
                    } else {
                        winnerId = game.host_id
                    }
                }

                const { data: updatedGame, error } = await supabase
                    .from('memory_games')
                    .update({
                        matched,
                        host_pairs: hostPairs,
                        challenger_pairs: challengerPairs,
                        current_turn: currentTurn,
                        moves,
                        status,
                        winner_id: winnerId,
                        end_time: isComplete ? new Date().toISOString() : null
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
                return NextResponse.json({ success: true, game: updatedGame, isComplete })
            }

            case 'cancel': {
                const { error } = await supabase
                    .from('memory_games')
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
        console.error('Memory API error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
