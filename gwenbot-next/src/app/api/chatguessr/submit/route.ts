import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface SubmitBody {
    answers: Record<string, string> // { fakeUsername: realUsername }
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
        const body: SubmitBody = await request.json()
        const { answers } = body

        if (!answers || typeof answers !== 'object') {
            return NextResponse.json({ error: 'Answers required' }, { status: 400 })
        }

        // Get active game
        const { data: game } = await supabaseAdmin
            .from('chatguessr_games')
            .select('id')
            .eq('status', 'active')
            .single()

        if (!game) {
            return NextResponse.json({ error: 'Aucune partie en cours' }, { status: 404 })
        }

        // Get messages for this game
        const { data: messages } = await supabaseAdmin
            .from('chatguessr_messages')
            .select('fake_username, fake_color, original_player_id')
            .eq('game_id', game.id)

        if (!messages) {
            return NextResponse.json({ error: 'Messages not found' }, { status: 500 })
        }

        // Get unique player IDs and fetch their usernames
        const playerIds = [...new Set(messages.map(m => m.original_player_id))]
        const { data: players } = await supabaseAdmin
            .from('players')
            .select('id, username')
            .in('id', playerIds)

        if (!players) {
            return NextResponse.json({ error: 'Players not found' }, { status: 500 })
        }

        // Build player ID -> username map
        const playerMap = new Map<number, string>()
        players.forEach(p => playerMap.set(p.id, p.username))

        // Build mapping of fake -> real username and fake -> color
        const fakeToReal = new Map<string, string>()
        const fakeToColor = new Map<string, string>()
        messages.forEach(m => {
            const realUsername = playerMap.get(m.original_player_id) || ''
            fakeToReal.set(m.fake_username, realUsername)
            fakeToColor.set(m.fake_username, m.fake_color)
        })

        // Get unique fake usernames (each fake username maps to one real user)
        const uniqueFakes = [...new Set(messages.map(m => m.fake_username))]

        // Calculate score
        let correct = 0
        const results: { fake: string; fakeColor: string; guessed: string; actual: string; correct: boolean }[] = []

        uniqueFakes.forEach(fakeUsername => {
            const actualReal = fakeToReal.get(fakeUsername)!
            const guessedReal = answers[fakeUsername] || ''
            const isCorrect = guessedReal.toLowerCase() === actualReal.toLowerCase()

            if (isCorrect) correct++

            results.push({
                fake: fakeUsername,
                fakeColor: fakeToColor.get(fakeUsername) || '#fff',
                guessed: guessedReal,
                actual: actualReal,
                correct: isCorrect
            })
        })

        // Update game as finished
        await supabaseAdmin
            .from('chatguessr_games')
            .update({
                status: 'finished',
                finished_at: new Date().toISOString(),
                score: correct
            })
            .eq('id', game.id)

        return NextResponse.json({
            success: true,
            score: correct,
            total: uniqueFakes.length,
            results
        })
    } catch (error) {
        console.error('Submit error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
