import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function checkBingo(checked: boolean[]) {
    // Rows
    for (let r = 0; r < 5; r++) {
        if (checked.slice(r * 5, r * 5 + 5).every(v => v)) return true;
    }
    // Columns
    for (let c = 0; c < 5; c++) {
        if ([c, c + 5, c + 10, c + 15, c + 20].every(i => checked[i])) return true;
    }
    // Diagonals
    if ([0, 6, 12, 18, 24].every(i => checked[i])) return true;
    if ([4, 8, 12, 16, 20].every(i => checked[i])) return true;
    return false;
}

export async function POST(request: Request) {
    const supabaseSecret = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const supabase = await createClient()

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { cardId, cellIndex } = body

    if (cardId === undefined || cellIndex === undefined) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    try {
        // Fetch existing card
        const { data: card, error: fetchError } = await supabaseSecret
            .from('bingo_cards')
            .select('*')
            .eq('id', cardId)
            .single()

        if (fetchError || !card) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 })
        }

        // Verify ownership (optional but good practice)
        const twitchId = user.identities?.find(id => id.provider === 'twitch')?.id
            || user.user_metadata.provider_id
            || user.user_metadata.user_id;

        if (card.twitch_user_id !== twitchId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Check if session is still active
        const { data: session } = await supabaseSecret
            .from('bingo_sessions')
            .select('status')
            .eq('id', card.session_id)
            .single()

        if (!session || session.status !== 'active') {
            return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
        }

        // Toggle cell
        const checked = [...card.checked]
        if (cellIndex !== 12) { // Free space cannot be unchecked
            checked[cellIndex] = !checked[cellIndex]
        }

        const hasBingo = checkBingo(checked)

        const { error: updateError } = await supabaseSecret
            .from('bingo_cards')
            .update({ checked }) // We don't update has_bingo yet, only /claim does that to prevent abuse
            .eq('id', cardId)

        if (updateError) throw updateError

        return NextResponse.json({
            success: true,
            checked,
            hasBingo
        })

    } catch (error) {
        console.error('Error in bingwen/check:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
