import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import wordList from '@/lib/word-list.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Convert word list to Set for O(1) lookup
const validWords = new Set(wordList as string[])

/**
 * Get a random word from the word list
 */
function getRandomWord(): string {
    const words = wordList as string[]
    const index = Math.floor(Math.random() * words.length)
    return words[index]
}

/**
 * Check if a word exists in the dictionary
 */
function isValidWord(word: string): boolean {
    return validWords.has(word.toLowerCase().trim())
}

export async function POST(request: Request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const body = await request.json()
        const { username, secret_word, random = false } = body

        // Check if user is authorized (streamer or mod)
        const { data: authorized } = await supabase
            .from('authorized_users')
            .select('id')
            .ilike('username', username?.toLowerCase() || '')
            .single()

        if (!authorized) {
            return NextResponse.json({ error: 'Seuls les modos peuvent démarrer une session' }, { status: 403 })
        }

        // Check if there's already an active session
        const { data: activeSession } = await supabase
            .from('cemantig_sessions')
            .select('id')
            .eq('status', 'active')
            .single()

        if (activeSession) {
            return NextResponse.json({ error: 'Une session est déjà en cours' }, { status: 400 })
        }

        let wordToUse: string
        let isRandomWord = false

        if (random) {
            // Generate random word from our dictionary
            wordToUse = getRandomWord()
            isRandomWord = true
        } else {
            // Use provided secret word
            wordToUse = secret_word?.toLowerCase().trim()

            if (!wordToUse) {
                return NextResponse.json({ error: 'Mot secret requis' }, { status: 400 })
            }

            // Validate the word exists in the dictionary
            if (!isValidWord(wordToUse)) {
                return NextResponse.json({
                    error: `Le mot "${wordToUse}" n'existe pas dans le dictionnaire. Choisis un autre mot ou utilise le mode aléatoire.`
                }, { status: 400 })
            }
        }

        // Create new session
        const { data: session, error } = await supabase
            .from('cemantig_sessions')
            .insert({
                secret_word: wordToUse,
                status: 'active',
                is_random: isRandomWord
            })
            .select('id, started_at, is_random')
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                started_at: session.started_at,
                is_random: session.is_random
            },
            message: isRandomWord
                ? 'Session Cemantig démarrée avec un mot aléatoire !'
                : 'Session Cemantig démarrée !'
        })
    } catch (error) {
        console.error('Error starting session:', error)
        return NextResponse.json({ error: 'Erreur lors du démarrage' }, { status: 500 })
    }
}
