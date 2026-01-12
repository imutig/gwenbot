import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
        return NextResponse.json({ users: [] })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { data: users, error } = await supabase
            .from('players')
            .select('username, avatar_seed')
            .ilike('username', `%${query}%`)
            .limit(5)

        if (error) {
            throw error
        }

        return NextResponse.json({ users: users || [] })
    } catch (error) {
        console.error('Search API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
