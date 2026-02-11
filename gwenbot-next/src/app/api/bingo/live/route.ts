import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // Get active session
        const { data: session } = await supabase
            .from('bingo_sessions')
            .select('id, items, validated_items, winners')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!session) {
            return NextResponse.json({ active: false })
        }

        // Get all cards for this session
        const { data: cards } = await supabase
            .from('bingo_cards')
            .select('id, twitch_username, grid, checked, has_bingo')
            .eq('session_id', session.id)

        if (!cards || cards.length === 0) {
            return NextResponse.json({
                active: true,
                sessionId: session.id,
                items: session.items,
                validated_items: session.validated_items || [],
                players: [],
                participantCount: 0
            })
        }

        const validatedItems = session.validated_items || []

        // Process each card: compute validCheckedCount
        const players = cards.map(card => {
            const grid = card.grid as { text: string; isFree: boolean }[]
            const checked = card.checked as boolean[]

            // For each cell, determine if it's "valid checked":
            // checked by user AND (free space OR the item is validated by broadcaster)
            const validChecked = checked.map((isChecked: boolean, cellIndex: number) => {
                if (cellIndex === 12) return true // Free space always valid
                if (!isChecked) return false
                const itemText = grid[cellIndex]?.text
                const sessionItemIndex = session.items.indexOf(itemText)
                return sessionItemIndex !== -1 && validatedItems[sessionItemIndex]
            })

            const validCheckedCount = validChecked.filter(Boolean).length

            return {
                username: card.twitch_username || 'Viewer',
                grid,
                checked,
                validChecked,
                validCheckedCount,
                hasBingo: card.has_bingo
            }
        })

        // Sort by validCheckedCount descending
        players.sort((a, b) => b.validCheckedCount - a.validCheckedCount)

        // Participant = someone with at least 1 valid checked cell (excluding free space)
        const participantCount = players.filter(p => {
            // Has at least one valid checked cell that is NOT the free space
            return p.validChecked.some((v: boolean, i: number) => v && i !== 12)
        }).length

        return NextResponse.json({
            active: true,
            sessionId: session.id,
            items: session.items,
            validated_items: validatedItems,
            validatedCount: validatedItems.filter(Boolean).length,
            players,
            participantCount,
            winners: session.winners || []
        })
    } catch (error) {
        console.error('Error getting live view:', error)
        return NextResponse.json({ active: false, error: 'Erreur' })
    }
}
