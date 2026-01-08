import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use service role for API routes (full access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get records for FR and EN
        const { data: records } = await supabase
            .from('streamer_records')
            .select('*')

        const result = {
            fr: { alltime: null as number | null, monthly: null as number | null },
            en: { alltime: null as number | null, monthly: null as number | null }
        }

        if (records) {
            for (const record of records) {
                if (record.lang === 'fr') {
                    if (record.record_type === 'alltime') result.fr.alltime = record.value
                    if (record.record_type === 'monthly') result.fr.monthly = record.value
                } else if (record.lang === 'en') {
                    if (record.record_type === 'alltime') result.en.alltime = record.value
                    if (record.record_type === 'monthly') result.en.monthly = record.value
                }
            }
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error fetching records:', error)
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
    }
}
