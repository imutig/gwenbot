import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Get recent chat messages history
 */
export async function GET(request: NextRequest) {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return NextResponse.json({ messages: [] })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    try {
        const { data: messages } = await supabase
            .from('chat_messages')
            .select(`
                id,
                content,
                sent_at,
                player:players(username)
            `)
            .order('id', { ascending: false })
            .limit(limit)

        const formattedMessages = (messages || []).reverse().map(msg => {
            const playerData = msg.player as unknown as { username: string } | null
            const username = playerData?.username || 'Unknown'

            return {
                id: msg.id.toString(),
                username: username,
                displayName: username,
                message: msg.content,
                color: getRandomColor(username),
                badges: [],
                timestamp: msg.sent_at
            }
        })

        return NextResponse.json({ messages: formattedMessages })
    } catch (error) {
        console.error('Error fetching chat history:', error)
        return NextResponse.json({ messages: [] })
    }
}

function getRandomColor(username: string): string {
    const colors = [
        '#ff85c0', '#ff69b4', '#eb2f96', '#c9688a',
        '#9146ff', '#00c7ac', '#ffb300', '#ff6b6b',
        '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'
    ]

    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
}
