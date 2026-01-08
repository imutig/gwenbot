import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function DELETE(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { sessionId, username } = await request.json()

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        // Verify user is authorized
        if (!username) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }

        const { data: authUser } = await supabase
            .from('authorized_users')
            .select('username')
            .eq('username', username.toLowerCase())
            .single()

        if (!authUser) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }

        // Get all guesses from this session to rollback points
        const { data: guesses } = await supabase
            .from('session_guesses')
            .select('points, player_id')
            .eq('session_id', sessionId)

        // Rollback points from player_stats
        if (guesses && guesses.length > 0) {
            // Aggregate points by player
            const playerPoints: Record<number, number> = {}
            for (const guess of guesses) {
                if (guess.player_id) {
                    playerPoints[guess.player_id] = (playerPoints[guess.player_id] || 0) + (guess.points || 0)
                }
            }

            // Subtract points from each player
            for (const [playerId, points] of Object.entries(playerPoints)) {
                const { data: currentStats } = await supabase
                    .from('player_stats')
                    .select('total_points')
                    .eq('player_id', parseInt(playerId))
                    .single()

                if (currentStats) {
                    const newPoints = Math.max(0, (currentStats.total_points || 0) - points)
                    await supabase
                        .from('player_stats')
                        .update({ total_points: newPoints })
                        .eq('player_id', parseInt(playerId))
                }
            }
        }

        // Delete the guesses (cascade should handle this but let's be explicit)
        await supabase
            .from('session_guesses')
            .delete()
            .eq('session_id', sessionId)

        // Delete the session
        const { error: deleteError } = await supabase
            .from('game_sessions')
            .delete()
            .eq('id', sessionId)

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true, message: 'Session supprimée et points annulés' })
    } catch (error) {
        console.error('Error deleting session:', error)
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }
}
