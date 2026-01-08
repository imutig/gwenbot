import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
    request: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { username } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get player (case-insensitive search)
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .ilike('username', username.toLowerCase())
            .single()

        if (!player) {
            return NextResponse.json({
                watch_time_minutes: 0,
                streams_watched: 0,
                messages: 0,
                top_emojis: []
            })
        }

        // Get viewer presence data
        const { data: presence } = await supabase
            .from('viewer_presence')
            .select('first_seen, last_seen, message_count')
            .eq('player_id', player.id)

        let totalMinutes = 0
        let streamsWatched = 0

        if (presence) {
            for (const p of presence) {
                const start = new Date(p.first_seen)
                const end = new Date(p.last_seen)
                totalMinutes += Math.floor((end.getTime() - start.getTime()) / 60000)
                streamsWatched++
            }
        }

        // Get total message count from chat_messages table (the real count)
        const { count: totalMessages } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('player_id', player.id)

        // Get player's top emojis
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('emojis')
            .eq('player_id', player.id)
            .not('emojis', 'is', null)
            .limit(500)

        const emojiCounts: Record<string, number> = {}
        if (messages) {
            for (const msg of messages) {
                if (msg.emojis && Array.isArray(msg.emojis)) {
                    for (const emoji of msg.emojis) {
                        emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1
                    }
                }
            }
        }

        const topEmojis = Object.entries(emojiCounts)
            .map(([emoji, count]) => ({ emoji, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

        return NextResponse.json({
            watch_time_minutes: totalMinutes,
            streams_watched: streamsWatched,
            messages: totalMessages || 0,
            top_emojis: topEmojis
        })
    } catch (error) {
        console.error('Error fetching user stats:', error)
        return NextResponse.json({
            watch_time_minutes: 0,
            streams_watched: 0,
            messages: 0,
            top_emojis: []
        })
    }
}
