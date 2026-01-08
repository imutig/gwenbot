import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()
        const { username, gameId } = body

        if (!username) {
            return NextResponse.json({ error: 'Username required' }, { status: 400 })
        }

        // Check if user is authorized
        const { data: authorizedUser } = await supabase
            .from('authorized_users')
            .select('username')
            .eq('username', username.toLowerCase())
            .single()

        if (!authorizedUser) {
            return NextResponse.json({ error: 'Only authorized users can cancel games' }, { status: 403 })
        }

        // Get active game
        const { data: game } = await supabase
            .from('sudoku_games')
            .select('id, host_id, players!sudoku_games_host_id_fkey(username)')
            .in('status', ['waiting', 'playing'])
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active game found' }, { status: 404 })
        }

        // Delete the queue entries first
        await supabase
            .from('sudoku_queue')
            .delete()
            .eq('game_id', game.id)

        // Delete the game
        await supabase
            .from('sudoku_games')
            .delete()
            .eq('id', game.id)

        // Broadcast game cancelled
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: { action: 'game_cancelled' }
        })

        return NextResponse.json({
            success: true,
            message: 'Partie annulée'
        })
    } catch (error) {
        console.error('Error cancelling game:', error)
        return NextResponse.json({ error: 'Failed to cancel game' }, { status: 500 })
    }
}
