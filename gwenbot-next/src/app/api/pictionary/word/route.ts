import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getRandomWordChoices } from '@/lib/pictionary-words'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET: Get word choices for current drawer
export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')
    const username = searchParams.get('username')?.toLowerCase()

    try {
        if (!gameId || !username) {
            return NextResponse.json({ error: 'gameId and username required' }, { status: 400 })
        }

        // Get player
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username)
            .single()

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }

        // Verify this player is the current drawer
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('current_drawer_id, current_word, current_round')
            .eq('id', gameId)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        if (game.current_drawer_id !== player.id) {
            return NextResponse.json({ error: 'Not your turn to draw' }, { status: 403 })
        }

        // If word already selected, return it
        if (game.current_word) {
            return NextResponse.json({
                wordSelected: true,
                word: game.current_word
            })
        }

        // Generate 3 word choices
        const wordChoices = getRandomWordChoices()

        return NextResponse.json({
            wordSelected: false,
            choices: wordChoices
        })

    } catch (error) {
        console.error('Error getting word choices:', error)
        return NextResponse.json({ error: 'Failed to get words' }, { status: 500 })
    }
}

// POST: Select a word
export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { gameId, username, word, wordChoices } = await request.json()

        if (!gameId || !username || !word) {
            return NextResponse.json({ error: 'gameId, username, and word required' }, { status: 400 })
        }

        // Verify drawer
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('username', username.toLowerCase())
            .single()

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }

        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, current_drawer_id, current_round')
            .eq('id', gameId)
            .single()

        if (!game || game.current_drawer_id !== player.id) {
            return NextResponse.json({ error: 'Not your turn to draw' }, { status: 403 })
        }

        // Update game with selected word and start timer
        await supabase
            .from('pictionary_games')
            .update({
                current_word: word,
                round_started_at: new Date().toISOString()
            })
            .eq('id', gameId)

        // Create round record
        await supabase
            .from('pictionary_rounds')
            .insert({
                game_id: gameId,
                drawer_id: player.id,
                word: word,
                word_choices: wordChoices || [],
                round_number: game.current_round
            })

        return NextResponse.json({
            success: true,
            word,
            message: 'Word selected! Start drawing!'
        })

    } catch (error) {
        console.error('Error selecting word:', error)
        return NextResponse.json({ error: 'Failed to select word' }, { status: 500 })
    }
}
