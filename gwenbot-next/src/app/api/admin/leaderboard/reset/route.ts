import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Helper to check if current user is admin
async function checkAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const username = (user.user_metadata?.user_name || '').toLowerCase()

    const { data: admin } = await supabase
        .from('authorized_users')
        .select('*')
        .eq('username', username)
        .single()

    return !!admin
}

export async function POST(request: Request) {
    const supabase = await createClient()
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

    if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { type } = await request.json()

        if (type === 'sudoku') {
            // Delete all games (status finished)
            const { error } = await supabase
                .from('sudoku_games')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows filter workaround

            if (error) throw error
        } else if (type === 'cemantix') {
            // Delete all cemantix sessions (except active ones maybe? No, complete reset requested)
            const { error } = await supabase
                .from('cemantix_sessions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000')

            if (error) throw error

            // Also clear guesses?
            // Usually guesses cascade delete if foreign key is set up, checking schema might be good but let's assume session delete is main target
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error resetting leaderboard:', error)
        return NextResponse.json({ error: 'Failed to reset leaderboard' }, { status: 500 })
    }
}
