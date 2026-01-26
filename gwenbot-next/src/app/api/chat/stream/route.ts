import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ChatMessageRow {
    id: number
    content: string
    sent_at: string
    player: { username: string } | null
}

interface AlertRow {
    id: number
    type: string
    username: string
    amount: number | null
    tier: string | null
    message: string | null
    created_at: string
}

/**
 * SSE endpoint for real-time chat messages and alerts
 * Polls the database and streams new messages/alerts to clients
 */
export async function GET(request: NextRequest) {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return new Response('Database not configured', { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Create a readable stream for SSE
    const stream = new ReadableStream({
        async start(controller) {
            let lastMessageId = 0
            let lastAlertId = 0
            let isActive = true

            // Get the latest message ID to start from
            const { data: latestMessage } = await supabase
                .from('chat_messages')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .single()

            if (latestMessage) {
                lastMessageId = latestMessage.id
            }

            // Get the latest alert ID to start from
            const { data: latestAlert } = await supabase
                .from('alerts')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .single()

            if (latestAlert) {
                lastAlertId = latestAlert.id
            }

            // Send initial connection message
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

            // Poll for new messages and alerts every second
            const pollInterval = setInterval(async () => {
                if (!isActive) {
                    clearInterval(pollInterval)
                    return
                }

                try {
                    // Get new chat messages
                    const { data: messages } = await supabase
                        .from('chat_messages')
                        .select(`
                            id,
                            content,
                            sent_at,
                            badges,
                            color,
                            player:players(username)
                        `)
                        .gt('id', lastMessageId)
                        .order('id', { ascending: true })
                        .limit(20)

                    if (messages && messages.length > 0) {
                        for (const msg of messages) {
                            const playerData = msg.player as unknown as { username: string } | null
                            const username = playerData?.username || 'Unknown'

                            // Convert badge strings to badge objects
                            const badgeArray = (msg.badges as string[] | null) || []
                            const badges = badgeArray.map(b => ({ set_id: b, id: '1' }))

                            const messageData = {
                                type: 'message',
                                id: msg.id.toString(),
                                username: username,
                                displayName: username,
                                message: msg.content,
                                color: msg.color || getRandomColor(username),
                                badges: badges,
                                timestamp: msg.sent_at
                            }

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(messageData)}\n\n`))
                            lastMessageId = msg.id
                        }
                    }

                    // Get new alerts
                    const { data: alerts } = await supabase
                        .from('alerts')
                        .select('*')
                        .gt('id', lastAlertId)
                        .order('id', { ascending: true })
                        .limit(10)

                    if (alerts && alerts.length > 0) {
                        for (const alert of alerts as AlertRow[]) {
                            const alertData = {
                                type: 'alert',
                                alertType: alert.type,
                                username: alert.username,
                                amount: alert.amount,
                                tier: alert.tier,
                                message: alert.message,
                                timestamp: alert.created_at
                            }

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(alertData)}\n\n`))
                            lastAlertId = alert.id
                        }
                    }
                } catch (error) {
                    console.error('SSE poll error:', error)
                }
            }, 1000)

            // Clean up on close
            request.signal.addEventListener('abort', () => {
                isActive = false
                clearInterval(pollInterval)
                controller.close()
            })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    })
}

// Generate consistent color from username
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
