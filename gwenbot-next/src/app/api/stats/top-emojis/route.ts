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
        // Get all emojis from chat messages
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('emojis')
            .not('emojis', 'is', null)
            .limit(1000)

        // Count emoji occurrences
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
            .slice(0, 15)

        return NextResponse.json({ topEmojis })
    } catch (error) {
        console.error('Error fetching top emojis:', error)
        return NextResponse.json({ topEmojis: [] })
    }
}
