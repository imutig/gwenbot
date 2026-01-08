import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
        return NextResponse.json({ isAdmin: false })
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ isAdmin: false })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { data } = await supabase
            .from('authorized_users')
            .select('id')
            .ilike('username', username.toLowerCase())
            .single()

        return NextResponse.json({ isAdmin: !!data })
    } catch {
        return NextResponse.json({ isAdmin: false })
    }
}
