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

const DiceIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" />
        <circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
)

const TrophyIcon = ({ size = 48 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: `${size}px`, height: `${size}px` }}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
)

const CrownIcon = ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: `${size}px`, height: `${size}px` }}>
        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
        <path d="M5 21h14" />
    </svg>
)

const PlayIcon = ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: `${size}px`, height: `${size}px` }}>
        <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />
    </svg>
)

type Mode = 'solo' | '1v1' | 'battle_royale'
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
type GameStatus = 'idle' | 'waiting' | 'playing' | 'finished'

interface Lobby {
    id: number
    mode: string
    difficulty: string
    isBattleRoyale: boolean
    host: { id: number; username: string } | null
    playerCount: number
    createdAt: string
}

interface BRPlayer {
    playerId: number
    username: string
    progress: string
    cellsFilled: number
    errors: number
    status: 'playing' | 'eliminated' | 'finished'
    finishRank?: number
    finishTime?: number
}

interface GameState {
    id?: number
    puzzle?: string
    solution?: string
    status: GameStatus
    isBattleRoyale?: boolean
    host?: { username: string }
    challenger?: { username: string }
    winner?: { username: string }
    queue?: { username: string }[]
    brPlayers?: BRPlayer[]
    leaderProgress?: string
    leaderUsername?: string
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

    // Store final grids for victory screen
    const [finalGrids, setFinalGrids] = useState<{ myGrid: number[], opponentGrid: number[] } | null>(null)

    // Store official winning time for victory screen
    const [winningTime, setWinningTime] = useState<number | null>(null)

    // Error tracking (3 errors = game over)
    const [errorCount, setErrorCount] = useState(0)
    const [opponentErrors, setOpponentErrors] = useState(0)
    const [lossReason, setLossReason] = useState<'completed' | 'errors' | null>(null)

    // Battle Royale specific states
    const [isEliminated, setIsEliminated] = useState(false)
    const [myBRRank, setMyBRRank] = useState<number | null>(null)
    const [hasBRFinished, setHasBRFinished] = useState(false)
    const [brGameFinished, setBrGameFinished] = useState(false)
    const [brWinner, setBrWinner] = useState<string | null>(null)
    const [brPlayers, setBrPlayers] = useState<BRPlayer[]>([])
    const [leaderProgress, setLeaderProgress] = useState<string>('')
    const [leaderUsername, setLeaderUsername] = useState<string>('')

    // Lobby system states
    const [lobbies, setLobbies] = useState<Lobby[]>([])

    // Flag to prevent grid reset when game is already initialized
    const gameInitializedRef = useRef(false)

    // Flag to temporarily skip status checks after unregistering
    const skipStatusCheckUntilRef = useRef<number>(0)

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

            const key = e.key
            const isOriginalCell = originalPuzzle[selectedCell] !== 0

