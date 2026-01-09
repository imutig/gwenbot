/**
 * Gwendle - Word list and daily word utilities
 * Wordle-style game with 5-letter French words
 */

import wordListFull from './word-list.json'

// Filter only 5-letter words
export const GWENDLE_WORDS: string[] = (wordListFull as string[]).filter(
    w => w.length === 5 && /^[a-zàâäéèêëïîôùûüçœæ]+$/i.test(w)
)

// Valid guesses - all 5-letter words
export const VALID_GUESSES = new Set(GWENDLE_WORDS)

/**
 * Get the daily word based on date
 * Same word for everyone on the same day
 */
export function getDailyWord(): { word: string; dayNumber: number } {
    // Reference date: Jan 1, 2026
    const startDate = new Date('2026-01-01T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const msPerDay = 24 * 60 * 60 * 1000
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / msPerDay)

    // Day number is 1-indexed for display (Jan 1 = Day 1)
    const dayNumber = daysSinceStart + 1

    // Use daysSinceStart as seed for deterministic random selection
    const index = Math.abs(daysSinceStart * 2654435761) % GWENDLE_WORDS.length

    return {
        word: GWENDLE_WORDS[index].toUpperCase(),
        dayNumber
    }
}

/**
 * Check if a word is valid (exists in word list)
 */
export function isValidWord(word: string): boolean {
    return VALID_GUESSES.has(word.toLowerCase())
}

/**
 * Compare guess to target and return letter states
 * 'correct' = right letter, right position (🟩)
 * 'present' = right letter, wrong position (🟨)
 * 'absent' = letter not in word (⬜)
 */
export function checkGuess(guess: string, target: string): ('correct' | 'present' | 'absent')[] {
    const guessArr = guess.toUpperCase().split('')
    const targetArr = target.toUpperCase().split('')
    const result: ('correct' | 'present' | 'absent')[] = Array(5).fill('absent')
    const targetCounts: Record<string, number> = {}

    // Count letters in target
    for (const letter of targetArr) {
        targetCounts[letter] = (targetCounts[letter] || 0) + 1
    }

    // First pass: mark correct letters
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
            result[i] = 'correct'
            targetCounts[guessArr[i]]--
        }
    }

    // Second pass: mark present letters
    for (let i = 0; i < 5; i++) {
        if (result[i] !== 'correct' && targetCounts[guessArr[i]] > 0) {
            result[i] = 'present'
            targetCounts[guessArr[i]]--
        }
    }

    return result
}

/**
 * Generate shareable result string
 */
export function generateShareText(
    guesses: string[][],
    results: ('correct' | 'present' | 'absent')[][],
    won: boolean,
    dayNumber: number
): string {
    const maxAttempts = 8
    const attemptCount = won ? guesses.length : 'X'

    let text = `Gwendle #${dayNumber} ${attemptCount}/${maxAttempts}\n\n`

    for (const result of results) {
        const row = result.map(r => {
            switch (r) {
                case 'correct': return '🟩'
                case 'present': return '🟨'
                case 'absent': return '⬜'
            }
        }).join('')
        text += row + '\n'
    }

    text += '\nhttps://www.xsgwen.fr/gwendle'

    return text.trim()
}
