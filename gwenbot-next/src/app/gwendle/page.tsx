'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDailyWord, isValidWord, checkGuess, generateShareText, WordLength } from '@/lib/gwendle-words'
import { useToast } from '@/components/toast-context'

const MAX_ATTEMPTS = 8

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
    wordLength: number
}

const getStyles = (wordLength: number) => `
    .gwendle-container {
        max-width: 500px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
    }
    .mode-selector {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        background: var(--bg-card);
        padding: 4px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }
    .mode-btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 600;
    }
    .mode-btn.active {
        background: var(--pink-main);
        color: white;
    }
    .game-grid {
        display: grid;
        grid-template-rows: repeat(8, 1fr);
        gap: 6px;
    }
    .row {
        display: grid;
        grid-template-columns: repeat(${wordLength}, 1fr);
        gap: 6px;
    }
    .cell {
        width: ${wordLength === 7 ? '42px' : '56px'};
        height: ${wordLength === 7 ? '42px' : '56px'};
        border: 2px solid var(--border-color);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${wordLength === 7 ? '1.4rem' : '1.75rem'};
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
        min-width: 30px;
        height: 48px;
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
        flex: 1;
        transition: all 0.1s;
        text-transform: uppercase;
        user-select: none;
    }
    .key:active {
        transform: scale(0.95);
    }
    .key.correct { background: #22c55e; color: white; }
    .key.present { background: #eab308; color: white; }
    .key.absent { background: #374151; color: #9ca3af; }
    
    @keyframes pop {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }

    .victory-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: 1rem;
        backdrop-filter: blur(4px);
    }
    .victory-content {
        position: relative;
        background: var(--pink-main);
        padding: 2rem;
        border-radius: 16px;
        text-align: center;
        max-width: 400px;
        width: 100%;
        border: 2px solid white;
        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        color: white;
    }
    .victory-title {
        font-size: 2rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        color: white;
    }
    .stat-row {
        display: flex;
        justify-content: space-around;
        margin: 1.5rem 0;
        padding: 1rem;
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
    }
    .stat-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .stat-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: white;
    }
    .stat-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .share-btn {
        background: white;
        color: var(--pink-main);
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 99px;
        font-weight: bold;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0 auto;
        transition: transform 0.2s;
        box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
    }
    .share-btn:hover {
        transform: translateY(-2px);
    }
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`