            // Number keys 1-9 (only allowed on non-original cells, and if not eliminated/finished)
            if (key >= '1' && key <= '9') {
                if (isOriginalCell || isEliminated || hasBRFinished) return // Can't edit
                e.preventDefault()
                handleNumberInput(parseInt(key))
            }
            // Delete or Backspace to clear (only allowed on non-original cells, and if not eliminated/finished)
            else if (key === 'Delete' || key === 'Backspace' || key === '0') {
                if (isOriginalCell || isEliminated || hasBRFinished) return // Can't edit
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

    // Check for active game on load (wait for user to be loaded)
    useEffect(() => {
        if (user.username) {
            checkGameStatus()
        }
    }, [user.username])

    const checkGameStatus = useCallback(async () => {
        // Skip if we recently unregistered (prevents race condition with broadcasts)
        if (Date.now() < skipStatusCheckUntilRef.current) {
            console.log('[Sudoku] Skipping checkGameStatus - recently unregistered')
            return
        }

        try {
            const res = await fetch(`/api/sudoku/status?username=${encodeURIComponent(user.username)}`)
            const data = await res.json()
            console.log('[Sudoku] checkGameStatus response:', data)

            // Always update lobbies list
            setLobbies(data.lobbies || [])

            // Handle user's active game
            if (data.myGame) {
                const game = data.myGame
                setGameState({
                    id: game.id,
                    puzzle: game.puzzle,
                    solution: game.solution,
                    status: game.status as GameStatus,
                    isBattleRoyale: game.isBattleRoyale,
                    host: game.host,
                    challenger: game.challenger,
                    winner: game.winner,
                    queue: game.queue,
                    brPlayers: game.brPlayers
                })

                if (game.puzzle && game.status === 'playing') {
                    const puzzleArray = game.puzzle.split('').map(Number)

                    // Only set grid if not already initialized
                    if (!gameInitializedRef.current) {
                        setGrid(puzzleArray)
                        setOriginalPuzzle(puzzleArray)
                        setTimer(0)
                        setIsTimerRunning(true)
                        gameInitializedRef.current = true
                    }

                    // Handle 1v1 opponent progress
                    if (!game.isBattleRoyale && (game.host || game.challenger)) {
                        const isHost = game.host?.username?.toLowerCase() === user.username.toLowerCase()
                        if (isHost) {
                            if (game.challengerProgress) setOpponentProgress(game.challengerProgress)
                            setOpponentUsername(game.challenger?.username || 'Adversaire')
                        } else {
                            if (game.hostProgress) setOpponentProgress(game.hostProgress)
                            setOpponentUsername(game.host?.username || 'Adversaire')
                        }
                    }

                    // Handle BR
                    if (game.isBattleRoyale) {
                        setLeaderProgress(game.leaderProgress || '')
                        setLeaderUsername(game.leaderUsername || '')
                        setBrPlayers(game.brPlayers || [])

                        // Set player's BR status from API
                        if (game.myStatus === 'eliminated') {
                            setIsEliminated(true)
                            setIsTimerRunning(false)
                        } else if (game.myStatus === 'finished') {
                            setHasBRFinished(true)
                            setIsTimerRunning(false)
                        }
                        if (game.myRank) {
                            setMyBRRank(game.myRank)
                        }
                        if (game.myErrors !== undefined) {
                            setErrorCount(game.myErrors)
                        }
                    }
                }
            } else {
                // No active game for user - show idle with lobbies
                if (gameState.status !== 'finished') {
                    setGameState({ status: 'idle' })
                    setOpponentProgress('')
                    setOpponentUsername('')
                    setIsEliminated(false)
                    setHasBRFinished(false)
                    setMyBRRank(null)
                    gameInitializedRef.current = false
                }
            }
        } catch (error) {
            console.error('Error checking status:', error)
        }
    }, [user.username])

    // Subscribe to Realtime updates via Broadcast
    useEffect(() => {
        if (!supabase || !user.username) return

        const channel = supabase
            .channel('sudoku-broadcast')
            .on('broadcast', { event: 'sudoku_update' }, (payload) => {
                console.log('[Sudoku] Broadcast received:', payload)

                // Handle game_finished: show victory screen for losing player
                if (payload.payload?.action === 'game_finished') {
                    const winnerUsername = payload.payload.winner
                    const loserUsername = payload.payload.loser
                    const reason = payload.payload.reason

                    console.log('[Sudoku] Game finished!', { winnerUsername, loserUsername, reason })
                    setIsTimerRunning(false)
                    setWinningTime(payload.payload.time_seconds || 0)

                    // Handle loss by errors
                    if (reason === 'errors' && loserUsername) {
                        setLossReason('errors')
                        // If I'm the loser, opponent wins
                        if (loserUsername.toLowerCase() === user.username.toLowerCase()) {
                            const winner = winnerUsername || opponentUsername || 'Adversaire'
                            setGameState(prev => ({ ...prev, status: 'finished', winner: { username: winner } }))
                            setMessage(`❌ 3 erreurs ! Vous avez perdu.`)
                        } else {
                            // Opponent lost by errors, I win
                            setGameState(prev => ({ ...prev, status: 'finished', winner: { username: user.username } }))
                            setMessage(`🎉 L'adversaire a fait 3 erreurs ! Vous gagnez !`)
                        }
                    } else if (winnerUsername) {
                        setLossReason('completed')
                        setGameState(prev => ({ ...prev, status: 'finished', winner: { username: winnerUsername } }))
                        setMessage(`${winnerUsername} a remporté la partie !`)
                    }
                } else if (payload.payload?.action === 'br_player_finished') {
                    // Someone finished the BR puzzle
                    const finisherUsername = payload.payload.username
                    const finishRank = payload.payload.finishRank

                    // Show notification for everyone
                    if (finishRank === 1) {
                        setMessage(`🏆 ${finisherUsername} a terminé en premier !`)
                    } else {
                        setMessage(`✅ ${finisherUsername} a terminé #${finishRank}`)
                    }

                    // If it's me who finished, mark as finished
                    if (finisherUsername?.toLowerCase() === user.username.toLowerCase()) {
                        setHasBRFinished(true)
                        setMyBRRank(finishRank)
                        setIsTimerRunning(false)
                    }

                    // Refresh to update leaderboard
                    checkGameStatus()
                } else if (payload.payload?.action === 'br_game_finished') {
                    // Game is fully over (all players done)
                    setIsTimerRunning(false)
                    setBrGameFinished(true)
                    setBrWinner(payload.payload.winner || null)
                    setMessage(`🏆 ${payload.payload.winner || 'Le gagnant'} a remporté le Battle Royale !`)
                    checkGameStatus()
                } else if (payload.payload?.action === 'br_player_eliminated') {
                    // Someone got eliminated - just refresh to update leaderboard
                    const eliminatedUser = payload.payload.username
                    if (eliminatedUser?.toLowerCase() !== user.username.toLowerCase()) {
                        setMessage(`💀 ${eliminatedUser} a été éliminé !`)
                    }
                    checkGameStatus()
                } else {
                    // For other broadcasts (progress_update, queue_updated, etc.), refresh status
                    checkGameStatus()
                }
            })
            .subscribe((status) => {
                console.log('[Sudoku] Broadcast subscription status:', status)
            })

        return () => { supabase.removeChannel(channel) }
    }, [user.username, checkGameStatus])

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
                setErrorCount(0)
                setLossReason(null)
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

        // Reset error counts for new game
        setErrorCount(0)
        setOpponentErrors(0)
        setLossReason(null)

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

    const handleCreateBR = async () => {
        if (!user.isAuthorized) {
            setMessage('Seuls les utilisateurs autorisés peuvent créer un Battle Royale')
            return
        }

        // Reset all states for new game
        setErrorCount(0)
        setOpponentErrors(0)
        setLossReason(null)
        setIsEliminated(false)
        setMyBRRank(null)
        setBrPlayers([])
        setLeaderProgress('')
        setLeaderUsername('')

        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'battle_royale', difficulty, userId: user.username, username: user.username })
            })
            const data = await res.json()
            if (data.success) {
                setMode('battle_royale')
                await checkGameStatus()
            } else {
                setMessage(data.error || 'Erreur lors de la création')
            }
        } catch (error) {
            console.error('Error creating BR:', error)
            setMessage('Erreur de connexion')
        }
        setLoading(false)
    }

    const handleJoinQueue = async () => {
        // Reset error counts for new game
        setErrorCount(0)
        setOpponentErrors(0)
        setLossReason(null)

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

    // Join a specific lobby from the list
    const handleJoinLobby = async (gameId: number, isBR: boolean) => {
        setErrorCount(0)
        setOpponentErrors(0)
        setLossReason(null)

        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.username,
                    username: user.username,
                    gameId // Pass specific game ID
                })
            })
            const data = await res.json()
            setMessage(data.message || data.error)
            // Refresh lobbies after joining
            checkGameStatus()
        } catch (error) {
            console.error('Error joining lobby:', error)
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
                body: JSON.stringify({ username: user.username, random: true })
            })
            const data = await res.json()
            setMessage(data.message || data.error)
        } catch (error) {
            console.error('Error picking:', error)
        }
        setLoading(false)
    }

    const handleStartBR = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username })
            })
            const data = await res.json()
            if (data.success) {
                setMessage(data.message)
                // Initialize the game for host
                if (data.puzzle) {
                    const puzzleArray = data.puzzle.split('').map(Number)
                    setGrid(puzzleArray)
                    setOriginalPuzzle(puzzleArray)
                    setTimer(0)
                    setIsTimerRunning(true)
                    gameInitializedRef.current = true
                    setGameState(prev => ({
                        ...prev,
                        status: 'playing',
                        puzzle: data.puzzle,
                        solution: data.solution
                    }))
                }
            } else {
                setMessage(data.error || 'Erreur lors du lancement')
            }
        } catch (error) {
            console.error('Error starting BR:', error)
            setMessage('Erreur de connexion')
        }
        setLoading(false)
    }

    const handleUnregisterBR = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/unregister', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, gameId: gameState.id })
            })
            const data = await res.json()
            if (data.success) {
                setMessage(data.message || 'Désinscrit du Battle Royale')
                // Reset all game state
                setGameState({ status: 'idle' })
                setGrid(Array(81).fill(0))
                setOriginalPuzzle([])
                setTimer(0)
                setIsTimerRunning(false)
                setIsEliminated(false)
                setMyBRRank(null)
                setBrPlayers([])
                setErrorCount(0)
                gameInitializedRef.current = false
                // Skip status checks for 3 seconds to prevent broadcasts from reopening the game
                skipStatusCheckUntilRef.current = Date.now() + 3000
            } else {
                setMessage(data.error || 'Erreur lors de la désinscription')
            }
        } catch (error) {
            console.error('Error unregistering from BR:', error)
            setMessage('Erreur de connexion')
        }
        setLoading(false)
    }

    const handlePickUser = async (challengerUsername: string) => {
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, challengerUsername })
            })
            const data = await res.json()
            setMessage(data.message || data.error)
        } catch (error) {
            console.error('Error picking:', error)
        }
        setLoading(false)
    }

    const handleCancelGame = async () => {
        if (!confirm('Voulez-vous vraiment annuler cette partie ?')) return
        setLoading(true)
        try {
            const res = await fetch('/api/sudoku/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username })
            })
            const data = await res.json()
            if (data.success) {
                setGameState({ status: 'idle' })
                setMessage('Partie annulée')
            } else {
                setMessage(data.error || 'Erreur')
            }
        } catch (error) {
            console.error('Error cancelling:', error)
        }
        setLoading(false)
    }

    const handleCellClick = (index: number) => {
        setSelectedCell(index)
        // Focus the grid for keyboard input
        gridRef.current?.focus()
    }

    const handleNumberInput = async (num: number) => {
        console.log('[Sudoku Debug] *** handleNumberInput called ***', { num, selectedCell, hasSolution: !!gameState.solution })
        if (selectedCell === null) return
        if (originalPuzzle[selectedCell] !== 0) return // Can't edit original cells
        if (gameState.status === 'finished') return // Game already ended

        // Check if this is an error (wrong number placed)
        const solution = gameState.solution
        let isError = false
        let newErrorCount = errorCount

        console.log('[Sudoku Debug] handleNumberInput - solution:', solution ? 'available' : 'MISSING', 'num:', num, 'selectedCell:', selectedCell)

        if (num !== 0 && solution) {
            const correctValue = parseInt(solution[selectedCell])
            console.log('[Sudoku Debug] Checking error - correctValue:', correctValue, 'entered:', num, 'isError:', num !== correctValue)
            if (num !== correctValue) {
                isError = true
                newErrorCount = errorCount + 1
                setErrorCount(newErrorCount)
                console.log('[Sudoku Debug] Error detected! newErrorCount:', newErrorCount)
            }
        }

        const newGrid = [...grid]
        newGrid[selectedCell] = num
        setGrid(newGrid)
        addToHistory(newGrid)

        // Check if 3 errors reached (game over / elimination)
        if (newErrorCount >= 3) {
            setIsTimerRunning(false)

            // Handle BR elimination separately - no defeat screen, just mark as eliminated
            if (gameState.isBattleRoyale && gameState.id) {
                setIsEliminated(true)
                setMessage('💀 3 erreurs ! Tu es éliminé.')

                // Notify API of elimination
                try {
                    await fetch('/api/sudoku/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: user.username,
                            progress: newGrid.join(''),
                            time_seconds: timer,
                            errors: newErrorCount,
                            eliminated: true // Special flag for BR elimination
                        })
                    })
                } catch (err) {
                    console.error('Error syncing BR elimination:', err)
                }
                return
            }

            // 1v1 mode - the opponent wins
            setLossReason('errors')
            if ((gameState.host || gameState.challenger) && gameState.id) {
                const opponentName = opponentUsername || 'Adversaire'
                setGameState({ ...gameState, status: 'finished', winner: { username: opponentName } })
                setMessage(`❌ 3 erreurs ! ${opponentName} gagne !`)

                // Notify API of loss by errors
                try {
                    await fetch('/api/sudoku/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: user.username,
                            progress: newGrid.join(''),
                            time_seconds: timer,
                            errors: newErrorCount,
                            lost: true
                        })
                    })
                } catch (err) {
                    console.error('Error syncing loss:', err)
                }
            } else {
                // Solo mode - just show game over
                setGameState({ ...gameState, status: 'finished' })
                setMessage(`❌ 3 erreurs ! Partie terminée.`)
            }
            return
        }

        // Sync progress for 1v1 mode
        if ((gameState.host || gameState.challenger) && gameState.id) {
            const progressString = newGrid.join('')
            try {
                const res = await fetch('/api/sudoku/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: user.username,
                        progress: progressString,
                        time_seconds: timer,
                        errors: newErrorCount
                    })
                })
                const data = await res.json()

                // If this player won, set finished state immediately
                if (data.complete) {
                    setIsTimerRunning(false)
                    setWinningTime(data.time_seconds || timer)
                    setLossReason('completed')
                    setGameState({ ...gameState, status: 'finished', winner: { username: data.winner } })
                    setMessage(`Victoire ! ${data.winner} a gagné !`)
                    return // Don't run checkCompletion, we already handled it
                }

                // If opponent lost by errors
                if (data.opponentLost) {
                    setIsTimerRunning(false)
                    setLossReason('errors')
                    setGameState({ ...gameState, status: 'finished', winner: { username: user.username } })
                    setMessage(`🎉 L'adversaire a fait 3 erreurs ! Vous gagnez !`)
                    return
                }
            } catch (err) {
                console.error('Error syncing progress:', err)
            }
        }

        // Check if puzzle is complete
        checkCompletion(newGrid)
    }

    const checkCompletion = async (currentGrid: number[]) => {
        if (!gameState.solution) return

        // BR completion is handled by the update API, not here
        if (gameState.isBattleRoyale) return

        const isFilled = currentGrid.every(c => c !== 0)
        if (isFilled) {
            const gridStr = currentGrid.join('')
            if (gridStr === gameState.solution) {
                // Capture time FIRST before stopping
                const finalTime = timer
                setIsTimerRunning(false)
                setMessage(`Bravo ! Puzzle r\u00e9solu en ${formatTime(finalTime)}`)
                setGameState({ ...gameState, status: 'finished' })

                // Save solo game to database (skip for 1v1 - handled by update API)
                if (!gameState.challenger) {
                    try {
                        await fetch('/api/sudoku/complete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                difficulty,
                                time_seconds: finalTime,
                                username: user.username,
                                puzzle: originalPuzzle.join(''),
                                solution: gameState.solution
                            })
                        })
                    } catch (error) {
                        console.error('Failed to save game:', error)
                    }
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
        // Check if it's a 1v1 game by looking for challenger, not the mode state variable
        if (!opponentProgress || (!gameState.host && !gameState.challenger) || gameState.status !== 'playing') return null

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
                        const solutionGrid = gameState.solution ? gameState.solution.split('').map(Number) : []
                        const isCorrect = solutionGrid.length > 0 && value === solutionGrid[i] && value !== 0 && !isOriginal
                        const row = Math.floor(i / 9)
                        const col = i % 9
                        const isThickRight = col === 2 || col === 5
                        const isThickBottom = row === 2 || row === 5

                        // Color: gray for original, pink for CORRECT fills only, transparent for empty/wrong
                        let bgColor = 'var(--bg-base)'
                        if (isOriginal) bgColor = 'rgba(100, 100, 100, 0.3)'
                        else if (isCorrect) bgColor = 'var(--pink-accent)'

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
                    {(() => {
                        const solutionGrid = gameState.solution ? gameState.solution.split('').map(Number) : []
                        const cellsToFill = puzzleGrid.filter(v => v === 0).length
                        const cellsCorrect = opponentGrid.filter((v, i) => v !== 0 && puzzleGrid[i] === 0 && solutionGrid[i] === v).length
                        return cellsToFill > 0 ? Math.round((cellsCorrect / cellsToFill) * 100) : 0
                    })()}% complété
                </div>
            </div>
        )
    }

    // Render victory screen for 1v1 finished games
    const renderVictoryScreen = () => {
        if (gameState.status !== 'finished' || (!gameState.host && !gameState.challenger)) return null

        const isWinner = gameState.winner?.username?.toLowerCase() === user.username.toLowerCase()
        const winnerName = gameState.winner?.username || 'Inconnu'
        const solutionGrid = gameState.solution ? gameState.solution.split('').map(Number) : Array(81).fill(0)
        const puzzleGrid = originalPuzzle.length > 0 ? originalPuzzle : Array(81).fill(0)

        // My grid is the current grid, opponent grid is from opponentProgress
        const myGrid = grid
        const oppGrid = opponentProgress ? opponentProgress.split('').map(Number) : Array(81).fill(0)

        const renderMiniGrid = (gridData: number[], label: string, isWinnerGrid: boolean) => (
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: isWinnerGrid ? 'var(--pink-accent)' : 'var(--text-muted)',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                }}>
                    {label} {isWinnerGrid && <TrophyIcon size={14} />}
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(9, 1fr)',
                    gap: '1px',
                    width: '150px',
                    height: '150px',
                    background: 'var(--border-color)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    margin: '0 auto'
                }}>
                    {gridData.map((value, i) => {
                        const isOriginal = puzzleGrid[i] !== 0
                        const isCorrect = value === solutionGrid[i] && value !== 0
                        const isWrong = value !== 0 && value !== solutionGrid[i] && !isOriginal

                        let bgColor = 'var(--bg-base)'
                        if (isOriginal) bgColor = 'rgba(100, 100, 100, 0.2)'
                        else if (isCorrect) bgColor = 'rgba(34, 197, 94, 0.3)'
                        else if (isWrong) bgColor = 'rgba(239, 68, 68, 0.3)'

                        return (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: bgColor,
                                fontSize: '0.6rem',
                                fontWeight: isOriginal ? 600 : 400,
                                color: isOriginal ? 'var(--text-muted)' : 'var(--text-primary)'
                            }}>
                                {value || ''}
                            </div>
                        )
                    })}
                </div>
            </div>
        )

        const handleRematch = async () => {
            // Reset states and create new game
            setGameState({ status: 'idle' })
            setTimer(0)
            setErrorCount(0)
            setOpponentErrors(0)
            setLossReason(null)
            setHistory([])
            setHistoryIndex(-1)
            setGrid(Array(81).fill(0))
            setOriginalPuzzle([])
            setOpponentProgress('')
            setFinalGrids(null)
            setWinningTime(null)
            gameInitializedRef.current = false
            // Create new 1v1 session if authorized
            if (user.isAuthorized) {
                handleCreate1v1()
            }
        }

        const handleExit = () => {
            setGameState({ status: 'idle' })
            setTimer(0)
            setErrorCount(0)
            setOpponentErrors(0)
            setLossReason(null)
            setHistory([])
            setHistoryIndex(-1)
            setGrid(Array(81).fill(0))
            setOriginalPuzzle([])
            setOpponentProgress('')
            setFinalGrids(null)
            setWinningTime(null)
            gameInitializedRef.current = false
        }

        return (
            <div className="animate-slideIn" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '70vh'
            }}>
                <div className="glass-card" style={{
                    padding: '2.5rem',
                    maxWidth: '600px',
                    width: '100%',
                    textAlign: 'center'
                }}>
                    {/* Trophy or X animation based on result */}
                    <div style={{
                        animation: 'pulse 2s ease-in-out infinite',
                        color: isWinner ? 'var(--pink-accent)' : '#ef4444',
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        {isWinner ? (
                            <TrophyIcon size={64} />
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '64px', height: '64px' }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        )}
                    </div>

                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        background: isWinner
                            ? 'linear-gradient(135deg, var(--pink-accent), var(--pink-light))'
                            : 'linear-gradient(135deg, #ef4444, #f87171)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        {isWinner ? 'Victoire !' : 'Défaite'}
                    </h1>

                    <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <strong style={{ color: isWinner ? 'var(--pink-accent)' : '#ef4444' }}>{winnerName}</strong> a remporté la partie !
                    </p>

                    {/* Show loss reason if applicable */}
                    {lossReason === 'errors' && (
                        <p style={{ fontSize: '0.9rem', color: '#f97316', marginBottom: '1.5rem' }}>
                            {isWinner ? `L'adversaire a fait 3 erreurs` : `Vous avez fait 3 erreurs`}
                        </p>
                    )}

                    {/* Grid comparison */}
                    <div style={{
                        display: 'flex',
                        gap: '2rem',
                        justifyContent: 'center',
                        marginBottom: '2rem',
                        flexWrap: 'wrap'
                    }}>
                        {renderMiniGrid(
                            myGrid,
                            user.username || 'Vous',
                            gameState.winner?.username?.toLowerCase() === user.username.toLowerCase()
                        )}
                        {renderMiniGrid(
                            oppGrid,
                            opponentUsername || 'Adversaire',
                            gameState.winner?.username?.toLowerCase() === opponentUsername.toLowerCase()
                        )}
                    </div>

                    {/* Timer display */}
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Temps: {Math.floor((winningTime ?? timer) / 60)}:{((winningTime ?? timer) % 60).toString().padStart(2, '0')}
                    </p>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {user.isAuthorized && (
                            <FancyButton size="sm" onClick={handleRematch}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <SwordsIcon /> Revanche
                                </span>
                            </FancyButton>
                        )}
                        <button
                            onClick={handleExit}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Retour au menu
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                    }
                `}</style>
            </div>
        )
    }

    // Render number pad
    const renderNumberPad = () => {
        // Count how many times each digit appears in the grid
        const digitCounts: Record<number, number> = {}
        for (let i = 1; i <= 9; i++) digitCounts[i] = 0
        for (const value of grid) {
            if (value >= 1 && value <= 9) {
                digitCounts[value]++
            }
        }

        return (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                    const isComplete = digitCounts[num] >= 9
                    return (
                        <button
                            key={num}
                            onClick={() => handleNumberInput(num)}
                            disabled={isComplete}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                background: isComplete ? 'var(--bg-input)' : 'var(--bg-card)',
                                color: isComplete ? 'var(--text-success, #10b981)' : 'var(--text-primary)',
                                fontSize: '1.2rem',
                                fontWeight: 600,
                                cursor: isComplete ? 'default' : 'pointer',
                                opacity: isComplete ? 0.7 : 1,
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {isComplete ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : num}
                        </button>
                    )
                })}
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
    }

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
                        <span style={{
                            marginLeft: '0.75rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: errorCount >= 2 ? '#ef4444' : errorCount >= 1 ? '#f97316' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}>
                            ❌ {errorCount}/3
                        </span>
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
                            <button className={`btn ${mode === 'battle_royale' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => setMode('battle_royale')}>
                                <CrownIcon size={16} /> BR
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>Difficulté</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button style={getDifficultyButtonStyle('easy')} onClick={() => setDifficulty('easy')}>Facile</button>
                            <button style={getDifficultyButtonStyle('medium')} onClick={() => setDifficulty('medium')}>Moyen</button>
                            <button style={getDifficultyButtonStyle('hard')} onClick={() => setDifficulty('hard')}>Difficile</button>
                            <button style={getDifficultyButtonStyle('expert')} onClick={() => setDifficulty('expert')}>Expert</button>
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
                    ) : mode === '1v1' ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <FancyButton size="sm" onClick={handleCreate1v1} disabled={loading}>
                                {loading ? 'Chargement...' : 'Créer une session 1v1'}
                            </FancyButton>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <FancyButton size="sm" onClick={handleCreateBR} disabled={loading}>
                                {loading ? 'Chargement...' : <><PlayIcon size={16} /> Créer un Battle Royale</>}
                            </FancyButton>
                        </div>
                    )}

                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.85rem' }}>
                        Utilise le clavier (1-9) ou les flèches pour naviguer
                    </p>

                    {/* Lobbies List */}
                    {lobbies.length > 0 && (
                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <GamepadIcon /> Parties en attente ({lobbies.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {lobbies.map((lobby) => (
                                    <div
                                        key={lobby.id}
                                        style={{
                                            background: 'var(--bg-card)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                {lobby.isBattleRoyale ? <CrownIcon size={16} /> : <SwordsIcon />}
                                                <span style={{ fontWeight: 600 }}>
                                                    {lobby.isBattleRoyale ? 'Battle Royale' : '1v1'}
                                                </span>
                                                <span style={{
                                                    background: 'var(--pink-accent)',
                                                    color: 'white',
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {lobby.difficulty}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                Host: {lobby.host?.username || 'Anonyme'} • {lobby.playerCount} joueur{lobby.playerCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <FancyButton
                                            size="sm"
                                            onClick={() => handleJoinLobby(lobby.id, lobby.isBattleRoyale)}
                                            disabled={loading}
                                        >
                                            {lobby.isBattleRoyale ? "S'inscrire" : 'Rejoindre'}
                                        </FancyButton>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Waiting state - queue view
    if (gameState.status === 'waiting') {
        const isBR = gameState.isBattleRoyale || mode === 'battle_royale'

        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="glass-card" style={{ padding: '2.5rem', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', fontSize: '2rem' }}>
                        {isBR ? <CrownIcon size={28} /> : <SwordsIcon />}
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        {isBR ? 'Battle Royale' : 'Session 1v1'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Host: <span style={{ color: 'var(--pink-accent)', fontWeight: 600 }}>{gameState.host?.username || 'Anonyme'}</span>
                    </p>

                    <div style={{
                        background: 'var(--bg-base)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        marginBottom: '1.5rem',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <GamepadIcon /> {isBR ? `Joueurs inscrits (${gameState.brPlayers?.length || gameState.queue?.length || 1})` : `File d'attente (${gameState.queue?.length || 0})`}
                        </h3>

                        {/* Display players: brPlayers for BR mode, queue for 1v1 */}
                        {isBR ? (
                            // Battle Royale - show brPlayers
                            gameState.brPlayers && gameState.brPlayers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {gameState.brPlayers.map((p, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: 'var(--bg-card)',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}
                                        >
                                            <span style={{
                                                background: 'var(--pink-accent)',
                                                color: 'white',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                marginRight: '0.75rem'
                                            }}>
                                                {i + 1}
                                            </span>
                                            <span style={{ fontWeight: 500 }}>{p.username}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    En attente de joueurs...
                                </p>
                            )
                        ) : (
                            // 1v1 - show queue
                            gameState.queue && gameState.queue.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {gameState.queue.map((q, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.75rem 1rem',
                                                background: 'var(--bg-card)',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{
                                                    background: 'var(--pink-accent)',
                                                    color: 'white',
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    {i + 1}
                                                </span>
                                                <span style={{ fontWeight: 500 }}>{q.username}</span>
                                            </div>
                                            {gameState.host?.username?.toLowerCase() === user.username.toLowerCase() && (
                                                <button
                                                    onClick={() => handlePickUser(q.username)}
                                                    disabled={loading}
                                                    style={{
                                                        background: 'var(--pink-accent)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'opacity 0.2s'
                                                    }}
                                                >
                                                    Choisir
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    En attente de challengers...
                                </p>
                            )
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                        {gameState.host?.username?.toLowerCase() === user.username.toLowerCase() ? (
                            <>
                                {isBR ? (
                                    // BR mode: Start button (min 2 players)
                                    <FancyButton
                                        size="sm"
                                        onClick={handleStartBR}
                                        disabled={loading || (gameState.brPlayers?.length || 0) < 2}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <PlayIcon size={16} /> Lancer la partie ({gameState.brPlayers?.length || 1} joueurs)
                                        </span>
                                    </FancyButton>
                                ) : (
                                    // 1v1 mode: Pick random
                                    <FancyButton size="sm" onClick={handlePickRandom} disabled={loading || !gameState.queue?.length}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><DiceIcon /> Choisir au hasard</span>
                                    </FancyButton>
                                )}
                                <button
                                    onClick={handleCancelGame}
                                    disabled={loading}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--text-muted)',
                                        color: 'var(--text-muted)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Annuler la session
                                </button>
                            </>
                        ) : (
                            // Non-host
                            isBR ? (
                                // BR: user is already registered, show unregister button
                                <button
                                    onClick={handleUnregisterBR}
                                    disabled={loading}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--text-muted)',
                                        color: 'var(--text-muted)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {loading ? 'Chargement...' : 'Se désinscrire'}
                                </button>
                            ) : (
                                // 1v1: show join queue button
                                <FancyButton size="sm" onClick={handleJoinQueue} disabled={loading}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <GamepadIcon /> {loading ? 'Chargement...' : 'Rejoindre la file'}
                                    </span>
                                </FancyButton>
                            )
                        )}
                    </div>

                    {message && <p style={{ marginTop: '1rem', color: 'var(--pink-accent)', fontWeight: 500 }}>{message}</p>}
                </div>
            </div>
        )
    }

    // Victory screen for 1v1 finished games
    if (gameState.status === 'finished' && (gameState.host || gameState.challenger) && !gameState.isBattleRoyale) {
        return renderVictoryScreen()
    }

    // BR Game Finished Screen - show rankings
    if (brGameFinished || (gameState.isBattleRoyale && gameState.status === 'finished')) {
        // Sort players: finished by rank first, then eliminated, then playing
        const sortedPlayers = [...brPlayers].sort((a, b) => {
            if (a.status === 'finished' && b.status === 'finished') {
                return (a.finishRank || 999) - (b.finishRank || 999)
            }
            if (a.status === 'finished') return -1
            if (b.status === 'finished') return 1
            if (a.status === 'eliminated' && b.status === 'eliminated') {
                return (b.cellsFilled || 0) - (a.cellsFilled || 0)
            }
            return (b.cellsFilled || 0) - (a.cellsFilled || 0)
        })

        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', width: '100%' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <TrophyIcon size={32} /> Battle Royale Terminé
                    </h1>

                    {brWinner && (
                        <div style={{
                            background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            textAlign: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <p style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600 }}>
                                🏆 {brWinner} a gagné !
                            </p>
                        </div>
                    )}

                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Classement Final</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sortedPlayers.map((p, i) => (
                            <div
                                key={p.playerId}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0.75rem 1rem',
                                    background: p.username?.toLowerCase() === user.username.toLowerCase()
                                        ? 'var(--pink-accent)'
                                        : i === 0 && p.status === 'finished'
                                            ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
                                            : p.status === 'eliminated'
                                                ? 'rgba(255,0,0,0.1)'
                                                : 'var(--bg-card)',
                                    borderRadius: '10px',
                                    color: p.username?.toLowerCase() === user.username.toLowerCase() || (i === 0 && p.status === 'finished') ? 'white' : 'inherit'
                                }}
                            >
                                <span style={{ fontWeight: 700, width: '40px', fontSize: '1rem' }}>
                                    {p.status === 'finished' ? `#${p.finishRank}` : '-'}
                                </span>
                                <span style={{ flex: 1, fontWeight: 600, fontSize: '1rem' }}>
                                    {p.username}
                                </span>
                                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    {p.status === 'finished'
                                        ? formatTime(p.finishTime || 0)
                                        : p.status === 'eliminated'
                                            ? '❌ Éliminé'
                                            : 'En cours'}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                        <FancyButton size="sm" onClick={() => {
                            setGameState({ status: 'idle' })
                            setBrGameFinished(false)
                            setBrWinner(null)
                            setBrPlayers([])
                            setHasBRFinished(false)
                            setIsEliminated(false)
                            setMyBRRank(null)
                            gameInitializedRef.current = false
                        }}>
                            Nouvelle partie
                        </FancyButton>
                    </div>
                </div>
            </div>
        )
    }

    // Playing/Finished state - grid view (solo or still playing 1v1/BR)
    const isBRPlaying = gameState.isBattleRoyale && gameState.status === 'playing'

    return (
        <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: '700px', width: '100%' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {gameState.isBattleRoyale ? (
                        <><CrownIcon size={24} /> Battle Royale</>
                    ) : gameState.challenger ? (
                        `${gameState.host?.username} vs ${gameState.challenger?.username}`
                    ) : (
                        'Sudoku Solo'
                    )}
                </h1>

                {/* BR Eliminated overlay */}
                {isBRPlaying && isEliminated && (
                    <div style={{
                        background: 'rgba(0,0,0,0.8)',
                        borderRadius: '12px',
                        padding: '2rem',
                        textAlign: 'center',
                        marginBottom: '1rem'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', color: 'var(--pink-accent)', marginBottom: '0.5rem' }}>
                            Éliminé !
                        </h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Tu as fait 3 erreurs. La partie continue pour les autres joueurs.
                        </p>
                    </div>
                )}

                {/* BR Finished overlay */}
                {isBRPlaying && hasBRFinished && (
                    <div style={{
                        background: myBRRank === 1 ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : 'rgba(0,150,0,0.8)',
                        borderRadius: '12px',
                        padding: '2rem',
                        textAlign: 'center',
                        marginBottom: '1rem'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            {myBRRank === 1 ? <><TrophyIcon size={28} /> Victoire !</> : `Terminé #${myBRRank}`}
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {myBRRank === 1
                                ? 'Tu as terminé le puzzle en premier !'
                                : `Tu as terminé le puzzle en position ${myBRRank}.`
                            }
                        </p>
                    </div>
                )}

                {renderGameControls()}
                {renderGrid()}
                {gameState.status === 'playing' && !isEliminated && !hasBRFinished && renderNumberPad()}

                {message && <p style={{ textAlign: 'center', color: 'var(--pink-accent)', fontWeight: 600, marginTop: '1rem' }}>{message}</p>}

                {gameState.status === 'finished' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <FancyButton size="sm" onClick={() => { setGameState({ status: 'idle' }); setTimer(0); setHistory([]); setHistoryIndex(-1) }}>
                            Nouvelle partie
                        </FancyButton>
                    </div>
                )}

                {/* Cancel button during playing (not for BR - BR has its own buttons) */}
                {gameState.status === 'playing' && !isBRPlaying && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <button
                            onClick={() => {
                                if (gameState.challenger && user.isAuthorized) {
                                    // 1v1: Call API to cancel
                                    handleCancelGame()
                                } else {
                                    // Solo: Just reset local state
                                    setGameState({ status: 'idle' })
                                    setTimer(0)
                                    setIsTimerRunning(false)
                                    setHistory([])
                                    setHistoryIndex(-1)
                                    setGrid(Array(81).fill(0))
                                    setOriginalPuzzle([])
                                    gameInitializedRef.current = false
                                    setMessage('Partie annulée')
                                }
                            }}
                            disabled={loading}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--text-muted)',
                                color: 'var(--text-muted)',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            Annuler la partie
                        </button>
                    </div>
                )}

                {/* BR: Cancel (host) or Unregister (others) button */}
                {isBRPlaying && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        {gameState.host?.username?.toLowerCase() === user.username.toLowerCase() ? (
                            <button
                                onClick={handleCancelGame}
                                disabled={loading}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--text-muted)',
                                    color: 'var(--text-muted)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Annuler le Battle Royale
                            </button>
                        ) : !isEliminated && (
                            <button
                                onClick={handleUnregisterBR}
                                disabled={loading}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--text-muted)',
                                    color: 'var(--text-muted)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Abandonner
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* BR Leaderboard sidebar */}
            {isBRPlaying && brPlayers.length > 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', width: '280px', alignSelf: 'flex-start' }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <CrownIcon size={18} /> Classement
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(() => {
                            // Calculate how many cells need to be filled (empty in original puzzle)
                            const cellsToFill = gameState.puzzle
                                ? gameState.puzzle.split('').filter(c => c === '0').length
                                : 45 // Default assumption if puzzle not available

                            // Pre-filled cells = 81 - empty cells
                            const prefilledCells = 81 - cellsToFill

                            return brPlayers.slice(0, 10).map((p, i) => {
                                // cellsFilled from API includes pre-filled cells, subtract them
                                const userFilledCells = Math.max(0, p.cellsFilled - prefilledCells)
                                const percentage = cellsToFill > 0
                                    ? Math.min(100, Math.round((userFilledCells / cellsToFill) * 100))
                                    : 0

                                return (
                                    <div
                                        key={p.playerId}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.5rem 0.75rem',
                                            background: p.username?.toLowerCase() === user.username.toLowerCase()
                                                ? 'var(--pink-accent)'
                                                : p.status === 'eliminated'
                                                    ? 'rgba(255,0,0,0.1)'
                                                    : 'var(--bg-card)',
                                            borderRadius: '8px',
                                            opacity: p.status === 'eliminated' ? 0.6 : 1,
                                            color: p.username?.toLowerCase() === user.username.toLowerCase() ? 'white' : 'inherit'
                                        }}
                                    >
                                        <span style={{
                                            fontWeight: 700,
                                            width: '24px',
                                            fontSize: '0.85rem'
                                        }}>
                                            {i + 1}.
                                        </span>
                                        <span style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem' }}>
                                            {p.username}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                            {percentage}%
                                        </span>
                                        {p.status === 'eliminated' && (
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#ff6b6b' }}>✗</span>
                                        )}
                                    </div>
                                )
                            })
                        })()}
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {brPlayers.filter(p => p.status === 'playing').length} joueurs restants
                    </div>
                </div>
            )}

            {/* Opponent's mini grid for 1v1 */}
            {!gameState.isBattleRoyale && renderOpponentGrid()}
        </div>
    )
}
