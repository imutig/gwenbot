import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET!
const EXTENSION_CLIENT_ID = process.env.TWITCH_EXTENSION_CLIENT_ID!
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID!

function getBingoLines(checked: boolean[]) {
    const lines: number[][] = [];
    // Rows
    for (let r = 0; r < 5; r++) {
        const row = [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4];
        if (row.every(i => checked[i])) lines.push(row);
    }
    // Columns
    for (let c = 0; c < 5; c++) {
        const col = [c, c + 5, c + 10, c + 15, c + 20];
        if (col.every(i => checked[i])) lines.push(col);
    }
    // Diagonals
    const d1 = [0, 6, 12, 18, 24];
    if (d1.every(i => checked[i])) lines.push(d1);
    const d2 = [4, 8, 12, 16, 20];
    if (d2.every(i => checked[i])) lines.push(d2);
    return lines;
}

async function sendPubSubMessage(channelId: string, message: any) {
    if (!EXTENSION_SECRET) return;
    try {
        const secret = Buffer.from(EXTENSION_SECRET, 'base64');
        const payload = {
            exp: Math.floor(Date.now() / 1000) + 60,
            user_id: BROADCASTER_ID,
            role: 'external',
            channel_id: channelId,
            pubsub_perms: {
                send: ['broadcast']
            }
        };

        const token = jwt.sign(payload, secret);

        const response = await fetch('https://api.twitch.tv/helix/extensions/pubsub', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': EXTENSION_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: ['broadcast'],
                broadcaster_id: channelId,
                message: JSON.stringify(message)
            })
        });

        if (!response.ok) {
            console.error('❌ PubSub send failed:', response.status, await response.text());
        }
    } catch (error) {
        console.error('❌ PubSub error:', error);
    }
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
    const { cardId } = body

    if (cardId === undefined) {
        return NextResponse.json({ error: 'Missing cardId' }, { status: 400 })
    }

    try {
        // Fetch existing card with session
        const { data: card, error: fetchError } = await supabaseSecret
            .from('bingo_cards')
            .select('*, bingo_sessions!inner(*)')
            .eq('id', cardId)
            .single()

        if (fetchError || !card) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 })
        }

        const session = card.bingo_sessions;

        // Verify ownership
        const twitchId = user.identities?.find(id => id.provider === 'twitch')?.id
            || user.user_metadata.provider_id
            || user.user_metadata.user_id;

        if (card.twitch_user_id !== twitchId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (card.has_bingo) {
            return NextResponse.json({ error: 'Bingo déjà réclamé !' }, { status: 400 })
        }

        if (session.status !== 'active') {
            return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
        }

        // Verify that the winning line contains only broadcaster-validated items
        const validatedItems = session.validated_items || [];
        const winningLines = getBingoLines(card.checked);

        let validLine = false;
        for (const line of winningLines) {
            const lineItemsValidated = line.every(cellIndex => {
                if (cellIndex === 12) return true; // Free space always valid
                const itemText = (card.grid as any[])[cellIndex]?.text;
                const sessionItemIndex = session.items.indexOf(itemText);
                return sessionItemIndex !== -1 && validatedItems[sessionItemIndex];
            });
            if (lineItemsValidated) { validLine = true; break; }
        }

        if (!validLine) {
            return NextResponse.json({
                error: 'Les items de ta ligne ne sont pas encore tous validés par la streameuse ! Patience 😊'
            }, { status: 400 });
        }

        // Mark card as bingo
        await supabaseSecret
            .from('bingo_cards')
            .update({ has_bingo: true })
            .eq('id', cardId);

        // Add to session winners
        const winners = [...(session.winners || [])];
        const winnerEntry = {
            userId: twitchId,
            username: card.twitch_username || 'Viewer',
            position: winners.length + 1,
            time: new Date().toISOString()
        };
        winners.push(winnerEntry);

        await supabaseSecret
            .from('bingo_sessions')
            .update({ winners })
            .eq('id', session.id);

        // Broadcast via PubSub
        await sendPubSubMessage(BROADCASTER_ID, {
            type: 'bingo_winner',
            username: winnerEntry.username,
            position: winnerEntry.position
        });

        // Optional: Trigger internal announcement on Express server if possible
        // For now, PubSub handles the on-screen alert for viewers.

        return NextResponse.json({
            success: true,
            position: winnerEntry.position,
            message: `BINGO ! Tu es le #${winnerEntry.position} gagnant !`
        })

    } catch (error) {
        console.error('Error in bingwen/claim:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
