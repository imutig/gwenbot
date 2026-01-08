import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const username = searchParams.get('username')

    if (!username) {
        return NextResponse.json({ isAuthorized: false })
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ isAuthorized: false })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { data: adminUser } = await supabase
            .from('authorized_users')
            .select('username')
            .eq('username', username.toLowerCase())
            .single()

        return NextResponse.json({
            isAuthorized: !!adminUser
        })
    } catch (error) {
        console.error('Error checking admin status:', error)
        return NextResponse.json({ isAuthorized: false })
    }
}
