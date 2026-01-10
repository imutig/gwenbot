/**
 * Gwendle - Word list and daily word utilities
 * Wordle-style game with 5-letter and 7-letter French words
 */

import validWordsList from './valid-words.json'
import dailyWordsList from './daily-words.json'
import validWordsList7 from './valid-words-7.json'
import dailyWordsList7 from './daily-words-7.json'

// All valid words for guessing
export const VALID_WORDS: string[] = validWordsList as string[]
export const VALID_WORDS_7: string[] = validWordsList7 as string[]

// Top 3000 most common words for daily word selection
export const DAILY_WORDS: string[] = dailyWordsList as string[]
export const DAILY_WORDS_7: string[] = dailyWordsList7 as string[]

// Valid guesses sets
export const VALID_GUESSES = new Set(VALID_WORDS)
export const VALID_GUESSES_7 = new Set(VALID_WORDS_7)

export type WordLength = 5 | 7

/**
 * Get the daily word based on date and length
 * Same word for everyone on the same day
 */
export function getDailyWord(length: WordLength = 5): { word: string; dayNumber: number } {
    // Reference date: Jan 1, 2026
    const startDate = new Date('2026-01-01T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const msPerDay = 24 * 60 * 60 * 1000
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / msPerDay)

    // Day number is 1-indexed for display (Jan 1 = Day 1)
    const dayNumber = daysSinceStart + 1

    // Select list based on length
    const words = length === 7 ? DAILY_WORDS_7 : DAILY_WORDS

    // Use daysSinceStart as seed for deterministic random selection
    // Different seed modifier for 7 letters to avoid same patterns
    const modifier = length === 7 ? 2654435789 : 2654435761
    const index = Math.abs(daysSinceStart * modifier) % words.length

    return {
        word: words[index].toUpperCase(),
        dayNumber
    }
}

/**
 * Check if a word is valid (exists in word list)
 */
export function isValidWord(word: string, length: WordLength = 5): boolean {
    if (length === 7) {
        return VALID_GUESSES_7.has(word.toLowerCase())
    }
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
    const len = target.length
    const result: ('correct' | 'present' | 'absent')[] = Array(len).fill('absent')
    const targetCounts: Record<string, number> = {}

    // Count letters in target
    for (const letter of targetArr) {
        targetCounts[letter] = (targetCounts[letter] || 0) + 1
    }

    // First pass: mark correct letters
    for (let i = 0; i < len; i++) {
        if (guessArr[i] === targetArr[i]) {
            result[i] = 'correct'
            targetCounts[guessArr[i]]--
        }
    }

    // Second pass: mark present letters
    for (let i = 0; i < len; i++) {
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
    guesses: string[],
    results: ('correct' | 'present' | 'absent')[][],
    won: boolean,
    dayNumber: number,
    wordLength: number = 5
): string {
    const maxAttempts = 8
    const attemptCount = won ? guesses.length : 'X'
    const lengthIndicator = wordLength === 7 ? ' (7 lettres)' : ''

    let text = `Gwendle #${dayNumber}${lengthIndicator} ${attemptCount}/${maxAttempts}\n\n`

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
