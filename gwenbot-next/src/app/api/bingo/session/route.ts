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
        const { data: session } = await supabase
            .from('bingo_sessions')
            .select('id, items, validated_items, status, winners, created_at')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!session) {
            return NextResponse.json({ active: false })
        }

        return NextResponse.json({
            active: true,
            sessionId: session.id,
            items: session.items,
            validated_items: session.validated_items || [],
            winners: session.winners || [],
            createdAt: session.created_at
        })
    } catch {
        return NextResponse.json({ active: false })
    }
}
