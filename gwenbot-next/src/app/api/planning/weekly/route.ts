import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getCurrentWeekMonday() {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
}

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const weekStart = getCurrentWeekMonday()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    try {
        const { data, error } = await supabase
            .from('discord_planning')
            .select('stream_date, start_time, end_time, game, note')
            .gte('stream_date', weekStartStr)
            .lte('stream_date', weekEndStr)
            .order('stream_date', { ascending: true })

        if (error) {
            console.error('Planning weekly fetch error:', error)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        const streams = (data || []).map((row) => {
            const streamDate = new Date(`${row.stream_date}T00:00:00`)
            const dayIndex = Math.round((streamDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
            return {
                dayIndex,
                streamDate: row.stream_date,
                startTime: row.start_time || '22h',
                endTime: row.end_time || null,
                game: row.game || null,
                note: row.note || null,
            }
        }).filter((s) => s.dayIndex >= 0 && s.dayIndex <= 6)

        return NextResponse.json({
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            streams,
        })
    } catch (error) {
        console.error('Planning weekly route error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
