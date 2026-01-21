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

    // Pause state (solo mode only)
    const [isPaused, setIsPaused] = useState(false)

    // Track last error to prevent counting same repeated error
    const lastErrorRef = useRef<{ cell: number; value: number } | null>(null)

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

    // Ghost / Time Attack Mode
    const [targetTime, setTargetTime] = useState<number | null>(null)
    const [targetUser, setTargetUser] = useState<string | null>(null)

    // GwenMode - Clean blue theme
    const [gwenMode, setGwenMode] = useState(false)
    // GwenMode difficulty change confirmation modal
    const [gwenDifficultyModal, setGwenDifficultyModal] = useState<{ show: boolean; targetDifficulty: Difficulty | null }>({ show: false, targetDifficulty: null })

    // Track completed rows/cols/boxes for animation
    const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())
    const [animatingSections, setAnimatingSections] = useState<Set<string>>(new Set())
    // Wave animation - stores cell index -> animation delay for "hola" effect
    const [waveAnimatingCells, setWaveAnimatingCells] = useState<Map<number, number>>(new Map())

    // GwenMode color palette (blue/white theme from screenshot)
    const gwenColors = {
        bgBase: '#f5f8fc',
        bgCell: '#ffffff',
        bgCellOriginal: '#e8eef5',
        bgSelected: '#4a6fa5',
        bgHighlight: '#d9e4f0',
        bgSameNumber: '#b8cde8',
        textPrimary: '#2c4a6e',
        textNumber: '#4a6fa5',
        textOriginal: '#1a365d',
        borderMain: '#2c4a6e',
        borderLight: '#c5d4e8',
        accent: '#4a6fa5',
        buttonBg: '#4a6fa5',
        buttonText: '#ffffff',
        panelBg: '#f8fafc'
    }

    // Flag to prevent grid reset when game is already initialized
    const gameInitializedRef = useRef(false)

    // Flag to temporarily skip status checks after unregistering
    const skipStatusCheckUntilRef = useRef<number>(0)

    // Flag to track if we're in a local solo game (not stored in DB)
    const isSoloPlayingRef = useRef(false)

    // Key bindings configuration
    type KeyBinding = {
        key: string
        ctrl?: boolean
        shift?: boolean
        alt?: boolean
    }

    interface KeyBindings {
        undo: KeyBinding
        redo: KeyBinding
        erase: KeyBinding[]
        pause: KeyBinding
        navUp: KeyBinding
        navDown: KeyBinding
        navLeft: KeyBinding
        navRight: KeyBinding
    }

    const defaultKeyBindings: KeyBindings = {
        undo: { key: 'z', ctrl: true },
        redo: { key: 'y', ctrl: true },
        erase: [{ key: 'Delete' }, { key: 'Backspace' }, { key: '0' }],
        pause: { key: 'p' },
        navUp: { key: 'ArrowUp' },
        navDown: { key: 'ArrowDown' },
        navLeft: { key: 'ArrowLeft' },
        navRight: { key: 'ArrowRight' }
    }

    const [keyBindings, setKeyBindings] = useState<KeyBindings>(defaultKeyBindings)
    const [showKeySettings, setShowKeySettings] = useState(false)
    const [editingAction, setEditingAction] = useState<keyof KeyBindings | null>(null)

    // Load key bindings from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('sudoku-key-bindings')
            if (saved) {
                const parsed = JSON.parse(saved)
                setKeyBindings({ ...defaultKeyBindings, ...parsed })
            }
        } catch (err) {
            console.error('Error loading key bindings:', err)
        }
    }, [])

    // Save key bindings to localStorage
    const saveKeyBindings = (newBindings: KeyBindings) => {
        setKeyBindings(newBindings)
        localStorage.setItem('sudoku-key-bindings', JSON.stringify(newBindings))
    }

    // Helper to check if a key event matches a binding
    const matchesBinding = (e: KeyboardEvent, binding: KeyBinding): boolean => {
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase() || e.key === binding.key
        const ctrlMatch = binding.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey
        const altMatch = binding.alt ? e.altKey : !e.altKey
        return keyMatch && ctrlMatch && shiftMatch && altMatch
    }

    // Helper to format binding for display
    const formatBinding = (binding: KeyBinding): string => {
        const parts: string[] = []
        if (binding.ctrl) parts.push('Ctrl')
        if (binding.shift) parts.push('Shift')
        if (binding.alt) parts.push('Alt')
        // Format special keys
        const keyDisplay = binding.key === 'ArrowUp' ? '↑' :
            binding.key === 'ArrowDown' ? '↓' :
                binding.key === 'ArrowLeft' ? '←' :
                    binding.key === 'ArrowRight' ? '→' :
                        binding.key === ' ' ? 'Space' :
                            binding.key.length === 1 ? binding.key.toUpperCase() : binding.key
        parts.push(keyDisplay)
        return parts.join('+')
    }

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

    // Timer effect - pauses when isPaused is true
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        if (isTimerRunning && !isPaused) {
            interval = setInterval(() => {
                setTimer(t => t + 1)
            }, 1000)
        }
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isTimerRunning, isPaused])

    // Auto-pause when user leaves the page (solo mode only)
    useEffect(() => {
        const handleVisibilityChange = () => {
            // Only auto-pause in solo mode (no challenger, not BR)
            if (document.hidden && gameState.status === 'playing' && !gameState.challenger && !gameState.isBattleRoyale) {
                setIsPaused(true)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [gameState.status, gameState.challenger, gameState.isBattleRoyale])

    // Keyboard input effect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Handle key settings mode first (capture any key for rebinding)
            if (editingAction !== null) {
                e.preventDefault()
                const newBinding: KeyBinding = {
                    key: e.key,
                    ctrl: e.ctrlKey || e.metaKey || undefined,
                    shift: e.shiftKey || undefined,
                    alt: e.altKey || undefined
                }
                // Clean up undefined/false modifiers
                if (!newBinding.ctrl) delete newBinding.ctrl
                if (!newBinding.shift) delete newBinding.shift
                if (!newBinding.alt) delete newBinding.alt

                const newBindings = { ...keyBindings }
                if (editingAction === 'erase') {
                    // For erase, replace all bindings with single new one
                    newBindings.erase = [newBinding]
                } else {
                    (newBindings[editingAction] as KeyBinding) = newBinding
                }
                saveKeyBindings(newBindings)
                setEditingAction(null)
                return
            }

            // Pause toggle (works even when game is paused)
            if (gameState.status === 'playing' && !gameState.challenger && !gameState.isBattleRoyale) {
                if (matchesBinding(e, keyBindings.pause)) {
                    e.preventDefault()
                    setIsPaused(p => !p)
                    return
                }
            }

            if (gameState.status !== 'playing' || selectedCell === null || isPaused) return

            const key = e.key
            const isOriginalCell = originalPuzzle[selectedCell] !== 0

            // Number keys 1-9 (only allowed on non-original cells, and if not eliminated/finished)
            if (key >= '1' && key <= '9') {
                if (isOriginalCell || isEliminated || hasBRFinished) return // Can't edit
                e.preventDefault()
                handleNumberInput(parseInt(key))
            }
            // Erase key(s) - configurable
            else if (keyBindings.erase.some(b => matchesBinding(e, b))) {
                if (isOriginalCell || isEliminated || hasBRFinished) return // Can't edit
                e.preventDefault()
                handleNumberInput(0)
            }
            // Navigation - configurable
            else if (matchesBinding(e, keyBindings.navUp) && selectedCell >= 9) {
                e.preventDefault()
                setSelectedCell(selectedCell - 9)
            }
            else if (matchesBinding(e, keyBindings.navDown) && selectedCell < 72) {
                e.preventDefault()
                setSelectedCell(selectedCell + 9)
            }
            else if (matchesBinding(e, keyBindings.navLeft) && selectedCell % 9 > 0) {
                e.preventDefault()
                setSelectedCell(selectedCell - 1)
            }
            else if (matchesBinding(e, keyBindings.navRight) && selectedCell % 9 < 8) {
                e.preventDefault()
                setSelectedCell(selectedCell + 1)
            }
            // Undo/Redo - configurable
            else if (matchesBinding(e, keyBindings.undo)) {
                e.preventDefault()
                handleUndo()
            }
            else if (matchesBinding(e, keyBindings.redo)) {
                e.preventDefault()
                handleRedo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [gameState.status, selectedCell, originalPuzzle, historyIndex, history, keyBindings, editingAction, isPaused])

    // Check for active game on load (wait for user to be loaded)
    // Check for active game on load (wait for user to be loaded)
    useEffect(() => {
        const initGame = async () => {
            if (!user.username) return

            // Check if we are loading a replay (Ghost/Challenge Mode)
            const searchParams = new URLSearchParams(window.location.search)
            const sourceId = searchParams.get('sourceId')

            if (sourceId && !gameInitializedRef.current) {
                setLoading(true)
                try {
                    const res = await fetch(`/api/sudoku/game/${sourceId}`)
                    const data = await res.json()

                    if (data.game) {
                        // Start solo game with this puzzle
                        setGameState({
                            status: 'playing',
                            puzzle: data.game.puzzle,
                            solution: data.game.solution
                        })
                        setTimer(0)
                        setHistory([])
                        setHistoryIndex(-1)
                        setIsTimerRunning(true)

                        const puzzleArray = data.game.puzzle.split('').map((c: string) => parseInt(c) || 0)
                        setGrid(puzzleArray)
                        setOriginalPuzzle(puzzleArray)

                        // Set ghost data
                        setTargetTime(data.game.targetTime)
                        setTargetUser(data.game.targetUser)
                        setMessage(`⚡ Défi temps vs ${data.game.targetUser} (${formatTime(data.game.targetTime)})`)

                        gameInitializedRef.current = true
                    }
                } catch (error) {
                    console.error('Error loading replay:', error)
                } finally {
                    setLoading(false)
                }
            } else {
                checkGameStatus()
            }
        }

        initGame()
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
                // No active game for user in DB - show idle with lobbies
                // BUT preserve local solo games (use ref to avoid stale state in callback)
                if (gameState.status !== 'finished' && !isSoloPlayingRef.current) {
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
                // Mark as solo game to prevent checkGameStatus from resetting it
                isSoloPlayingRef.current = true
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
                body: JSON.stringify({ username: user.username, gameId: gameState.id })
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
        if (isPaused) return // Don't allow clicks when paused
        setSelectedCell(index)
        // Focus the grid for keyboard input
        gridRef.current?.focus()
    }

    const handleNumberInput = async (num: number) => {
        console.log('[Sudoku Debug] *** handleNumberInput called ***', { num, selectedCell, hasSolution: !!gameState.solution })
        if (isPaused) return // Don't allow inputs when paused
        if (selectedCell === null) return
        if (originalPuzzle[selectedCell] !== 0) return // Can't edit original cells
        if (gameState.status === 'finished') return // Game already ended

        // TOGGLE: If same number is entered, clear the cell
        if (num !== 0 && grid[selectedCell] === num) {
            const newGrid = [...grid]
            newGrid[selectedCell] = 0
            setGrid(newGrid)
            addToHistory(newGrid)
            console.log('[Sudoku] Same number toggled off, cell cleared')
            return
        }

        const solution = gameState.solution

        // PROTECTION 1: Don't allow modifying a cell that already has the correct value
        if (solution && grid[selectedCell] !== 0) {
            const currentValue = grid[selectedCell]
            const correctValue = parseInt(solution[selectedCell])
            if (currentValue === correctValue && num !== 0) {
                // Cell already has correct value, don't allow changing it
                console.log('[Sudoku] Cell already correct, ignoring input')
                return
            }
        }

        // PROTECTION 2: Don't allow placing a digit if all 9 occurrences are already on the grid
        if (num !== 0) {
            const digitCount = grid.filter(v => v === num).length
            if (digitCount >= 9) {
                console.log('[Sudoku] All 9 occurrences of', num, 'already placed, ignoring')
                return
            }
        }

        // Check if this is an error (wrong number placed)
        let isError = false
        let newErrorCount = errorCount

        console.log('[Sudoku Debug] handleNumberInput - solution:', solution ? 'available' : 'MISSING', 'num:', num, 'selectedCell:', selectedCell)

        if (num !== 0 && solution) {
            const correctValue = parseInt(solution[selectedCell])
            console.log('[Sudoku Debug] Checking error - correctValue:', correctValue, 'entered:', num, 'isError:', num !== correctValue)
            if (num !== correctValue) {
                isError = true

                // PROTECTION 3: Only count one error for repeated mistakes on same cell with same value
                const isSameError = lastErrorRef.current?.cell === selectedCell && lastErrorRef.current?.value === num
                if (!isSameError) {
                    newErrorCount = errorCount + 1
                    setErrorCount(newErrorCount)
                    lastErrorRef.current = { cell: selectedCell, value: num }
                    console.log('[Sudoku Debug] Error detected! newErrorCount:', newErrorCount)
                } else {
                    console.log('[Sudoku Debug] Same error repeated, not counting again')
                }
            } else {
                // Correct value placed, reset last error tracking
                lastErrorRef.current = null
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

    // Check if a row/column/box is completely and correctly filled
    const checkCompletedSections = useCallback(() => {
        if (!gameState.solution || !gwenMode) return

        const solution = gameState.solution.split('').map(Number)
        const newCompleted = new Set<string>()
        const newAnimating = new Set<string>()
        const waveCells = new Map<number, number>() // cell index -> delay in ms

        // Helper to get cells in a section with their wave order
        const getCellsForSection = (sectionKey: string): number[] => {
            if (sectionKey.startsWith('row-')) {
                const row = parseInt(sectionKey.split('-')[1])
                return Array.from({ length: 9 }, (_, col) => row * 9 + col)
            } else if (sectionKey.startsWith('col-')) {
                const col = parseInt(sectionKey.split('-')[1])
                return Array.from({ length: 9 }, (_, row) => row * 9 + col)
            } else if (sectionKey.startsWith('box-')) {
                const [boxRow, boxCol] = sectionKey.split('-').slice(1).map(Number)
                const cells: number[] = []
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        cells.push((boxRow * 3 + r) * 9 + (boxCol * 3 + c))
                    }
                }
                return cells
            }
            return []
        }

        // Check rows
        for (let row = 0; row < 9; row++) {
            let isComplete = true
            for (let col = 0; col < 9; col++) {
                const idx = row * 9 + col
                if (grid[idx] !== solution[idx]) {
                    isComplete = false
                    break
                }
            }
            if (isComplete) {
                const key = `row-${row}`
                newCompleted.add(key)
                if (!completedSections.has(key)) {
                    newAnimating.add(key)
                    getCellsForSection(key).forEach((cellIdx, i) => {
                        waveCells.set(cellIdx, i * 50)
                    })
                }
            }
        }

        // Check columns
        for (let col = 0; col < 9; col++) {
            let isComplete = true
            for (let row = 0; row < 9; row++) {
                const idx = row * 9 + col
                if (grid[idx] !== solution[idx]) {
                    isComplete = false
                    break
                }
            }
            if (isComplete) {
                const key = `col-${col}`
                newCompleted.add(key)
                if (!completedSections.has(key)) {
                    newAnimating.add(key)
                    getCellsForSection(key).forEach((cellIdx, i) => {
                        if (!waveCells.has(cellIdx)) {
                            waveCells.set(cellIdx, i * 50)
                        }
                    })
                }
            }
        }

        // Check 3x3 boxes
        for (let boxRow = 0; boxRow < 3; boxRow++) {
            for (let boxCol = 0; boxCol < 3; boxCol++) {
                let isComplete = true
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const idx = (boxRow * 3 + r) * 9 + (boxCol * 3 + c)
                        if (grid[idx] !== solution[idx]) {
                            isComplete = false
                            break
                        }
                    }
                    if (!isComplete) break
                }
                if (isComplete) {
                    const key = `box-${boxRow}-${boxCol}`
                    newCompleted.add(key)
                    if (!completedSections.has(key)) {
                        newAnimating.add(key)
                        getCellsForSection(key).forEach((cellIdx, i) => {
                            if (!waveCells.has(cellIdx)) {
                                waveCells.set(cellIdx, i * 50)
                            }
                        })
                    }
                }
            }
        }

        setCompletedSections(newCompleted)

        // Trigger wave animation
        if (waveCells.size > 0) {
            setAnimatingSections(newAnimating)
            setWaveAnimatingCells(waveCells)
            setTimeout(() => {
                setAnimatingSections(new Set())
                setWaveAnimatingCells(new Map())
            }, 9 * 50 + 350)
        }
    }, [grid, gameState.solution, gwenMode, completedSections])

    // Check completed sections whenever grid changes
    useEffect(() => {
        if (gwenMode && gameState.status === 'playing') {
            checkCompletedSections()
        }
    }, [grid, gwenMode, gameState.status, checkCompletedSections])

    // Helper to check if a cell is in a completed/animating section
    const getCellSectionState = (index: number) => {
        const row = Math.floor(index / 9)
        const col = index % 9
        const boxRow = Math.floor(row / 3)
        const boxCol = Math.floor(col / 3)

        const inCompletedRow = completedSections.has(`row-${row}`)
        const inCompletedCol = completedSections.has(`col-${col}`)
        const inCompletedBox = completedSections.has(`box-${boxRow}-${boxCol}`)

        const isAnimating =
            animatingSections.has(`row-${row}`) ||
            animatingSections.has(`col-${col}`) ||
            animatingSections.has(`box-${boxRow}-${boxCol}`)

        return {
            isCompleted: inCompletedRow || inCompletedCol || inCompletedBox,
            isAnimating
        }
    }

    // Render Sudoku grid
    const renderGrid = () => (
        <div style={{ position: 'relative' }}>
            {/* Pause overlay - solo mode only */}
            {isPaused && !gameState.challenger && !gameState.isBattleRoyale && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.9)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    gap: '1rem'
                }}>
                    <div style={{ fontSize: '3rem' }}>⏸️</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>Jeu en pause</div>
                    <button
                        onClick={() => setIsPaused(false)}
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem 2rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--pink-accent)',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        ▶️ Reprendre
                    </button>
                </div>
            )}
            <div
                ref={gridRef}
                tabIndex={0}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(9, 1fr)',
                    gap: '2px',
                    background: gwenMode ? gwenColors.borderLight : 'var(--border-color)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    width: '100%',
                    maxWidth: '540px',
                    margin: '0 auto 1rem',
                    boxShadow: gwenMode ? '0 4px 20px rgba(44, 74, 110, 0.15)' : '0 4px 20px rgba(0,0,0,0.1)',
                    outline: 'none',
                    filter: isPaused && !gameState.challenger && !gameState.isBattleRoyale ? 'blur(10px)' : 'none'
                }}>
                {grid.map((value, i) => {
                    const isOriginal = originalPuzzle[i] !== 0
                    const isSelected = selectedCell === i
                    const row = Math.floor(i / 9)
                    const col = i % 9
                    const isThickRight = col === 2 || col === 5
                    const isThickBottom = row === 2 || row === 5
                    const { isHighlighted, isSameNumber, isConflictingWithSelected } = getCellHighlight(i, value)

                    // Check if cell has wrong value (compare against solution, not just conflicts)
                    const hasConflictError = !isOriginal && hasConflict(i, value)
                    const isWrongValue = !isOriginal && value !== 0 && gameState.solution && parseInt(gameState.solution[i]) !== value
                    const isError = hasConflictError || isWrongValue

                    // GwenMode: check if cell is in completed section and get wave delay
                    const { isCompleted: inCompletedSection, isAnimating: isAnimatingSection } = gwenMode ? getCellSectionState(i) : { isCompleted: false, isAnimating: false }
                    const waveDelay = waveAnimatingCells.get(i)
                    const isWaveAnimating = waveDelay !== undefined

                    // Background color logic - GwenMode vs Normal
                    let bgColor: string
                    let textColor: string

                    if (gwenMode) {
                        // GwenMode colors (blue/white theme)
                        // Background - no green flash, just normal colors
                        if (isSelected && isError) bgColor = 'rgba(239, 68, 68, 0.4)'
                        else if (isSelected) bgColor = gwenColors.bgSelected
                        else if (isConflictingWithSelected) bgColor = 'rgba(239, 68, 68, 0.25)'
                        else if (isError) bgColor = 'rgba(239, 68, 68, 0.2)'
                        else if (isSameNumber) bgColor = gwenColors.bgSameNumber
                        else if (isHighlighted) bgColor = gwenColors.bgHighlight
                        else if (isOriginal) bgColor = gwenColors.bgCellOriginal
                        else bgColor = gwenColors.bgCell

                        // Text color
                        if (isSelected && isError) textColor = 'white'
                        else if (isSelected) textColor = 'white'
                        else if (isConflictingWithSelected || isError) textColor = '#dc2626'
                        else if (isSameNumber) textColor = gwenColors.accent
                        else if (isOriginal) textColor = gwenColors.textOriginal
                        else textColor = gwenColors.textNumber
                    } else {
                        // Normal mode colors (pink theme)
                        if (isSelected && isError) bgColor = 'rgba(239, 68, 68, 0.4)'
                        else if (isSelected) bgColor = 'var(--pink-accent)'
                        else if (isConflictingWithSelected) bgColor = 'rgba(239, 68, 68, 0.25)'
                        else if (isError) bgColor = 'rgba(239, 68, 68, 0.2)'
                        else if (isSameNumber) bgColor = 'rgba(236, 72, 153, 0.3)'
                        else if (isHighlighted) bgColor = 'rgba(236, 72, 153, 0.1)'
                        else if (isOriginal) bgColor = 'var(--bg-card)'
                        else bgColor = 'var(--bg-base)'

                        // Text color
                        if (isSelected && isError) textColor = 'white'
                        else if (isSelected) textColor = 'white'
                        else if (isConflictingWithSelected || isError) textColor = '#dc2626'
                        else if (isSameNumber) textColor = 'var(--pink-accent)'
                        else if (isOriginal) textColor = 'var(--text-primary)'
                        else textColor = 'var(--pink-accent)'
                    }

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
                                borderRight: isThickRight ? `3px solid ${gwenMode ? gwenColors.borderMain : 'var(--text-primary)'}` : undefined,
                                borderBottom: isThickBottom ? `3px solid ${gwenMode ? gwenColors.borderMain : 'var(--text-primary)'}` : undefined,
                                transition: 'background 0.15s ease',
                                animation: isWaveAnimating ? 'cellPop 0.3s ease-out forwards' : 'none',
                                animationDelay: isWaveAnimating ? `${waveDelay}ms` : '0ms',
                                // Cells with thick borders need higher z-index to appear above gap
                                position: (isThickRight || isThickBottom) ? 'relative' : undefined,
                                zIndex: (isThickRight || isThickBottom) ? 1 : undefined
                            }}
                        >
                            {value || ''}
                        </div>
                    )
                })}
            </div>
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
                    @keyframes cellPop {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.15); }
                        100% { transform: scale(1); }
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

    // Render GwenMode layout - side-by-side with control panel (matching reference image)
    const renderGwenModeLayout = () => {
        const digitCounts: Record<number, number> = {}
        for (let i = 1; i <= 9; i++) digitCounts[i] = 0
        for (const value of grid) {
            if (value >= 1 && value <= 9) {
                digitCounts[value]++
            }
        }

        const gwenDifficulties: Array<{ key: Difficulty; label: string }> = [
            { key: 'easy', label: 'Facile' },
            { key: 'medium', label: 'Moyen' },
            { key: 'hard', label: 'Difficile' },
            { key: 'expert', label: 'Expert' }
        ]

        // Handle difficulty button click - show modal if different from current
        const handleDifficultyClick = (targetDiff: Difficulty) => {
            if (targetDiff !== difficulty) {
                setGwenDifficultyModal({ show: true, targetDifficulty: targetDiff })
            }
        }

        // GwenMode Undo icon
        const UndoIcon = () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
        )

        // GwenMode Erase icon
        const EraseIcon = () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" />
                <path d="m5 11 9 9" />
            </svg>
        )

        return (
            <div className="animate-slideIn" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: gwenColors.bgBase,
                minHeight: '100vh'
            }}>
                {/* Key Settings Modal */}
                {renderKeySettingsModal()}

                {/* CSS Keyframes */}
                <style>{`
                    @keyframes cellPop {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.15); }
                        100% { transform: scale(1); }
                    }
                `}</style>

                {/* Difficulty Selector with Settings Button */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    marginBottom: '0.5rem'
                }}>
                    <span style={{
                        color: gwenColors.textPrimary,
                        fontSize: '0.9rem',
                        fontWeight: 500
                    }}>
                        Difficulté :
                    </span>
                    {gwenDifficulties.map(d => (
                        <button
                            key={d.key}
                            onClick={() => handleDifficultyClick(d.key)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: difficulty === d.key ? gwenColors.accent : gwenColors.textPrimary,
                                fontWeight: difficulty === d.key ? 700 : 400,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                padding: '0.25rem 0',
                                borderBottom: difficulty === d.key ? `2px solid ${gwenColors.accent}` : '2px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            {d.label}
                        </button>
                    ))}

                    {/* Settings button */}
                    <button
                        onClick={() => setShowKeySettings(true)}
                        title="Configuration des touches"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            padding: '0.25rem',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                    >
                        ⚙️
                    </button>
                </div>

                {/* Difficulty change confirmation modal */}
                {gwenDifficultyModal.show && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            maxWidth: '400px',
                            textAlign: 'center',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                        }}>
                            <h3 style={{ margin: '0 0 1rem', color: gwenColors.textPrimary }}>
                                Changer de difficulté ?
                            </h3>
                            <p style={{ margin: '0 0 1.5rem', color: gwenColors.textPrimary, opacity: 0.8 }}>
                                Ta progression actuelle sera perdue si tu commences une nouvelle partie.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setGwenDifficultyModal({ show: false, targetDifficulty: null })}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        border: `1px solid ${gwenColors.borderLight}`,
                                        background: 'white',
                                        color: gwenColors.textPrimary,
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        if (gwenDifficultyModal.targetDifficulty) {
                                            isSoloPlayingRef.current = false
                                            setDifficulty(gwenDifficultyModal.targetDifficulty)
                                            setGwenDifficultyModal({ show: false, targetDifficulty: null })
                                            setGameState({ status: 'idle' })
                                            setTimer(0)
                                            setIsTimerRunning(false)
                                            setHistory([])
                                            setHistoryIndex(-1)
                                            setGrid(Array(81).fill(0))
                                            setOriginalPuzzle([])
                                            setErrorCount(0)
                                            gameInitializedRef.current = false
                                            // Start new game with new difficulty after state updates
                                            setTimeout(() => handleStartSolo(), 100)
                                        }
                                    }}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: gwenColors.buttonBg,
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content - Side by Side */}
                <div style={{
                    display: 'flex',
                    gap: '2rem',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }}>
                    {/* Left: Sudoku Grid */}
                    <div style={{ position: 'relative' }}>
                        {/* Pause overlay */}
                        {isPaused && !gameState.challenger && !gameState.isBattleRoyale && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(44, 74, 110, 0.95)',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                                gap: '1rem'
                            }}>
                                <div style={{ fontSize: '2rem', color: 'white' }}>⏸️</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>Jeu en pause</div>
                                <button
                                    onClick={() => setIsPaused(false)}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem 1.5rem',
                                        borderRadius: '20px',
                                        border: 'none',
                                        background: gwenColors.accent,
                                        color: 'white',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ▶️ Reprendre
                                </button>
                            </div>
                        )}

                        {/* Grid */}
                        <div
                            ref={gridRef}
                            tabIndex={0}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(9, 1fr)',
                                gap: '1px',
                                background: gwenColors.borderLight,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                width: '450px',
                                boxShadow: '0 2px 10px rgba(44, 74, 110, 0.1)',
                                outline: 'none',
                                filter: isPaused && !gameState.challenger && !gameState.isBattleRoyale ? 'blur(8px)' : 'none'
                            }}>
                            {grid.map((value, i) => {
                                const isOriginal = originalPuzzle[i] !== 0
                                const isSelected = selectedCell === i
                                const row = Math.floor(i / 9)
                                const col = i % 9
                                const isThickRight = col === 2 || col === 5
                                const isThickBottom = row === 2 || row === 5
                                const { isHighlighted, isSameNumber, isConflictingWithSelected } = getCellHighlight(i, value)

                                const hasConflictError = !isOriginal && hasConflict(i, value)
                                const isWrongValue = !isOriginal && value !== 0 && gameState.solution && parseInt(gameState.solution[i]) !== value
                                const isError = hasConflictError || isWrongValue

                                const waveDelay = waveAnimatingCells.get(i)
                                const isWaveAnimating = waveDelay !== undefined

                                let bgColor: string
                                let textColor: string

                                if (isSelected && isError) {
                                    bgColor = 'rgba(239, 68, 68, 0.4)'
                                    textColor = '#dc2626'
                                } else if (isSelected) {
                                    bgColor = gwenColors.bgSelected
                                    textColor = 'white'
                                } else if (isConflictingWithSelected) {
                                    bgColor = 'rgba(239, 68, 68, 0.15)'
                                    textColor = '#dc2626'
                                } else if (isError) {
                                    bgColor = 'rgba(239, 68, 68, 0.1)'
                                    textColor = '#dc2626'
                                } else if (isSameNumber) {
                                    bgColor = gwenColors.bgSameNumber
                                    textColor = gwenColors.accent
                                } else if (isHighlighted) {
                                    bgColor = gwenColors.bgHighlight
                                    textColor = isOriginal ? gwenColors.textOriginal : gwenColors.textNumber
                                } else if (isOriginal) {
                                    bgColor = gwenColors.bgCellOriginal
                                    textColor = gwenColors.textOriginal
                                } else {
                                    bgColor = gwenColors.bgCell
                                    textColor = gwenColors.textNumber
                                }

                                return (
                                    <div
                                        key={i}
                                        onClick={() => handleCellClick(i)}
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: bgColor,
                                            color: textColor,
                                            fontWeight: isOriginal ? 600 : 400,
                                            fontSize: '1.5rem',
                                            cursor: 'pointer',
                                            borderRight: isThickRight ? `2px solid ${gwenColors.borderMain}` : undefined,
                                            borderBottom: isThickBottom ? `2px solid ${gwenColors.borderMain}` : undefined,
                                            transition: 'background 0.15s ease',
                                            animation: isWaveAnimating ? 'cellPop 0.3s ease-out forwards' : 'none',
                                            animationDelay: isWaveAnimating ? `${waveDelay}ms` : '0ms',
                                            // Cells with thick borders need higher z-index to appear above gap
                                            position: (isThickRight || isThickBottom) ? 'relative' : undefined,
                                            zIndex: (isThickRight || isThickBottom) ? 1 : undefined
                                        }}
                                    >
                                        {value || ''}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Control Panel */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        width: '280px',
                        background: gwenColors.panelBg,
                        borderRadius: '12px',
                        padding: '1.5rem'
                    }}>
                        {/* Score Display */}
                        <div style={{
                            textAlign: 'center',
                            fontSize: '2.5rem',
                            fontWeight: 700,
                            color: gwenColors.textPrimary
                        }}>
                            {calculateProgress()}
                        </div>

                        {/* Info Row: Mistakes & Time */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0',
                            borderBottom: `1px solid ${gwenColors.borderLight}`
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: gwenColors.textPrimary, opacity: 0.7 }}>Erreurs</div>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: errorCount >= 2 ? '#dc2626' : gwenColors.textPrimary
                                }}>
                                    {errorCount}/3
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: gwenColors.textPrimary, opacity: 0.7 }}>Temps</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 600, color: gwenColors.textPrimary }}>
                                        {formatTime(timer)}
                                    </div>
                                </div>
                                {!gameState.challenger && !gameState.isBattleRoyale && gameState.status === 'playing' && (
                                    <button
                                        onClick={() => setIsPaused(!isPaused)}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            border: `1px solid ${gwenColors.borderLight}`,
                                            background: isPaused ? gwenColors.accent : 'white',
                                            color: isPaused ? 'white' : gwenColors.textPrimary,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {isPaused ? '▶' : '⏸'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '1rem'
                        }}>
                            {/* Undo */}
                            <button
                                onClick={handleUndo}
                                disabled={historyIndex <= 0 || isPaused}
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    border: `1px solid ${gwenColors.borderLight}`,
                                    background: 'white',
                                    color: historyIndex <= 0 || isPaused ? gwenColors.borderLight : gwenColors.accent,
                                    cursor: historyIndex <= 0 || isPaused ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Undo"
                            >
                                <UndoIcon />
                            </button>

                            {/* Erase */}
                            <button
                                onClick={() => handleNumberInput(0)}
                                disabled={isPaused}
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    border: `1px solid ${gwenColors.borderLight}`,
                                    background: 'white',
                                    color: isPaused ? gwenColors.borderLight : gwenColors.accent,
                                    cursor: isPaused ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Erase"
                            >
                                <EraseIcon />
                            </button>
                        </div>

                        {/* Number Pad - 3x3 Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.5rem',
                            marginTop: '0.5rem'
                        }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                                const isComplete = digitCounts[num] >= 9
                                return (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberInput(num)}
                                        disabled={isComplete || isPaused}
                                        style={{
                                            height: '60px',
                                            borderRadius: '8px',
                                            border: `1px solid ${gwenColors.borderLight}`,
                                            background: isComplete ? gwenColors.bgHighlight : 'white',
                                            color: isComplete ? gwenColors.borderLight : gwenColors.accent,
                                            fontSize: '1.5rem',
                                            fontWeight: 500,
                                            cursor: isComplete || isPaused ? 'not-allowed' : 'pointer',
                                            opacity: isComplete ? 0.6 : 1,
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        {num}
                                    </button>
                                )
                            })}
                        </div>

                        {/* New Game Button */}
                        <button
                            onClick={() => {
                                isSoloPlayingRef.current = false
                                setGameState({ status: 'idle' })
                                setTimer(0)
                                setIsTimerRunning(false)
                                setHistory([])
                                setHistoryIndex(-1)
                                setGrid(Array(81).fill(0))
                                setOriginalPuzzle([])
                                setErrorCount(0)
                                gameInitializedRef.current = false
                                handleStartSolo()
                            }}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: gwenColors.buttonBg,
                                color: gwenColors.buttonText,
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginTop: '0.5rem'
                            }}
                        >
                            Nouvelle partie
                        </button>

                        {/* GwenMode Toggle (to exit) */}
                        <button
                            onClick={() => setGwenMode(false)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                border: `1px solid ${gwenColors.borderLight}`,
                                background: 'transparent',
                                color: gwenColors.textPrimary,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                opacity: 0.7
                            }}
                        >
                            Quitter GwenMode
                        </button>
                    </div>
                </div>
            </div >
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
                        {/* Pause button - solo mode only */}
                        {!gameState.challenger && !gameState.isBattleRoyale && gameState.status === 'playing' && (
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                style={{
                                    marginLeft: '0.5rem',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: isPaused ? 'var(--pink-accent)' : 'var(--bg-card)',
                                    color: isPaused ? 'white' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                {isPaused ? '▶️' : '⏸️'}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0 || isPaused}
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: historyIndex <= 0 || isPaused ? 'var(--bg-input)' : 'var(--bg-card)',
                                color: historyIndex <= 0 || isPaused ? 'var(--text-muted)' : 'var(--text-primary)',
                                cursor: historyIndex <= 0 || isPaused ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1 || isPaused}
                            style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: historyIndex >= history.length - 1 || isPaused ? 'var(--bg-input)' : 'var(--bg-card)',
                                color: historyIndex >= history.length - 1 || isPaused ? 'var(--text-muted)' : 'var(--text-primary)',
                                cursor: historyIndex >= history.length - 1 || isPaused ? 'not-allowed' : 'pointer',
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

    // Key Settings Modal
    const renderKeySettingsModal = () => {
        if (!showKeySettings) return null

        const actionLabels: Record<keyof KeyBindings, string> = {
            undo: 'Annuler',
            redo: 'Rétablir',
            erase: 'Effacer',
            pause: 'Pause',
            navUp: 'Haut',
            navDown: 'Bas',
            navLeft: 'Gauche',
            navRight: 'Droite'
        }

        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }} onClick={() => { setShowKeySettings(false); setEditingAction(null) }}>
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '400px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        background: 'var(--bg-card)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                    }}
                >
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⚙️ Configuration des touches
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {(Object.keys(keyBindings) as (keyof KeyBindings)[]).map(action => {
                            const binding = keyBindings[action]
                            const isEditing = editingAction === action

                            return (
                                <div key={action} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.5rem 0.75rem',
                                    background: isEditing ? 'var(--pink-accent)' : 'var(--bg-base)',
                                    borderRadius: '8px',
                                    transition: 'background 0.2s'
                                }}>
                                    <span style={{ fontWeight: 500, color: isEditing ? 'white' : 'var(--text-primary)' }}>
                                        {actionLabels[action]}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            background: isEditing ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                                            borderRadius: '4px',
                                            fontSize: '0.875rem',
                                            fontFamily: 'monospace',
                                            color: isEditing ? 'white' : 'var(--text-secondary)'
                                        }}>
                                            {isEditing ? 'Appuyer...' :
                                                Array.isArray(binding) ? binding.map(b => formatBinding(b)).join(' / ') : formatBinding(binding)}
                                        </span>
                                        <button
                                            onClick={() => setEditingAction(isEditing ? null : action)}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                background: isEditing ? 'white' : 'var(--pink-accent)',
                                                color: isEditing ? 'var(--pink-accent)' : 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isEditing ? 'Annuler' : 'Modifier'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                        <button
                            onClick={() => {
                                saveKeyBindings(defaultKeyBindings)
                                setEditingAction(null)
                            }}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                background: 'var(--bg-base)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Réinitialiser
                        </button>
                        <button
                            onClick={() => { setShowKeySettings(false); setEditingAction(null) }}
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                background: 'var(--pink-accent)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Use GwenMode layout for solo games when gwenMode is active
    if (gwenMode && gameState.status === 'playing' && !gameState.challenger && !gameState.isBattleRoyale) {
        return renderGwenModeLayout()
    }

    return (
        <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Key Settings Modal */}
            {renderKeySettingsModal()}

            {/* CSS Keyframes for wave animation */}
            <style>{`
                @keyframes cellPop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1); }
                }
            `}</style>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: '700px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', position: 'relative' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
                        {gameState.isBattleRoyale ? (
                            <><CrownIcon size={24} /> Battle Royale</>
                        ) : gameState.challenger ? (
                            `${gameState.host?.username} vs ${gameState.challenger?.username}`
                        ) : (
                            'Sudoku Solo'
                        )}
                    </h1>
                    {/* Settings button - only show in solo mode */}
                    {!gameState.challenger && !gameState.isBattleRoyale && (
                        <button
                            onClick={() => setShowKeySettings(true)}
                            title="Configuration des touches"
                            style={{
                                position: 'absolute',
                                right: 0,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1.25rem',
                                opacity: 0.7,
                                transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        >
                            ⚙️
                        </button>
                    )}
                </div>

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

                {/* Live Timer & Ghost UI */}
                {gameState.status === 'playing' && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '1.5rem',
                        marginBottom: '1rem',
                        background: 'var(--bg-card)',
                        padding: '0.5rem 1.5rem',
                        borderRadius: '20px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                            {formatTime(timer)}
                        </div>

                        {/* Ghost Mode UI */}
                        {targetTime !== null && targetUser && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                borderLeft: '1px solid var(--border-color)',
                                paddingLeft: '1.5rem'
                            }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    vs {targetUser}:
                                </span>
                                <span style={{
                                    fontWeight: 700,
                                    color: timer < targetTime ? '#22c55e' : '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}>
                                    {timer < targetTime ? '-' : '+'}{formatTime(Math.abs(timer - targetTime))}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    (Cible: {formatTime(targetTime)})
                                </span>
                            </div>
                        )}

                        {/* GwenMode Toggle */}
                        <button
                            onClick={() => setGwenMode(!gwenMode)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '12px',
                                border: `2px solid ${gwenMode ? gwenColors.accent : 'var(--border-color)'}`,
                                background: gwenMode ? gwenColors.bgHighlight : 'transparent',
                                color: gwenMode ? gwenColors.textPrimary : 'var(--text-muted)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginLeft: 'auto'
                            }}
                            title="Activer/Désactiver GwenMode"
                        >
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: gwenMode ? gwenColors.accent : 'var(--text-muted)'
                            }} />
                            GwenMode
                        </button>
                    </div>
                )}

                {renderGrid()}
                {gameState.status === 'playing' && !isEliminated && !hasBRFinished && renderNumberPad()}

                {message && <p style={{ textAlign: 'center', color: 'var(--pink-accent)', fontWeight: 600, marginTop: '1rem' }}>{message}</p>}

                {gameState.status === 'finished' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <FancyButton size="sm" onClick={() => { isSoloPlayingRef.current = false; setGameState({ status: 'idle' }); setTimer(0); setHistory([]); setHistoryIndex(-1) }}>
                            Nouvelle partie
                        </FancyButton>
                    </div>
                )}

                {/* Cancel button during playing (not for BR - BR has its own buttons) */}
                {gameState.status === 'playing' && !isBRPlaying && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <button
                            onClick={() => {
                                // 1v1: Host can cancel the game
                                if (gameState.challenger && gameState.host?.username?.toLowerCase() === user.username.toLowerCase()) {
                                    handleCancelGame()
                                } else if (!gameState.challenger) {
                                    // Solo: Just reset local state
                                    isSoloPlayingRef.current = false
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

                {/* BR Finished: Return to menu button */}
                {brGameFinished && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <FancyButton
                            size="sm"
                            onClick={() => {
                                // Reset all BR state
                                setGameState({ status: 'idle' })
                                setTimer(0)
                                setIsTimerRunning(false)
                                setHistory([])
                                setHistoryIndex(-1)
                                setGrid(Array(81).fill(0))
                                setOriginalPuzzle([])
                                setIsEliminated(false)
                                setMyBRRank(null)
                                setHasBRFinished(false)
                                setBrGameFinished(false)
                                setBrWinner(null)
                                setBrPlayers([])
                                setLeaderProgress('')
                                setLeaderUsername('')
                                setErrorCount(0)
                                gameInitializedRef.current = false
                                setMessage(null)
                            }}
                        >
                            Retour au menu
                        </FancyButton>
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
