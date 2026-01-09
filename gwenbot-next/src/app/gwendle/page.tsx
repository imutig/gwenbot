'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDailyWord, isValidWord, checkGuess, generateShareText } from '@/lib/gwendle-words'
import { useToast } from '@/components/toast-context'

const MAX_ATTEMPTS = 8
const WORD_LENGTH = 5

const KEYBOARD_ROWS = [
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', '⌫']
]

type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd'
type GameState = 'playing' | 'won' | 'lost'

interface GameData {
    dayNumber: number
    guesses: string[]
    gameState: GameState
}

const styles = `
    .gwendle-container {
        max-width: 500px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
    }
    .game-grid {
        display: grid;
        grid-template-rows: repeat(8, 1fr);
        gap: 6px;
    }
    .row {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
    }
    .cell {
        width: 56px;
        height: 56px;
        border: 2px solid var(--border-color);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.75rem;
        font-weight: bold;
        text-transform: uppercase;
        transition: all 0.15s ease;
    }
    .cell.tbd {
        border-color: var(--pink-accent);
        animation: pop 0.1s ease-out;
    }
    .cell.correct {
        background: #22c55e;
        border-color: #22c55e;
        color: white;
    }
    .cell.present {
        background: #eab308;
        border-color: #eab308;
        color: white;
    }
    .cell.absent {
        background: #6b7280;
        border-color: #6b7280;
        color: white;
    }
    .keyboard {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 500px;
    }
    .keyboard-row {
        display: flex;
        justify-content: center;
        gap: 6px;
    }
    .key {
        min-width: 36px;
        height: 52px;
        border-radius: 6px;
        border: none;
        background: var(--bg-card);
        color: var(--text-primary);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.1s ease;
    }
    .key:hover {
        filter: brightness(1.1);
    }
    .key.wide {
        min-width: 60px;
        font-size: 0.75rem;
    }
    .key.correct { background: #22c55e; color: white; }
    .key.present { background: #eab308; color: white; }
    .key.absent { background: #374151; color: #9ca3af; }
    .message-banner {
        padding: 1rem 2rem;
        border-radius: 12px;
        font-weight: 600;
        text-align: center;
    }
    .message-banner.won {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
    }
    .message-banner.lost {
        background: linear-gradient(135deg, var(--pink-main), var(--pink-accent));
        color: white;
    }
    .share-btn {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        background: var(--pink-main);
        color: white;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .share-btn:hover {
        background: var(--pink-accent);
        transform: translateY(-2px);
    }
    @keyframes pop {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
    }
    .shake {
        animation: shake 0.4s ease;
    }
`

