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

        // Get active game first (including recently finished that might need cleanup)
        let query = supabase
            .from('sudoku_games')
            .select('id, host_id, status, players!sudoku_games_host_id_fkey(username)')
            .in('status', ['waiting', 'playing', 'finished'])

        // If gameId provided, target that specific game
        if (gameId) {
            query = query.eq('id', gameId)
        } else {
            query = query.order('created_at', { ascending: false }).limit(1)
        }

        const { data: game } = await query.maybeSingle()

        if (!game) {
            return NextResponse.json({ error: 'No active game found' }, { status: 404 })
        }

        // Check if user is host of this game
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hostUsername = (game.players as any)?.username?.toLowerCase()
        const isHost = hostUsername === username.toLowerCase()

        // If not the host, check if user is authorized
        if (!isHost) {
            const { data: authorizedUser } = await supabase
                .from('authorized_users')
                .select('username')
                .eq('username', username.toLowerCase())
                .single()

            if (!authorizedUser) {
                return NextResponse.json({ error: 'Only the host or authorized users can cancel games' }, { status: 403 })
            }
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
