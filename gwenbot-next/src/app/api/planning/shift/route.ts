import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
    const supabase = await createClient()

    if (!supabase) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
    }

    // Check user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get username
    const username = (
        user.user_metadata?.preferred_username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.name ||
        ''
    ).toLowerCase()

    if (!username) {
        return NextResponse.json({ error: 'No username' }, { status: 400 })
    }

    // Check if user is authorized
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey)

    const { data: authorized } = await supabaseAdmin
        .from('authorized_users')
        .select('id')
        .ilike('username', username)
        .single()

    if (!authorized) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    try {
        // Get current offset
        const { data: existing } = await supabaseAdmin
            .from('counters')
            .select('value')
            .eq('name', 'stream_cycle_offset')
            .single()

        const currentOffset = existing?.value ?? 0
        const newOffset = currentOffset + 1

        // Upsert the offset
        await supabaseAdmin
            .from('counters')
            .upsert(
                { name: 'stream_cycle_offset', value: newOffset },
                { onConflict: 'name' }
            )

        console.log(`📅 Stream cycle shifted by @${username}: offset ${currentOffset} → ${newOffset}`)

        return NextResponse.json({
            success: true,
            previousOffset: currentOffset,
            newOffset: newOffset
        })
    } catch (error) {
        console.error('Error shifting stream cycle:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
