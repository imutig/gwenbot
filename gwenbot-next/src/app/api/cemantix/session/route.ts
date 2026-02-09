import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000'
const BOT_SECRET = process.env.BOT_SECRET || ''

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()

        if (!supabase) {
            return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
        }

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const username = (
            user.user_metadata?.slug ||
            user.user_metadata?.name ||
            user.user_metadata?.user_name ||
            user.user_metadata?.preferred_username ||
            user.email?.split('@')[0]
        )?.toLowerCase()

        // Check if user is authorized
        const { data: authorized } = await supabase
            .from('authorized_users')
            .select('username')
            .eq('username', username)
            .single()

        if (!authorized) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        }

        const body = await req.json()
        const { action, lang } = body

        if (action === 'start') {
            const res = await fetch(`${BOT_API_URL}/api/cemantix/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-secret': BOT_SECRET
                },
                body: JSON.stringify({ lang: lang || 'fr' })
            })
            const data = await res.json()
            return NextResponse.json(data)
        }

        if (action === 'stop') {
            const res = await fetch(`${BOT_API_URL}/api/cemantix/session/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-secret': BOT_SECRET
                }
            })
            const data = await res.json()
            return NextResponse.json(data)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
        console.error('Cemantix session error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
