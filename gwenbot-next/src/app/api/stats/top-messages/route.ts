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
        // Get top chatters
        const { data: topChatters } = await supabase
            .from('chat_messages')
            .select('player_id, players!inner(username)')
            .limit(1000) // Get last 1000 messages to count

        // Count messages per player
        const messageCounts: Record<string, { username: string; count: number }> = {}

        if (topChatters) {
            for (const msg of topChatters) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const players = msg.players as any
                const username = players?.username ?? (Array.isArray(players) ? players[0]?.username : 'Unknown')
                if (!messageCounts[username]) {
                    messageCounts[username] = { username, count: 0 }
                }
                messageCounts[username].count++
            }
        }

        const topMessages = Object.values(messageCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        return NextResponse.json({ topMessages })
    } catch (error) {
        console.error('Error fetching top messages:', error)
        return NextResponse.json({ topMessages: [] })
    }
}
