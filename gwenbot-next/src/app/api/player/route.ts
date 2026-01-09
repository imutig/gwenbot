import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
        return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get or create player
    let { data: player } = await supabase
        .from('players')
        .select('id, username')
        .eq('username', username)
        .single()

    if (!player) {
        // Create player if doesn't exist
        const { data: newPlayer, error } = await supabase
            .from('players')
            .insert({ username })
            .select('id, username')
            .single()

        if (error) {
            console.error('Error creating player:', error)
            return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
        }
        player = newPlayer
    }

    return NextResponse.json({ player })
}
