import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function generateGrid(items: string[]) {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);

    const grid = [];
    let itemIdx = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            grid.push({ text: '⭐', isFree: true });
        } else {
            grid.push({ text: selected[itemIdx], isFree: false });
            itemIdx++;
        }
    }
    return grid;
}

export async function GET() {
    const supabaseSecret = createSupabaseClient(supabaseUrl, supabaseServiceKey)
    const supabase = await createClient()

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Identify user's Twitch ID
    // In Supabase, the provider's ID is stored in user_metadata for OAuth providers
    const twitchId = user.identities?.find(id => id.provider === 'twitch')?.id
        || user.user_metadata.provider_id
        || user.user_metadata.user_id;

    if (!twitchId) {
        return NextResponse.json({ error: 'Twitch account not found' }, { status: 400 })
    }

    const twitchUsername = user.user_metadata.preferred_username || user.user_metadata.user_name || 'Viewer';

    try {
        // Get active session
        const { data: session, error: sessionError } = await supabaseSecret
            .from('bingo_sessions')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (sessionError || !session) {
            return NextResponse.json({ active: false })
        }

        // Check if card exists
        const { data: existingCard } = await supabaseSecret
            .from('bingo_cards')
            .select('*')
            .eq('session_id', session.id)
            .eq('twitch_user_id', twitchId)
            .single()

        if (existingCard) {
            return NextResponse.json({
                active: true,
                sessionId: session.id,
                card: existingCard,
                session: {
                    items: session.items,
                    validated_items: session.validated_items || []
                }
            })
        }

        // Create new card
        const grid = generateGrid(session.items)
        const checked = Array(25).fill(false)
        checked[12] = true

        const { data: newCard, error: insertError } = await supabaseSecret
            .from('bingo_cards')
            .insert({
                session_id: session.id,
                twitch_user_id: twitchId,
                twitch_username: twitchUsername,
                grid: grid,
                checked: checked
            })
            .select()
            .single()

        if (insertError) throw insertError

        return NextResponse.json({
            active: true,
            sessionId: session.id,
            card: newCard,
            session: {
                items: session.items,
                validated_items: session.validated_items || []
            }
        })

    } catch (error) {
        console.error('Error in bingwen/card:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
