import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    try {
        const body = await request.json()
        const { userId, seed } = body

        if (!userId || !seed) {
            return NextResponse.json({ error: 'Missing userId or seed' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Verify user exists and update
        const { error } = await supabase
            .from('players')
            .update({ avatar_seed: seed })
            .eq('id', userId)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error updating avatar:', error)
        return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 })
    }
}
