import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Get recent alerts history
 */
export async function GET(request: NextRequest) {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return NextResponse.json({ alerts: [] })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    try {
        const { data: alerts } = await supabase
            .from('alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        const formattedAlerts = (alerts || []).map(alert => ({
            id: alert.id.toString(),
            type: alert.type,
            username: alert.username,
            amount: alert.amount,
            tier: alert.tier,
            message: alert.message,
            timestamp: alert.created_at
        }))

        return NextResponse.json({ alerts: formattedAlerts })
    } catch (error) {
        console.error('Error fetching alerts:', error)
        return NextResponse.json({ alerts: [] })
    }
}
