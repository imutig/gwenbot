import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Get the current playing Pictionary game (for bot guessing)
export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Find any game that is currently in 'playing' status
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, status, current_word, current_drawer_id')
            .eq('status', 'playing')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({
                active: false,
                game: null
            })
        }

        return NextResponse.json({
            active: true,
            game: {
                id: game.id,
                status: game.status,
                hasWord: !!game.current_word
            }
        })

    } catch (error) {
        console.error('Error getting current game:', error)
        return NextResponse.json({ active: false, game: null })
    }
}
