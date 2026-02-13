import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000'
const BOT_SECRET = process.env.BOT_SECRET || ''

async function sendBotChatAnnouncement(message: string) {
    if (!BOT_SECRET) return
    try {
        const response = await fetch(`${BOT_API_URL}/api/announce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bot-secret': BOT_SECRET
            },
            body: JSON.stringify({ message, color: 'purple' })
        })

        if (!response.ok) {
            console.error('Bot announce failed:', response.status, await response.text())
        }
    } catch (error) {
        console.error('Bot announce error:', error)
    }
}

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { itemIndex } = await request.json()

        // Get active session
        const { data: session, error: sessionError } = await supabase
            .from('bingo_sessions')
            .select('id, items, validated_items')
            .eq('status', 'active')
            .single()

        if (sessionError || !session) {
            return NextResponse.json({ error: 'No active session' }, { status: 404 })
        }

        if (itemIndex === undefined || itemIndex < 0 || itemIndex >= session.items.length) {
            return NextResponse.json({ error: 'Invalid item index' }, { status: 400 })
        }

        const validated = [...(session.validated_items || Array(session.items.length).fill(false))]
        validated[itemIndex] = !validated[itemIndex]

        await supabase
            .from('bingo_sessions')
            .update({ validated_items: validated })
            .eq('id', session.id)

        if (validated[itemIndex]) {
            const itemName = session.items[itemIndex]
            await sendBotChatAnnouncement(`✅ Case bingo validée : ${itemName}`)
        }

        return NextResponse.json({ success: true, validated_items: validated })
    } catch (error) {
        console.error('Error validating item:', error)
        return NextResponse.json({ error: 'Failed to validate item' }, { status: 500 })
    }
}
