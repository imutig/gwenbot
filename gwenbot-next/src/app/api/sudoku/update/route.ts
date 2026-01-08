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
        const body = await request.json()
        const { username, progress } = body

        if (!username || progress === undefined) {
            return NextResponse.json({ error: 'Username and progress required' }, { status: 400 })
        }

        // Get active game
        const { data: game } = await supabase
            .from('sudoku_games')
            .select(`
                id, 
                solution,
                host_id,
                challenger_id,
                players!sudoku_games_host_id_fkey(username)
            `)
            .eq('status', 'playing')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'No active game' }, { status: 404 })
        }

        // Determine if user is host or challenger
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hostPlayers = (game as any).players as { username: string } | { username: string }[]
        const hostUsername = Array.isArray(hostPlayers) ? hostPlayers[0]?.username : hostPlayers?.username
        const isHost = hostUsername?.toLowerCase() === username.toLowerCase()

        // Update the correct progress field
        const updateField = isHost ? 'host_progress' : 'challenger_progress'

        const { error: updateError } = await supabase
            .from('sudoku_games')
            .update({ [updateField]: progress })
            .eq('id', game.id)

        if (updateError) throw updateError

        // Check if completed (progress matches solution)
        const isComplete = progress === game.solution

        if (isComplete) {
            // Get player id
            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username.toLowerCase())
                .single()

            // Mark game as finished with winner
            await supabase
                .from('sudoku_games')
                .update({
                    status: 'finished',
                    winner_id: player?.id,
                    finished_at: new Date().toISOString()
                })
                .eq('id', game.id)

            // Broadcast the update
            await supabase.channel('sudoku-broadcast').send({
                type: 'broadcast',
                event: 'sudoku_update',
                payload: { action: 'game_finished', winner: username }
            })

            return NextResponse.json({
                success: true,
                complete: true,
                winner: username,
                message: `🎉 ${username} a gagné !`
            })
        }

        // Broadcast progress update
        await supabase.channel('sudoku-broadcast').send({
            type: 'broadcast',
            event: 'sudoku_update',
            payload: { action: 'progress_update', username }
        })

        return NextResponse.json({
            success: true,
            complete: false
        })
    } catch (error) {
        console.error('Error updating progress:', error)
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }
}
