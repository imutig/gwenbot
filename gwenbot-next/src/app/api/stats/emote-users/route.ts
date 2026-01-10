import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all messages with emojis
    const { data: messages } = await supabase
        .from('chat_messages')
        .select('player_id, emojis, players(username)')
        .not('emojis', 'is', null)

    if (!messages) {
        return NextResponse.json({ topUsers: {} })
    }

    // Count emojis per user
    const emojiUserCounts: Record<string, Record<number, { username: string; count: number }>> = {}

    for (const msg of messages as any[]) {
        if (!msg.emojis) continue
        for (const emoji of msg.emojis) {
            if (!emojiUserCounts[emoji]) {
                emojiUserCounts[emoji] = {}
            }
            if (!emojiUserCounts[emoji][msg.player_id]) {
                emojiUserCounts[emoji][msg.player_id] = {
                    username: msg.players?.username || 'Unknown',
                    count: 0
                }
            }
            emojiUserCounts[emoji][msg.player_id].count++
        }
    }

    // Get top 3 users per emoji
    const topUsers: Record<string, { username: string; count: number }[]> = {}

    for (const [emoji, users] of Object.entries(emojiUserCounts)) {
        topUsers[emoji] = Object.values(users)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
    }

    return NextResponse.json({ topUsers })
}
