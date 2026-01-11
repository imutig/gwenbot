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
    const period = searchParams.get('period') // 'all', 'month', 'week'

    try {
        // Build base query
        let query = supabase
            .from('viewer_presence')
            .select('player_id, message_count, players!inner(username), twitch_streams!inner(started_at)')
            .gt('message_count', 0)

        // Apply period filter through the joined twitch_streams table
        if (period === 'month') {
            const oneMonthAgo = new Date()
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
            query = query.gte('twitch_streams.started_at', oneMonthAgo.toISOString())
        } else if (period === 'week') {
            const oneWeekAgo = new Date()
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
            query = query.gte('twitch_streams.started_at', oneWeekAgo.toISOString())
        }

        const { data: presenceData } = await query

        // Aggregate message counts per player across streams
        const messageCounts: Record<string, { username: string; count: number }> = {}

        if (presenceData) {
            for (const presence of presenceData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const players = presence.players as any
                const username = players?.username ?? (Array.isArray(players) ? players[0]?.username : null)
                if (!username) continue

                // Filter out bots
                if (['xsgwen', 'gwenbot_', 'streamelements'].includes(username.toLowerCase())) {
                    continue
                }

                if (!messageCounts[username]) {
                    messageCounts[username] = { username, count: 0 }
                }
                messageCounts[username].count += presence.message_count || 0
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