export default function GwendlePage() {
    const { showToast } = useToast()
    const [wordLength, setWordLength] = useState<WordLength>(5)

    // Game state
    const [targetWord, setTargetWord] = useState('')
    const [guesses, setGuesses] = useState<string[]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [gameState, setGameState] = useState<GameState>('playing')
    const [dayNumber, setDayNumber] = useState(0)
    const [showModal, setShowModal] = useState(false)

    // Auth state
    const [user, setUser] = useState<any>(null)
    const [streaks, setStreaks] = useState<Record<number, number>>({ 5: 0, 7: 0 })
    const hasSyncedRef = useRef(false)

    // Load daily word and user state
    useEffect(() => {
        // Load user from session
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                if (res.ok) {
                    const data = await res.json()
                    if (data.authenticated && data.user) {
                        // Fetch player ID from /api/auth/me for DB operations
                        const meRes = await fetch('/api/auth/me')
                        if (meRes.ok) {
                            const playerData = await meRes.json()
                            setUser(playerData) // { id, username, auth_id }
                        }
                    }
                }
            } catch (e) {
                console.error('Auth check failed', e)
            }
        }
        loadUser()
    }, [])

    // Sync score when user loads and game is done (backfill) - runs only once
    useEffect(() => {
        if (hasSyncedRef.current) return
        if (user && gameState !== 'playing' && guesses.length > 0 && dayNumber === getDailyWord(wordLength).dayNumber) {
            hasSyncedRef.current = true
            const won = gameState === 'won'
            saveScore(won, guesses.length, targetWord, wordLength)
        }
    }, [user, gameState, guesses, targetWord, wordLength, dayNumber])

    // Load game state when wordLength changes
    useEffect(() => {
        const daily = getDailyWord(wordLength)
        setTargetWord(daily.word)
        setDayNumber(daily.dayNumber)

        // Restore state from local storage specific to length
        const savedState = localStorage.getItem(`gwendle-state-${wordLength}`)
        if (savedState) {
            try {
                const parsed: GameData = JSON.parse(savedState)
                // Only restore if it's the same day and same word length
                if (parsed.dayNumber === daily.dayNumber && parsed.wordLength === wordLength) {
                    setGuesses(parsed.guesses)
                    setGameState(parsed.gameState)
                    if (parsed.gameState !== 'playing') {
                        setShowModal(true)
                        // Attempt to save score to ensure sync with DB (backfill)
                        // Need to wait for user to be loaded
                        if (user) {
                            saveScore(parsed.gameState === 'won', parsed.guesses.length, daily.word, wordLength)
                        }
                    }
                } else {
                    // Reset for new day
                    setGuesses([])
                    setGameState('playing')
                    setCurrentGuess('')
                }
            } catch (e) {
                console.error('Failed to parse saved state', e)
                setGuesses([])
                setGameState('playing')
            }
        } else {
            setGuesses([])
            setGameState('playing')
            setCurrentGuess('')
            setShowModal(false)
        }
    }, [wordLength])

    // Save state on change
    useEffect(() => {
        if (dayNumber > 0) {
            const data: GameData = {
                dayNumber,
                guesses,
                gameState,
                wordLength
            }
            localStorage.setItem(`gwendle-state-${wordLength}`, JSON.stringify(data))
        }
    }, [guesses, gameState, dayNumber, wordLength])

    // Handle game win/loss logic (separate from render/input to ensure clean separation)
    useEffect(() => {
        if (gameState !== 'playing') return

        const lastGuess = guesses[guesses.length - 1]
        if (!lastGuess) return

        if (lastGuess === targetWord) {
            setGameState('won')
            setShowModal(true)
            saveScore(true, guesses.length, targetWord, wordLength)
            showToast('Magnifique ! 👏', 'success')
        } else if (guesses.length >= MAX_ATTEMPTS) {
            setGameState('lost')
            setShowModal(true)
            saveScore(false, guesses.length, targetWord, wordLength)
            showToast(`Dommage ! Le mot etait ${targetWord}`, 'error')
        }
    }, [guesses, targetWord]) // Depend on guesses and targetWord

    const saveScore = async (won: boolean, attempts: number, word: string, len: number) => {
        if (!user) return

        try {
            const res = await fetch('/api/stats/gwendle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: user.id,
                    word,
                    attempts,
                    won,
                    wordLength: len
                })
            })

            if (res.ok) {
                const data = await res.json()
                if (data.streak) setStreaks(prev => ({ ...prev, [len]: data.streak }))
            }
        } catch (e) {
            console.error('Failed to save score', e)
        }
    }

    const handleKey = useCallback((key: string) => {
        if (gameState !== 'playing') return

        if (key === 'ENTER') {
            submitGuess()
        } else if (key === '⌫') {
            setCurrentGuess(prev => prev.slice(0, -1))
        } else if (currentGuess.length < wordLength && /^[A-Z]$/.test(key)) {
            setCurrentGuess(prev => prev + key)
        }
    }, [currentGuess, gameState, wordLength])

    // Physical keyboard listener
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handleKey('ENTER')
            else if (e.key === 'Backspace') handleKey('⌫')
            else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase())
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handleKey])

    const submitGuess = () => {
        if (currentGuess.length !== wordLength) {
            showToast('Pas assez de lettres !', 'error')
            return
        }

        if (!isValidWord(currentGuess, wordLength)) {
            showToast('Ce mot n\'est pas dans la liste', 'error')
            return
        }

        setGuesses(prev => [...prev, currentGuess])
        setCurrentGuess('')
    }

    const handleShare = async () => {
        const results = guesses.map(g => checkGuess(g, targetWord))
        const text = generateShareText(guesses, results, gameState === 'won', dayNumber, wordLength)

        try {
            await navigator.clipboard.writeText(text)
            showToast('Résultat copie !', 'success')
        } catch (e) {
            showToast('Erreur lors de la copie', 'error')
        }
    }

    // Helpers for grid display
    const getCellState = (rowIndex: number, cellIndex: number): LetterState => {
        // If it's a past guess
        if (rowIndex < guesses.length) {
            const guess = guesses[rowIndex]
            const result = checkGuess(guess, targetWord)
            return result[cellIndex] as LetterState
        }
        // If it's current row
        if (rowIndex === guesses.length) {
            if (cellIndex < currentGuess.length) return 'tbd'
            return 'empty'
        }
        return 'empty'
    }

    const getCellLetter = (rowIndex: number, cellIndex: number): string => {
        if (rowIndex < guesses.length) {
            return guesses[rowIndex][cellIndex]
        }
        if (rowIndex === guesses.length) {
            return currentGuess[cellIndex] || ''
        }
        return ''
    }

    // Keyboard coloring
    const getKeyState = (key: string): string => {
        let state = ''
        guesses.forEach(guess => {
            const result = checkGuess(guess, targetWord)
            guess.split('').forEach((letter, i) => {
                if (letter === key) {
                    if (result[i] === 'correct') state = 'correct'
                    else if (result[i] === 'present' && state !== 'correct') state = 'present'
                    else if (result[i] === 'absent' && state === '') state = 'absent'
                }
            })
        })
        return state
    }

    return (
        <>
            <style>{getStyles(wordLength)}</style>

            <div className="gwendle-container fade-in" style={{ padding: '2rem 1rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--pink-accent)' }}>Gwen</span>dle
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Le Wordle version Gwen (Mot #{dayNumber})</p>
                </div>

                <div className="mode-selector">
                    <button
                        className={`mode-btn ${wordLength === 5 ? 'active' : ''}`}
                        onClick={() => setWordLength(5)}
                    >
                        5 Lettres
                    </button>
                    <button
                        className={`mode-btn ${wordLength === 7 ? 'active' : ''}`}
                        onClick={() => setWordLength(7)}
                    >
                        7 Lettres
                    </button>
                </div>

                {/* Game Grid */}
                <div className="game-grid">
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => (
                        <div key={rowIndex} className="row">
                            {Array.from({ length: wordLength }).map((_, cellIndex) => (
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

                {/* Keyboard */}
                <div className="keyboard">
                    {KEYBOARD_ROWS.map((row, i) => (
                        <div key={i} className="keyboard-row">
                            {row.map(key => (
                                <button
                                    key={key}
                                    className={`key ${getKeyState(key)}`}
                                    onClick={() => handleKey(key)}
                                    style={key === 'ENTER' || key === '⌫' ? { flex: 1.5 } : {}}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Victory/Defeat Modal */}
                {(gameState === 'won' || gameState === 'lost') && showModal && (
                    <div className="victory-modal" onClick={() => setShowModal(false)}>
                        <div className="victory-content" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    right: '1rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    lineHeight: 1
                                }}
                            >
                                ✕
                            </button>
                            <h2 className="victory-title">
                                {gameState === 'won' ? 'Victoire !' : 'Perdu...'}
                            </h2>

                            {/* Streak Stats */}
                            {streaks[wordLength] > 0 && gameState === 'won' && (
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    fontWeight: 'bold'
                                }}>
                                    🔥 Série en cours : {streaks[wordLength]}
                                </div>
                            )}

                            <div className="stat-row">
                                <div className="stat-item">
                                    <span className="stat-value">{dayNumber}</span>
                                    <span className="stat-label">Jour #</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-value">
                                        {gameState === 'won' ? guesses.length : 'X'}
                                    </span>
                                    <span className="stat-label">Essais</span>
                                </div>
                            </div>

                            <p style={{ marginBottom: '2rem', fontSize: '1.2rem' }}>
                                Le mot etait : <strong style={{ color: 'white', textDecoration: 'underline' }}>{targetWord}</strong>
                            </p>

                            <button className="share-btn" onClick={handleShare}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                Partager
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
