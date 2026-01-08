import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

import { getTwitchUsername } from '@/lib/auth-utils'

// Helper to check if current user is admin
async function checkAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const username = getTwitchUsername(user)

    const { data: admin } = await supabase
        .from('authorized_users')
        .select('*')
        .eq('username', username)
        .single()

    return !!admin
}

export async function GET() {
    const supabase = await createClient()
    if (!supabase) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: users, error } = await supabase
        .from('authorized_users')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })

    return NextResponse.json({ users })
}

export async function POST(request: Request) {
    const supabase = await createClient()
    if (!supabase) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { username } = await request.json()
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 })

    const { error } = await supabase
        .from('authorized_users')
        .insert({ username: username.toLowerCase() })

    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'User already authorized' }, { status: 400 })
        return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
    const supabase = await createClient()
    if (!supabase) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 })

    // Prevent deleting super admins via API for safety
    const { data: targetUser } = await supabase
        .from('authorized_users')
        .select('is_super_admin')
        .eq('username', username.toLowerCase())
        .single()

    if (targetUser?.is_super_admin) {
        return NextResponse.json({ error: 'Cannot remove Super Admin' }, { status: 403 })
    }

    const { error } = await supabase
        .from('authorized_users')
        .delete()
        .eq('username', username.toLowerCase())

    if (error) return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })

    return NextResponse.json({ success: true })
}
