'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import FancyButton from '@/components/ui/fancy-button'

// Initialize Supabase client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

// SVG Icons
const GamepadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
        <line x1="6" x2="10" y1="12" y2="12" /><line x1="8" x2="8" y1="10" y2="14" />
        <line x1="15" x2="15.01" y1="13" y2="13" /><line x1="18" x2="18.01" y1="11" y2="11" />
        <rect width="20" height="12" x="2" y="6" rx="2" />
    </svg>
)

const SwordsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
        <line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" />
        <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
        <line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />
    </svg>
)

const GridIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
    </svg>
)

type Mode = 'solo' | '1v1'
type Difficulty = 'easy' | 'medium' | 'hard'
type GameStatus = 'idle' | 'waiting' | 'playing' | 'finished'

interface GameState {
    id?: number
    puzzle?: string
    solution?: string
    status: GameStatus
    host?: { username: string }
    challenger?: { username: string }
    winner?: { username: string }
    queue?: { username: string }[]
}

interface HistoryEntry {
    grid: number[]
    selectedCell: number | null
}

export default function SudokuPage() {
    const [mode, setMode] = useState<Mode>('solo')
    const [difficulty, setDifficulty] = useState<Difficulty>('medium')
    const [loading, setLoading] = useState(false)
    const [gameState, setGameState] = useState<GameState>({ status: 'idle' })
    const [grid, setGrid] = useState<number[]>(Array(81).fill(0))
    const [originalPuzzle, setOriginalPuzzle] = useState<number[]>([])
    const [selectedCell, setSelectedCell] = useState<number | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    // New states for enhanced features
    const [timer, setTimer] = useState(0)
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const gridRef = useRef<HTMLDivElement>(null)

    // User state - loaded from session
    const [user, setUser] = useState({ username: '', isAuthorized: false })

    // Opponent progress for 1v1 visualization
    const [opponentProgress, setOpponentProgress] = useState<string>('')
    const [opponentUsername, setOpponentUsername] = useState<string>('')

    // Load user from session on mount
    useEffect(() => {
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated && data.user) {
                    // Check if user is authorized
                    const authRes = await fetch(`/api/admin/check?username=${encodeURIComponent(data.user.display_name)}`)
                    const authData = await authRes.json()
                    setUser({
                        username: data.user.display_name,
                        isAuthorized: authData.isAuthorized || false
                    })
                }
            } catch (error) {
                console.error('Error loading user:', error)
            }
        }
        loadUser()
    }, [])

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimer(t => t + 1)
            }, 1000)
        }
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isTimerRunning])

    // Keyboard input effect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState.status !== 'playing' || selectedCell === null) return
            if (originalPuzzle[selectedCell] !== 0) return // Can't edit original cells

            const key = e.key

            // Number keys 1-9
            if (key >= '1' && key <= '9') {
                e.preventDefault()
                handleNumberInput(parseInt(key))
            }
            // Delete or Backspace to clear
            else if (key === 'Delete' || key === 'Backspace' || key === '0') {
                e.preventDefault()
                handleNumberInput(0)
            }
            // Arrow keys for navigation
            else if (key === 'ArrowUp' && selectedCell >= 9) {
                e.preventDefault()
                setSelectedCell(selectedCell - 9)
            }
            else if (key === 'ArrowDown' && selectedCell < 72) {
                e.preventDefault()
                setSelectedCell(selectedCell + 9)
            }
            else if (key === 'ArrowLeft' && selectedCell % 9 > 0) {
                e.preventDefault()
                setSelectedCell(selectedCell - 1)
            }
            else if (key === 'ArrowRight' && selectedCell % 9 < 8) {
                e.preventDefault()
                setSelectedCell(selectedCell + 1)
            }
            // Undo/Redo with Ctrl+Z / Ctrl+Y
            else if ((e.ctrlKey || e.metaKey) && key === 'z') {
                e.preventDefault()
                handleUndo()
            }
            else if ((e.ctrlKey || e.metaKey) && key === 'y') {
                e.preventDefault()
                handleRedo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [gameState.status, selectedCell, originalPuzzle, historyIndex, history])

    // Check for active game on load
    useEffect(() => {
        checkGameStatus()
    }, [])

    // Subscribe to Realtime updates via Broadcast
    useEffect(() => {
        if (!supabase) return

        const channel = supabase
            .channel('sudoku-broadcast')
            .on('broadcast', { event: 'sudoku_update' }, () => {
                checkGameStatus()
            })
            .subscribe((status) => {
                console.log('[Sudoku] Broadcast subscription status:', status)
            })

        return () => { supabase.removeChannel(channel) }
    }, [])

    const checkGameStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/sudoku/status')
            const data = await res.json()

            if (data.active && data.game) {
                setGameState({
                    id: data.game.id,
                    puzzle: data.game.puzzle,
                    status: data.game.status as GameStatus,
                    host: data.game.host,
                    challenger: data.game.challenger,
                    winner: data.game.winner,
                    queue: data.queue
                })

                if (data.game.puzzle && data.game.status === 'playing') {
                    const puzzleArray = data.game.puzzle.split('').map(Number)
                    setGrid(puzzleArray)
                    setOriginalPuzzle(puzzleArray)

                    // Set opponent progress for 1v1
                    const isHost = data.game.host?.username?.toLowerCase() === user.username.toLowerCase()
                    if (isHost && data.game.challengerProgress) {
                        setOpponentProgress(data.game.challengerProgress)
                        setOpponentUsername(data.game.challenger?.username || 'Adversaire')
                    } else if (!isHost && data.game.hostProgress) {
                        setOpponentProgress(data.game.hostProgress)
                        setOpponentUsername(data.game.host?.username || 'Adversaire')
                    }
                }
            } else {
                setGameState({ status: 'idle' })
                setOpponentProgress('')
                setOpponentUsername('')
            }
        } catch (error) {
            console.error('Error checking status:', error)
        }
    }, [user.username])

    // Add to history when grid changes
    const addToHistory = (newGrid: number[]) => {
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push({ grid: [...newGrid], selectedCell })
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
    }

    const handleUndo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1]
            setGrid(prevState.grid)
            setHistoryIndex(historyIndex - 1)
        }
    }

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1]
            setGrid(nextState.grid)
            setHistoryIndex(historyIndex + 1)
        }
    }

    const handleStartSolo = async () => {
        setLoading(true)
        setMessage(null)

        try {
            const res = await fetch('/api/sudoku/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'solo', difficulty })
            })
            const data = await res.json()

            if (data.success && data.game) {
                const puzzleArray = data.game.puzzle.split('').map(Number)
                setGrid(puzzleArray)
                setOriginalPuzzle(puzzleArray)
                setGameState({
                    status: 'playing',
                    puzzle: data.game.puzzle,
                    solution: data.game.solution
                })
                // Start timer and reset history
                setTimer(0)
                setIsTimerRunning(true)
                setHistory([{ grid: puzzleArray, selectedCell: null }])
                setHistoryIndex(0)
            } else {
                setMessage(data.error || 'Erreur lors du lancement')
            }
        } catch (error) {
            console.error('Error starting solo:', error)
            setMessage('Erreur de connexion')
        }

        setLoading(false)
    }

    const handleCreate1v1 = async () => {
        if (!user.isAuthorized) {
            setMessage('Seuls les utilisateurs autorisés peuvent créer une session 1v1')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: '1v1', difficulty, userId: user.username, username: user.username })
            })
            const data = await res.json()
            if (data.success) {
                // Refresh game status to show waiting screen
                await checkGameStatus()
            } else {
                setMessage(data.error || 'Erreur lors de la création')
            }
        } catch (error) {
            console.error('Error creating 1v1:', error)
            setMessage('Erreur de connexion')
        }
        setLoading(false)
    }

    const handleJoinQueue = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.username, username: user.username })
            })
            const data = await res.json()
            setMessage(data.message || data.error)
        } catch (error) {
            console.error('Error joining queue:', error)
            setMessage('Erreur de connexion')
        }
        setLoading(false)
    }

    const handlePickRandom = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'xsgwen', random: true })
            })
            const data = await res.json()
            setMessage(data.message || data.error)
        } catch (error) {
            console.error('Error picking:', error)
        }
        setLoading(false)
    }

    const handleCellClick = (index: number) => {
        setSelectedCell(index)
        // Focus the grid for keyboard input
        gridRef.current?.focus()
    }

    const handleNumberInput = (num: number) => {
        if (selectedCell === null) return
        if (originalPuzzle[selectedCell] !== 0) return // Can't edit original cells

        const newGrid = [...grid]
        newGrid[selectedCell] = num
        setGrid(newGrid)
        addToHistory(newGrid)

        // Check if puzzle is complete
        checkCompletion(newGrid)
    }

    const checkCompletion = async (currentGrid: number[]) => {
        if (!gameState.solution) return

        const isFilled = currentGrid.every(c => c !== 0)
        if (isFilled) {
            const gridStr = currentGrid.join('')
            if (gridStr === gameState.solution) {
                // Capture time FIRST before stopping
                const finalTime = timer
                setIsTimerRunning(false)
                setMessage(`Bravo ! Puzzle r\u00e9solu en ${formatTime(finalTime)}`)
                setGameState({ ...gameState, status: 'finished' })

                // Save solo game to database
                try {
                    await fetch('/api/sudoku/complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            difficulty,
                            time_seconds: finalTime,
                            username: user.username
                        })
                    })
                } catch (error) {
                    console.error('Failed to save game:', error)
                }
            }
        }
    }

    // Check if a cell has a conflict
    const hasConflict = (index: number, value: number): boolean => {
        if (value === 0) return false

        const row = Math.floor(index / 9)
        const col = index % 9
        const blockRow = Math.floor(row / 3) * 3
        const blockCol = Math.floor(col / 3) * 3

        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && grid[row * 9 + c] === value) return true
        }

        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && grid[r * 9 + col] === value) return true
        }

        // Check 3x3 block
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                const i = r * 9 + c
                if (i !== index && grid[i] === value) return true
            }
        }

        return false
    }

    // Get highlighting state for a cell
    const getCellHighlight = (index: number, value: number) => {
        if (selectedCell === null) return { isHighlighted: false, isSameNumber: false, isConflictingWithSelected: false }

        const selectedRow = Math.floor(selectedCell / 9)
        const selectedCol = selectedCell % 9
        const selectedBlock = Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3)

        const cellRow = Math.floor(index / 9)
        const cellCol = index % 9
        const cellBlock = Math.floor(cellRow / 3) * 3 + Math.floor(cellCol / 3)

        const isHighlighted = cellRow === selectedRow || cellCol === selectedCol || cellBlock === selectedBlock
        const selectedValue = grid[selectedCell]
        const isSameNumber = value !== 0 && selectedValue !== 0 && value === selectedValue && index !== selectedCell

        // Check if this cell conflicts with the selected cell
        const isConflictingWithSelected = value !== 0 &&
            selectedValue !== 0 &&
            value === selectedValue &&
            index !== selectedCell &&
            (cellRow === selectedRow || cellCol === selectedCol || cellBlock === selectedBlock)

        return { isHighlighted, isSameNumber, isConflictingWithSelected }
    }

    // Calculate progress
    const calculateProgress = (): number => {
        const empty = originalPuzzle.filter(c => c === 0).length
        const filled = grid.filter((c, i) => originalPuzzle[i] === 0 && c !== 0).length
        return empty > 0 ? Math.round((filled / empty) * 100) : 100
    }

    // Format time as mm:ss
    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const getDifficultyButtonStyle = (d: Difficulty) => ({
        flex: 1,
        padding: '0.5rem 1rem',
        background: difficulty === d ? 'var(--pink-accent)' : 'var(--bg-input)',
        color: difficulty === d ? 'white' : 'var(--text-primary)',
        border: `1px solid ${difficulty === d ? 'var(--pink-accent)' : 'var(--border-color)'}`,
        borderRadius: '20px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    })

    // Render Sudoku grid
    const renderGrid = () => (
        <div
            ref={gridRef}
            tabIndex={0}
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(9, 1fr)',
                gap: '2px',
                background: 'var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '540px',
                margin: '0 auto 1rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                outline: 'none'
            }}>
            {grid.map((value, i) => {
                const isOriginal = originalPuzzle[i] !== 0
                const isSelected = selectedCell === i
                const row = Math.floor(i / 9)
                const col = i % 9
                const isThickRight = col === 2 || col === 5
                const isThickBottom = row === 2 || row === 5
                const { isHighlighted, isSameNumber, isConflictingWithSelected } = getCellHighlight(i, value)
                const isError = !isOriginal && hasConflict(i, value)

                // Background color logic
                let bgColor = 'var(--bg-base)'
                if (isSelected && isError) bgColor = 'rgba(239, 68, 68, 0.4)'
                else if (isSelected) bgColor = 'var(--pink-accent)'
                else if (isConflictingWithSelected) bgColor = 'rgba(239, 68, 68, 0.25)'
                else if (isError) bgColor = 'rgba(239, 68, 68, 0.2)'
                else if (isSameNumber) bgColor = 'rgba(236, 72, 153, 0.3)'
                else if (isHighlighted) bgColor = 'rgba(236, 72, 153, 0.1)'
                else if (isOriginal) bgColor = 'var(--bg-card)'

                // Text color logic
                let textColor = 'var(--pink-accent)'
                if (isSelected && isError) textColor = 'white'
                else if (isSelected) textColor = 'white'
                else if (isConflictingWithSelected || isError) textColor = '#dc2626'
                else if (isSameNumber) textColor = 'var(--pink-accent)'
                else if (isOriginal) textColor = 'var(--text-primary)'

                return (
                    <div
                        key={i}
                        onClick={() => handleCellClick(i)}
                        style={{
                            aspectRatio: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: bgColor,
                            color: textColor,
                            fontWeight: isOriginal || isSameNumber || isError ? 700 : 500,
                            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                            cursor: 'pointer',
                            borderRight: isThickRight ? '3px solid var(--text-primary)' : undefined,
                            borderBottom: isThickBottom ? '3px solid var(--text-primary)' : undefined,
                            transition: 'background 0.15s ease'
                        }}
                    >
                        {value || ''}
                    </div>
                )
            })}
        </div>
    )

    // Render opponent's mini grid (1v1 mode only)
    const renderOpponentGrid = () => {
        if (!opponentProgress || mode !== '1v1' || gameState.status !== 'playing') return null

        const opponentGrid = opponentProgress.split('').map(Number)
        const puzzleGrid = originalPuzzle.length > 0 ? originalPuzzle : Array(81).fill(0)

        return (
            <div style={{
                position: 'fixed',
                bottom: '1rem',
                right: '1rem',
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '0.75rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                zIndex: 100
            }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' }}>
                    {opponentUsername}
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(9, 1fr)',
                        gap: '1px',
                        width: '120px',
                        height: '120px',
                        background: 'var(--border-color)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}
                >
                    {opponentGrid.map((value, i) => {
                        const isOriginal = puzzleGrid[i] !== 0
                        const isFilled = value !== 0
                        const row = Math.floor(i / 9)
                        const col = i % 9
                        const isThickRight = col === 2 || col === 5
                        const isThickBottom = row === 2 || row === 5

                        // Color: gray for original, pink for filled by opponent, transparent for empty
                        let bgColor = 'var(--bg-base)'
                        if (isOriginal) bgColor = 'rgba(100, 100, 100, 0.3)'
                        else if (isFilled) bgColor = 'var(--pink-accent)'

                        return (
                            <div
                                key={i}
                                style={{
                                    background: bgColor,
                                    borderRight: isThickRight ? '2px solid var(--text-muted)' : undefined,
                                    borderBottom: isThickBottom ? '2px solid var(--text-muted)' : undefined
                                }}
                            />
                        )
                    })}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>
                    {Math.round((opponentGrid.filter(v => v !== 0).length / 81) * 100)}% complété
                </div>
            </div>
        )
    }

    // Render number pad
    const renderNumberPad = () => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                    key={num}
                    onClick={() => handleNumberInput(num)}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                    }}
                >
                    {num}
                </button>
            ))}
            <button
                onClick={() => handleNumberInput(0)}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-muted)',
                    fontSize: '1rem',
                    cursor: 'pointer'
                }}
            >
                ✕
            </button>
        </div>
    )

    // Render game controls (timer, progress, undo/redo)
    const renderGameControls = () => {
        const progress = calculateProgress()

        return (
            <div style={{ marginBottom: '1rem' }}>
                {/* Timer and Progress */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '24px', height: '24px' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace' }}>{formatTime(timer)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: historyIndex <= 0 ? 'var(--bg-input)' : 'var(--bg-card)',
                                color: historyIndex <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: historyIndex >= history.length - 1 ? 'var(--bg-input)' : 'var(--bg-card)',
                                color: historyIndex >= history.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Rétablir
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ position: 'relative', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--pink-accent), #f472b6)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {progress}% complété
                </div>
            </div>
        )
    }

    // Idle state - game selection
    if (gameState.status === 'idle') {
        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', width: '100%' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <GridIcon /> Sudoku
                    </h1>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>Mode</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className={`btn ${mode === 'solo' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => setMode('solo')}>
                                <GamepadIcon /> Solo
                            </button>
                            <button className={`btn ${mode === '1v1' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => setMode('1v1')}>
                                <SwordsIcon /> 1v1
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>Difficulté</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button style={getDifficultyButtonStyle('easy')} onClick={() => setDifficulty('easy')}>Facile</button>
                            <button style={getDifficultyButtonStyle('medium')} onClick={() => setDifficulty('medium')}>Moyen</button>
                            <button style={getDifficultyButtonStyle('hard')} onClick={() => setDifficulty('hard')}>Difficile</button>
                        </div>
                    </div>

                    {message && (
                        <div style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--bg-card)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {message}
                        </div>
                    )}

                    {mode === 'solo' ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <FancyButton size="sm" onClick={handleStartSolo} disabled={loading}>
                                {loading ? 'Chargement...' : 'Lancer la partie'}
                            </FancyButton>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            {user.isAuthorized ? (
                                <FancyButton size="sm" onClick={handleCreate1v1} disabled={loading}>
                                    {loading ? 'Chargement...' : 'Créer une session 1v1'}
                                </FancyButton>
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>
                                    Seuls les utilisateurs autorisés peuvent créer une session 1v1
                                </p>
                            )}
                        </div>
                    )}

                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.85rem' }}>
                        Utilise le clavier (1-9) ou les flèches pour naviguer
                    </p>
                </div>
            </div>
        )
    }

    // Waiting state - queue view
    if (gameState.status === 'waiting') {
        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', width: '100%' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'center' }}>
                        Session 1v1 en attente
                    </h1>

                    <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                        Host: <strong>{gameState.host?.username || 'xsgwen'}</strong>
                    </p>

                    <h3 style={{ marginBottom: '0.5rem' }}>File d&apos;attente ({gameState.queue?.length || 0})</h3>
                    <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', borderRadius: '12px', padding: '1rem' }}>
                        {gameState.queue && gameState.queue.length > 0 ? (
                            gameState.queue.map((q, i) => (
                                <div key={i} style={{ padding: '0.5rem', borderBottom: i < gameState.queue!.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                                    {i + 1}. {q.username}
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aucun participant</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {user.isAuthorized ? (
                            <FancyButton size="sm" onClick={handlePickRandom} disabled={loading || !gameState.queue?.length}>
                                Choisir au hasard
                            </FancyButton>
                        ) : (
                            <FancyButton size="sm" onClick={handleJoinQueue} disabled={loading}>
                                {loading ? 'Chargement...' : 'Rejoindre la file'}
                            </FancyButton>
                        )}
                    </div>

                    {message && <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{message}</p>}
                </div>
            </div>
        )
    }

    // Playing/Finished state - grid view
    return (
        <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: '700px', width: '100%' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'center' }}>
                    {gameState.challenger ? `${gameState.host?.username} vs ${gameState.challenger?.username}` : 'Sudoku Solo'}
                </h1>

                {renderGameControls()}
                {renderGrid()}
                {gameState.status === 'playing' && renderNumberPad()}

                {message && <p style={{ textAlign: 'center', color: 'var(--pink-accent)', fontWeight: 600, marginTop: '1rem' }}>{message}</p>}

                {gameState.status === 'finished' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <FancyButton size="sm" onClick={() => { setGameState({ status: 'idle' }); setTimer(0); setHistory([]); setHistoryIndex(-1) }}>
                            Nouvelle partie
                        </FancyButton>
                    </div>
                )}
            </div>

            {/* Opponent's mini grid for 1v1 */}
            {renderOpponentGrid()}
        </div>
    )
}