export default function GwendlePage() {
    const { showToast } = useToast()
    const [dailyWord, setDailyWord] = useState('')
    const [dayNumber, setDayNumber] = useState(0)
    const [guesses, setGuesses] = useState<string[]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [gameState, setGameState] = useState<GameState>('playing')
    const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({})
    const [shakeRow, setShakeRow] = useState(-1)

    // Load game state from localStorage
    useEffect(() => {
        const { word, dayNumber: day } = getDailyWord()
        setDailyWord(word)
        setDayNumber(day)

        const saved = localStorage.getItem('gwendle-game')
        if (saved) {
            try {
                const data: GameData = JSON.parse(saved)
                if (data.dayNumber === day) {
                    setGuesses(data.guesses)
                    setGameState(data.gameState)
                    // Rebuild letter states
                    const states: Record<string, LetterState> = {}
                    for (const guess of data.guesses) {
                        const result = checkGuess(guess, word)
                        guess.split('').forEach((letter, i) => {
                            const current = states[letter]
                            if (result[i] === 'correct') {
                                states[letter] = 'correct'
                            } else if (result[i] === 'present' && current !== 'correct') {
                                states[letter] = 'present'
                            } else if (!current) {
                                states[letter] = 'absent'
                            }
                        })
                    }
                    setLetterStates(states)
                }
            } catch (e) {
                console.error('Error loading game:', e)
            }
        }
    }, [])

    // Save game state
    const saveGame = useCallback((newGuesses: string[], newState: GameState) => {
        const data: GameData = {
            dayNumber,
            guesses: newGuesses,
            gameState: newState
        }
        localStorage.setItem('gwendle-game', JSON.stringify(data))
    }, [dayNumber])

    const handleKeyPress = useCallback((key: string) => {
        if (gameState !== 'playing') return

        if (key === 'ENTER') {
            if (currentGuess.length !== WORD_LENGTH) {
                showToast('Le mot doit faire 5 lettres', 'error')
                return
            }
            if (!isValidWord(currentGuess)) {
                showToast('Mot non reconnu', 'error')
                setShakeRow(guesses.length)
                setTimeout(() => setShakeRow(-1), 400)
                return
            }

            // Check guess
            const result = checkGuess(currentGuess, dailyWord)
            const newGuesses = [...guesses, currentGuess.toUpperCase()]
            setGuesses(newGuesses)
            setCurrentGuess('')

            // Update letter states
            const newStates = { ...letterStates }
            currentGuess.toUpperCase().split('').forEach((letter, i) => {
                const current = newStates[letter]
                if (result[i] === 'correct') {
                    newStates[letter] = 'correct'
                } else if (result[i] === 'present' && current !== 'correct') {
                    newStates[letter] = 'present'
                } else if (!current) {
                    newStates[letter] = 'absent'
                }
            })
            setLetterStates(newStates)

            // Check win/lose
            if (currentGuess.toUpperCase() === dailyWord) {
                setGameState('won')
                saveGame(newGuesses, 'won')
            } else if (newGuesses.length >= MAX_ATTEMPTS) {
                setGameState('lost')
                saveGame(newGuesses, 'lost')
            } else {
                saveGame(newGuesses, 'playing')
            }
        } else if (key === '⌫' || key === 'BACKSPACE') {
            setCurrentGuess(prev => prev.slice(0, -1))
        } else if (/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]$/i.test(key) && currentGuess.length < WORD_LENGTH) {
            setCurrentGuess(prev => prev + key.toUpperCase())
        }
    }, [gameState, currentGuess, guesses, dailyWord, letterStates, showToast, saveGame])

    // Keyboard event listener
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return
            handleKeyPress(e.key.toUpperCase())
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handleKeyPress])

    const handleShare = async () => {
        const results = guesses.map(g => checkGuess(g, dailyWord))
        const text = generateShareText(
            guesses.map(g => g.split('')),
            results,
            gameState === 'won',
            dayNumber
        )

        try {
            await navigator.clipboard.writeText(text)
            showToast('Résultat copié ! 📋', 'success')
        } catch {
            showToast('Erreur lors de la copie', 'error')
        }
    }

    const getCellState = (rowIndex: number, cellIndex: number): LetterState => {
        if (rowIndex < guesses.length) {
            const guess = guesses[rowIndex]
            return checkGuess(guess, dailyWord)[cellIndex]
        }
        if (rowIndex === guesses.length && cellIndex < currentGuess.length) {
            return 'tbd'
        }
        return 'empty'
    }

    const getCellLetter = (rowIndex: number, cellIndex: number): string => {
        if (rowIndex < guesses.length) {
            return guesses[rowIndex][cellIndex] || ''
        }
        if (rowIndex === guesses.length) {
            return currentGuess[cellIndex] || ''
        }
        return ''
    }

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--pink-accent)' }}>Gwen</span>dle
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Devine le mot en 8 essais • Jour #{dayNumber}
                    </p>
                </div>

                <div className="gwendle-container">
                    {/* Game Grid */}
                    <div className="game-grid">
                        {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className={`row ${shakeRow === rowIndex ? 'shake' : ''}`}
                            >
                                {Array.from({ length: WORD_LENGTH }).map((_, cellIndex) => (
                                    <div
                                        key={cellIndex}
                                        className={`cell ${getCellState(rowIndex, cellIndex)}`}
                                    >
                                        {getCellLetter(rowIndex, cellIndex)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Win/Lose Banner */}
                    {gameState === 'won' && (
                        <div className="message-banner won">
                            🎉 Bravo ! Tu as trouvé en {guesses.length} essai{guesses.length > 1 ? 's' : ''} !
                        </div>
                    )}
                    {gameState === 'lost' && (
                        <div className="message-banner lost">
                            Le mot était : <strong>{dailyWord}</strong>
                        </div>
                    )}

                    {/* Share Button */}
                    {gameState !== 'playing' && (
                        <button className="share-btn" onClick={handleShare}>
                            📤 Partager mon résultat
                        </button>
                    )}

                    {/* Keyboard */}
                    <div className="keyboard">
                        {KEYBOARD_ROWS.map((row, rowIndex) => (
                            <div key={rowIndex} className="keyboard-row">
                                {row.map(key => (
                                    <button
                                        key={key}
                                        className={`key ${key.length > 1 ? 'wide' : ''} ${letterStates[key] || ''}`}
                                        onClick={() => handleKeyPress(key)}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Instructions */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ width: '20px', height: '20px', background: '#22c55e', borderRadius: '4px' }}></span>
                            Bonne lettre, bonne position
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ width: '20px', height: '20px', background: '#eab308', borderRadius: '4px' }}></span>
                            Bonne lettre, mauvaise position
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '20px', height: '20px', background: '#6b7280', borderRadius: '4px' }}></span>
                            Lettre absente du mot
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
