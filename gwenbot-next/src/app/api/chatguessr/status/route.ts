import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get active game
        const { data: game } = await supabase
            .from('chatguessr_games')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!game) {
            return NextResponse.json({ active: false, game: null })
        }

        // Get messages for this game
        const { data: messages } = await supabase
            .from('chatguessr_messages')
            .select(`
                id,
                fake_username,
                fake_color,
                content,
                position,
                sent_at,
                original_player_id
            `)
            .eq('game_id', game.id)
            .order('position', { ascending: true })

        // Get unique player IDs and their real usernames
        const playerIds = [...new Set(messages?.map(m => m.original_player_id) || [])]

        const { data: players } = await supabase
            .from('players')
            .select('id, username')
            .in('id', playerIds)

        // Shuffle real usernames for the list (don't reveal mapping!)
        const realUsernames = (players || [])
            .map(p => ({ id: p.id, username: p.username }))
            .sort(() => Math.random() - 0.5)

        return NextResponse.json({
            active: true,
            game: {
                id: game.id,
                status: game.status,
                totalPlayers: game.total_players,
                createdAt: game.created_at
            },
            messages: messages?.map(m => ({
                id: m.id,
                fakeUsername: m.fake_username,
                fakeColor: m.fake_color,
                content: m.content,
                position: m.position,
                sentAt: m.sent_at
            })) || [],
            realPlayers: realUsernames
        })
    } catch (error) {
        console.error('Status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
