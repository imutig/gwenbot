import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function resolveTwitchIdentity(user: any) {
    const metadata = user?.user_metadata || {}
    const identities = Array.isArray(user?.identities) ? user.identities : []
    const twitchIdentity = identities.find((id: any) => id?.provider === 'twitch')
    const identityData = twitchIdentity?.identity_data || {}

    const twitchId = metadata.provider_id ||
        twitchIdentity?.id ||
        identityData.sub ||
        metadata.sub ||
        metadata.user_id ||
        user?.id

    const usernameCandidates = [
        metadata.preferred_username,
        metadata.user_name,
        metadata.username,
        metadata.name,
        metadata.nickname,
        metadata.slug,
        identityData.preferred_username,
        identityData.user_name,
        identityData.login,
        identityData.name
    ]

    const twitchUsername = usernameCandidates
        .find((value) => typeof value === 'string' && value.trim().length > 0)
        ?.trim()

    const hasReliableUsername = !!twitchUsername && !['viewer', 'joueur', 'user'].includes(twitchUsername.toLowerCase())

    return {
        twitchId,
        twitchUsername: twitchUsername || null,
        hasReliableUsername
    }
}

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

    const { twitchId, twitchUsername, hasReliableUsername } = resolveTwitchIdentity(user)

    if (!twitchId) {
        return NextResponse.json({ error: 'Twitch integration not found' }, { status: 400 })
    }

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

        let usernameCard: any = null
        if (hasReliableUsername && twitchUsername) {
            const { data } = await supabaseSecret
                .from('bingo_cards')
                .select('*')
                .eq('session_id', session.id)
                .ilike('twitch_username', twitchUsername)
                .order('created_at', { ascending: true })
                .limit(1)
                .single()
            usernameCard = data
        }

        if (usernameCard) {
            const cardForUser = usernameCard.twitch_user_id === twitchId
                ? usernameCard
                : {
                    ...usernameCard,
                    twitch_user_id: twitchId,
                    twitch_username: twitchUsername || usernameCard.twitch_username
                }

            if (usernameCard.twitch_user_id !== twitchId) {
                await supabaseSecret
                    .from('bingo_cards')
                    .update({
                        twitch_user_id: twitchId,
                        twitch_username: twitchUsername || usernameCard.twitch_username
                    })
                    .eq('id', usernameCard.id)
            }

            return NextResponse.json({
                active: true,
                sessionId: session.id,
                card: cardForUser,
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
                twitch_username: twitchUsername || `user_${twitchId}`,
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
