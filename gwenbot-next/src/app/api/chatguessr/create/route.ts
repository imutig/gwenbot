import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { getRandomTwitchColor, getRandomFakeUsernames } from '@/data/fake-usernames'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface CreateGameBody {
    messageCount?: number // 10, 20, or 30
    dateFilter?: 'all' | 'recent' | 'old'
}

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const supabaseAuth = await createServerClient()

    if (!supabaseAuth) {
        return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
    }

    // Check if user is admin
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const username = (user.user_metadata?.slug || user.user_metadata?.name || user.user_metadata?.user_name)?.toLowerCase()
    const { data: adminUser } = await supabaseAdmin
        .from('authorized_users')
        .select('username')
        .eq('username', username)
        .single()

    if (!adminUser) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    try {
        // Parse configuration from body
        let body: CreateGameBody = {}
        try {
            body = await request.json()
        } catch {
            // No body provided, use defaults
        }

        const messageCount = [10, 20, 30].includes(body.messageCount || 0) ? body.messageCount! : 20
        const dateFilter = body.dateFilter || 'all'

        // Check for existing active game - close it first
        const { data: existingGame } = await supabaseAdmin
            .from('chatguessr_games')
            .select('id')
            .eq('status', 'active')
            .single()

        if (existingGame) {
            // Close the existing game instead of blocking
            await supabaseAdmin
                .from('chatguessr_games')
                .update({ status: 'cancelled', finished_at: new Date().toISOString() })
                .eq('id', existingGame.id)
        }

        // Build query with date filter
        let query = supabaseAdmin.from('chat_messages').select('*', { count: 'exact', head: true })

        if (dateFilter === 'recent') {
            // Last 7 days
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            query = query.gte('sent_at', sevenDaysAgo.toISOString())
        } else if (dateFilter === 'old') {
            // More than 30 days ago
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            query = query.lte('sent_at', thirtyDaysAgo.toISOString())
        }

        const { count } = await query

        if (!count || count < messageCount) {
            const filterLabel = dateFilter === 'recent' ? 'récents' : dateFilter === 'old' ? 'anciens' : ''
            return NextResponse.json({
                error: `Pas assez de messages ${filterLabel} dans la base (${count || 0}/${messageCount} requis)`
            }, { status: 400 })
        }

        // Random offset
        const maxOffset = count - messageCount
        const randomOffset = Math.floor(Math.random() * Math.max(1, maxOffset))

        // Build message fetch query with same date filter
        let msgQuery = supabaseAdmin
            .from('chat_messages')
            .select(`
                id,
                player_id,
                content,
                sent_at,
                players!inner(id, username)
            `)

        if (dateFilter === 'recent') {
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            msgQuery = msgQuery.gte('sent_at', sevenDaysAgo.toISOString())
        } else if (dateFilter === 'old') {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            msgQuery = msgQuery.lte('sent_at', thirtyDaysAgo.toISOString())
        }

        const { data: messages, error: msgError } = await msgQuery
            .order('id', { ascending: true })
            .range(randomOffset, randomOffset + messageCount - 1)

        if (msgError || !messages || messages.length < messageCount) {
            console.error('Message fetch error:', msgError)
            return NextResponse.json({ error: 'Erreur lors de la récupération des messages' }, { status: 500 })
        }

        // Get unique player IDs in this batch
        const uniquePlayerIds = [...new Set(messages.map(m => m.player_id))]
        const fakeNames = getRandomFakeUsernames(uniquePlayerIds.length)

        // Map player IDs to fake identities
        const playerIdentities = new Map<number, { username: string; color: string }>()
        uniquePlayerIds.forEach((playerId, index) => {
            playerIdentities.set(playerId, {
                username: fakeNames[index],
                color: getRandomTwitchColor()
            })
        })

        // Create game
        const { data: game, error: gameError } = await supabaseAdmin
            .from('chatguessr_games')
            .insert({
                status: 'active',
                total_players: uniquePlayerIds.length
            })
            .select()
            .single()

        if (gameError || !game) {
            console.error('Game create error:', gameError)
            return NextResponse.json({ error: 'Erreur lors de la création de la partie' }, { status: 500 })
        }

        // Insert messages with fake identities
        const messagesToInsert = messages.map((msg, index) => {
            const identity = playerIdentities.get(msg.player_id)!
            return {
                game_id: game.id,
                original_player_id: msg.player_id,
                fake_username: identity.username,
                fake_color: identity.color,
                content: msg.content,
                position: index + 1,
                sent_at: msg.sent_at
            }
        })

        const { error: insertError } = await supabaseAdmin
            .from('chatguessr_messages')
            .insert(messagesToInsert)

        if (insertError) {
            console.error('Message insert error:', insertError)
            // Cleanup game
            await supabaseAdmin.from('chatguessr_games').delete().eq('id', game.id)
            return NextResponse.json({ error: 'Erreur lors de la sauvegarde des messages' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            gameId: game.id,
            messageCount: messages.length,
            playerCount: uniquePlayerIds.length,
            dateFilter
        })
    } catch (error) {
        console.error('Create game error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
