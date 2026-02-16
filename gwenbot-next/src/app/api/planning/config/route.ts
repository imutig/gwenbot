import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ offset: 0 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { data } = await supabase
            .from('counters')
            .select('value')
            .eq('name', 'stream_cycle_offset')
            .single()

        return NextResponse.json({
            offset: data?.value ?? 0
        })
    } catch {
        return NextResponse.json({ offset: 0 })
    }
}
