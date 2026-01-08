import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
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

// Service Role Client for DB operations (bypass RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    // Public read is usually fine, but let's use service role to be sure we get everything
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: 'Config missing' }, { status: 500 })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const { data: records } = await supabaseAdmin
            .from('streamer_records')
            .select('*')

        const result = {
            fr: { alltime: null as any, monthly: null as any },
            en: { alltime: null as any, monthly: null as any }
        }

        if (records) {
            for (const record of records) {
                // Map DB columns to API response
                // DB: lang, record_type, value, month
                const recordData = { score: record.value, date: record.month || record.updated_at } // 'month' column holds the date string

                if (record.lang === 'fr') {
                    if (record.record_type === 'alltime') result.fr.alltime = recordData
                    if (record.record_type === 'monthly') result.fr.monthly = recordData
                } else if (record.lang === 'en') {
                    if (record.record_type === 'alltime') result.en.alltime = recordData
                    if (record.record_type === 'monthly') result.en.monthly = recordData
                }
            }
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error fetching records:', error)
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const supabaseUser = await createServerClient()
    if (!supabaseUser) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    // Verify Admin using User Session
    if (!await checkAdmin(supabaseUser)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use Admin Client for Writes
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: 'Config missing' }, { status: 500 })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()
        const { language, score } = body // 'language' from front ('fr'/'en'), 'score' (int)

        if (!score) {
            return NextResponse.json({ error: 'Score required' }, { status: 400 })
        }

        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        const today = new Date().toISOString() // for updated_at

        // 1. Get current records
        const { data: currentRecords } = await supabaseAdmin
            .from('streamer_records')
            .select('*')
            .eq('lang', language) // DB column is 'lang'

        let allTime = currentRecords?.find(r => r.record_type === 'alltime')
        let monthly = currentRecords?.find(r => r.record_type === 'monthly')

        // 2. Logic: Update All Time if better (LOWER is better for guesses)
        // If no record exists, 999999 as partial "infinity" to ensure update
        const currentAllTimeScore = allTime?.value || 999999

        // If valid score is 0, it likely means no record, so update. But user might input 0? Unlikely for guesses.
        const shouldUpdateAllTime = !allTime || score < currentAllTimeScore

        if (shouldUpdateAllTime) {
            // Use ID for upsert if available to avoid duplicates if constraint is missing
            if (allTime?.id) {
                await supabaseAdmin
                    .from('streamer_records')
                    .update({ value: score, month: currentMonth, updated_at: today })
                    .eq('id', allTime.id)
            } else {
                // Insert new
                await supabaseAdmin.from('streamer_records').insert({ lang: language, record_type: 'alltime', value: score, month: currentMonth, updated_at: today })
            }
        }

        // 3. Logic: Update Monthly
        const recordMonth = monthly?.month || ''
        const isSameMonth = recordMonth === currentMonth
        const currentMonthlyScore = monthly?.value || 999999

        // Update if: New Month OR (Same Month AND Better Score)
        const shouldUpdateMonthly = !monthly || !isSameMonth || score < currentMonthlyScore

        if (shouldUpdateMonthly) {
            if (monthly?.id && isSameMonth) {
                // Update existing monthly row for the same month
                await supabaseAdmin
                    .from('streamer_records')
                    .update({ value: score, month: currentMonth, updated_at: today })
                    .eq('id', monthly.id)
            } else if (monthly?.id && !isSameMonth) {
                // New month, update the existing "monthly" row to be the new month's record
                await supabaseAdmin
                    .from('streamer_records')
                    .update({ value: score, month: currentMonth, updated_at: today })
                    .eq('id', monthly.id)
            } else {
                // Insert new monthly record
                await supabaseAdmin.from('streamer_records').insert({ lang: language, record_type: 'monthly', value: score, month: currentMonth, updated_at: today })
            }
        }

        return NextResponse.json({ success: true, updatedAllTime: shouldUpdateAllTime, updatedMonthly: shouldUpdateMonthly })
    } catch (error) {
        console.error('Error updating records:', error)
        return NextResponse.json({ error: 'Failed to update records' }, { status: 500 })
    }
}
