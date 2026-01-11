import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')
    const username = searchParams.get('username')?.toLowerCase()

    try {
        if (!gameId) {
            return NextResponse.json({ error: 'gameId required' }, { status: 400 })
        }

        // Get game with current drawer info
        const { data: game, error: gameError } = await supabase
            .from('pictionary_games')
            .select(`
                id,
                status,
                max_players,
                current_round,
                current_word,
                round_started_at,
                host:players!pictionary_games_host_id_fkey(id, username),
                current_drawer:players!pictionary_games_current_drawer_id_fkey(id, username)
            `)
            .eq('id', gameId)
            .single()

        if (gameError || !game) {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        // Get all players with scores
        const { data: players } = await supabase
            .from('pictionary_players')
            .select('player_id, score, draw_order, has_drawn, players!inner(username)')
            .eq('game_id', gameId)
            .order('draw_order', { ascending: true })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedPlayers = (players || []).map((p: any) => ({
            id: p.player_id,
            username: Array.isArray(p.players) ? p.players[0]?.username : p.players?.username,
            score: p.score,
            drawOrder: p.draw_order,
            hasDrawn: p.has_drawn
        }))

        // Get current player info if username provided
        let currentPlayer = null
        let isHost = false
        let isDrawer = false

        if (username) {
            const { data: player } = await supabase
                .from('players')
                .select('id')
                .eq('username', username)
                .single()

            if (player) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const hostData = game.host as any
                const hostId = Array.isArray(hostData) ? hostData[0]?.id : hostData?.id
                isHost = hostId === player.id

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const drawerData = game.current_drawer as any
                const drawerId = Array.isArray(drawerData) ? drawerData[0]?.id : drawerData?.id
                isDrawer = drawerId === player.id

                currentPlayer = formattedPlayers.find(p => p.id === player.id)
            }
        }

        // Calculate time remaining if round is active
        let timeRemaining = null
        if (game.round_started_at && game.status === 'playing') {
            const startTime = new Date(game.round_started_at).getTime()
            const elapsed = (Date.now() - startTime) / 1000
            timeRemaining = Math.max(0, 180 - elapsed) // 3 minutes
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hostData = game.host as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drawerData = game.current_drawer as any

        return NextResponse.json({
            id: game.id,
            status: game.status,
            maxPlayers: game.max_players,
            currentRound: game.current_round,
            host: {
                id: Array.isArray(hostData) ? hostData[0]?.id : hostData?.id,
                username: Array.isArray(hostData) ? hostData[0]?.username : hostData?.username
            },
            currentDrawer: drawerData ? {
                id: Array.isArray(drawerData) ? drawerData[0]?.id : drawerData?.id,
                username: Array.isArray(drawerData) ? drawerData[0]?.username : drawerData?.username
            } : null,
            // Only reveal word to drawer
            currentWord: isDrawer ? game.current_word : null,
            players: formattedPlayers,
            currentPlayer,
            isHost,
            isDrawer,
            timeRemaining
        })

    } catch (error) {
        console.error('Error fetching pictionary status:', error)
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
    }
}
