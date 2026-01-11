import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { gameId, username } = await request.json()

        if (!gameId || !username) {
            return NextResponse.json({ error: 'gameId and username required' }, { status: 400 })
        }

        // Get game
        const { data: game } = await supabase
            .from('pictionary_games')
            .select('id, host_id, status, host:players!pictionary_games_host_id_fkey(username)')
            .eq('id', gameId)
            .single()

        if (!game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        // Check if user is the host
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hostData = game.host as any
        const hostUsername = Array.isArray(hostData) ? hostData[0]?.username : hostData?.username

        if (hostUsername?.toLowerCase() !== username.toLowerCase()) {
            return NextResponse.json({ error: 'Only host can cancel the game' }, { status: 403 })
        }

        // Cancel the game
        await supabase
            .from('pictionary_games')
            .update({
                status: 'cancelled',
                finished_at: new Date().toISOString()
            })
            .eq('id', gameId)

        // Remove all players from the game
        await supabase
            .from('pictionary_players')
            .delete()
            .eq('game_id', gameId)

        return NextResponse.json({
            success: true,
            message: 'Game cancelled'
        })

    } catch (error) {
        console.error('Error cancelling pictionary game:', error)
        return NextResponse.json({ error: 'Failed to cancel game' }, { status: 500 })
    }
}
