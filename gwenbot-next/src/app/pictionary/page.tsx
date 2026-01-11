'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tldraw, TLComponents, TLUiComponents, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import FancyButton from '@/components/ui/fancy-button'

// Types
interface Player {
    id: number
    username: string
    score: number
    drawOrder: number
    hasDrawn: boolean
}

interface GameState {
    id: number | null
    status: 'idle' | 'waiting' | 'playing' | 'finished'
    maxPlayers: number
    currentRound: number
    host: { id: number; username: string } | null
    currentDrawer: { id: number; username: string } | null
    currentWord: string | null
    players: Player[]
    isHost: boolean
    isDrawer: boolean
    timeRemaining: number | null
}

interface WordChoice {
    word: string
    category: string
}

// Custom toolbar - simplified for drawing
const customComponents: Partial<TLComponents> = {}
const customUiComponents: Partial<TLUiComponents> = {
    ContextMenu: null,
    ActionsMenu: null,
    HelpMenu: null,
    ZoomMenu: null,
    MainMenu: null,
    Minimap: null,
    StylePanel: null,
    PageMenu: null,
    NavigationPanel: null,
    Toolbar: null,
    KeyboardShortcutsDialog: null,
    QuickActions: null,
    HelperButtons: null,
    DebugPanel: null,
    DebugMenu: null,
    SharePanel: null,
    MenuPanel: null,
    TopPanel: null,
}

export default function PictionaryPage() {
    const [user, setUser] = useState({ username: '', isAuthorized: false })
    const [gameState, setGameState] = useState<GameState>({
        id: null,
        status: 'idle',
        maxPlayers: 6,
        currentRound: 0,
        host: null,
        currentDrawer: null,
        currentWord: null,
        players: [],
        isHost: false,
        isDrawer: false,
        timeRemaining: null
    })
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [maxPlayersInput, setMaxPlayersInput] = useState(6)
    const [wordChoices, setWordChoices] = useState<WordChoice[]>([])
    const [showWordModal, setShowWordModal] = useState(false)
    const [timer, setTimer] = useState(180)
    const editorRef = useRef<Editor | null>(null)
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Load user session
    useEffect(() => {
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated && data.user) {
                    setUser({
                        username: data.user.user_metadata?.user_name || '',
                        isAuthorized: true
                    })
                }
            } catch (error) {
                console.error('Failed to load user:', error)
            }
        }
        loadUser()
    }, [])

    // Poll for game status
    const pollStatus = useCallback(async () => {
        if (!gameState.id) return

        try {
            const res = await fetch(`/api/pictionary/status?gameId=${gameState.id}&username=${user.username}`)
            const data = await res.json()

            if (data.error) return

            setGameState(prev => ({
                ...prev,
                status: data.status,
                currentRound: data.currentRound,
                host: data.host,
                currentDrawer: data.currentDrawer,
                currentWord: data.currentWord,
                players: data.players,
                isHost: data.isHost,
                isDrawer: data.isDrawer,
                timeRemaining: data.timeRemaining
            }))

            if (data.timeRemaining !== null) {
                setTimer(Math.floor(data.timeRemaining))
            }

            // If we're the drawer and no word selected, show word modal
            if (data.isDrawer && !data.currentWord && data.status === 'playing') {
                fetchWordChoices()
            }
        } catch (error) {
            console.error('Error polling status:', error)
        }
    }, [gameState.id, user.username])

    useEffect(() => {
        if (gameState.id && gameState.status !== 'finished') {
            pollIntervalRef.current = setInterval(pollStatus, 2000)
            return () => {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            }
        }
    }, [gameState.id, gameState.status, pollStatus])

    // Timer countdown
    useEffect(() => {
        if (gameState.status === 'playing' && gameState.currentWord && timer > 0) {
            const interval = setInterval(() => {
                setTimer(t => Math.max(0, t - 1))
            }, 1000)
            return () => clearInterval(interval)
        }
    }, [gameState.status, gameState.currentWord, timer])

    // Fetch word choices for drawer
    const fetchWordChoices = async () => {
        if (!gameState.id || !user.username) return

        try {
            const res = await fetch(`/api/pictionary/word?gameId=${gameState.id}&username=${user.username}`)
            const data = await res.json()

            if (data.wordSelected) {
                setShowWordModal(false)
            } else if (data.choices) {
                setWordChoices(data.choices)
                setShowWordModal(true)
            }
        } catch (error) {
            console.error('Error fetching words:', error)
        }
    }

    // Create game
    const handleCreateGame = async () => {
        if (!user.username) {
            setMessage('Connecte-toi pour créer une partie')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/pictionary/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hostUsername: user.username,
                    maxPlayers: maxPlayersInput
                })
            })
            const data = await res.json()

            if (data.success) {
                setGameState(prev => ({
                    ...prev,
                    id: data.gameId,
                    status: 'waiting',
                    maxPlayers: maxPlayersInput,
                    isHost: true
                }))
                setMessage('Partie créée ! En attente des joueurs...')
            } else {
                setMessage(data.error || 'Erreur de création')
            }
        } catch (error) {
            setMessage('Erreur réseau')
        }
        setLoading(false)
    }

    // Start game
    const handleStartGame = async () => {
        if (!gameState.id) return

        setLoading(true)
        try {
            const res = await fetch('/api/pictionary/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.id,
                    hostUsername: user.username
                })
            })
            const data = await res.json()

            if (data.success) {
                setMessage('La partie commence !')
                pollStatus()
            } else {
                setMessage(data.error || 'Impossible de démarrer')
            }
        } catch (error) {
            setMessage('Erreur réseau')
        }
        setLoading(false)
    }

    // Select word
    const handleSelectWord = async (word: string) => {
        if (!gameState.id) return

        setLoading(true)
        try {
            const res = await fetch('/api/pictionary/word', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.id,
                    username: user.username,
                    word,
                    wordChoices
                })
            })
            const data = await res.json()

            if (data.success) {
                setShowWordModal(false)
                setTimer(180)
                setMessage(`Mot choisi : ${word}. Dessine !`)
            }
        } catch (error) {
            setMessage('Erreur')
        }
        setLoading(false)
    }

    // Format time
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    // Render player list
    const renderPlayerList = () => (
        <div className="glass-card" style={{ padding: '1.5rem', minWidth: '250px' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>
                Joueurs ({gameState.players.length}/{gameState.maxPlayers})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gameState.players.map((player, i) => (
                    <div
                        key={player.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            background: gameState.currentDrawer?.id === player.id
                                ? 'var(--pink-accent)'
                                : 'var(--bg-card)',
                            borderRadius: '10px',
                            color: gameState.currentDrawer?.id === player.id ? 'white' : 'inherit'
                        }}
                    >
                        <span>
                            {i + 1}. {player.username}
                            {gameState.currentDrawer?.id === player.id && ' 🎨'}
                            {gameState.host?.id === player.id && ' 👑'}
                        </span>
                        <span style={{ fontWeight: 700 }}>{player.score}</span>
                    </div>
                ))}
            </div>
        </div>
    )

    // Main render
    return (
        <div className="main-content" style={{ padding: '6rem 2rem 2rem' }}>
            <h1 style={{
                textAlign: 'center',
                marginBottom: '2rem',
                fontSize: '2.5rem',
                background: 'linear-gradient(135deg, var(--pink-accent), #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                🎨 Pictionary
            </h1>

            {message && (
                <p style={{
                    textAlign: 'center',
                    color: 'var(--pink-accent)',
                    marginBottom: '1rem',
                    fontWeight: 500
                }}>
                    {message}
                </p>
            )}

            {/* Idle state - Create game */}
            {gameState.status === 'idle' && (
                <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
                    {!user.username ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            Connecte-toi avec Twitch pour jouer !
                        </p>
                    ) : (
                        <>
                            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Créer une partie</h2>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                    Nombre de joueurs
                                </label>
                                <input
                                    type="range"
                                    min={2}
                                    max={12}
                                    value={maxPlayersInput}
                                    onChange={e => setMaxPlayersInput(Number(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.25rem' }}>
                                    {maxPlayersInput} joueurs = {maxPlayersInput} rounds
                                </div>
                            </div>
                            <FancyButton
                                onClick={handleCreateGame}
                                disabled={loading}
                                style={{ width: '100%', marginTop: '1rem' }}
                            >
                                {loading ? 'Création...' : 'Créer la partie'}
                            </FancyButton>
                        </>
                    )}
                </div>
            )}

            {/* Waiting state - Show lobby */}
            {gameState.status === 'waiting' && (
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {renderPlayerList()}

                    {gameState.isHost && (
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>En attente...</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Les viewers peuvent rejoindre via le site ou le chat !
                            </p>
                            <FancyButton
                                onClick={handleStartGame}
                                disabled={loading || gameState.players.length < 2}
                            >
                                {gameState.players.length < 2
                                    ? 'Minimum 2 joueurs'
                                    : 'Démarrer la partie'
                                }
                            </FancyButton>
                        </div>
                    )}
                </div>
            )}

            {/* Playing state */}
            {gameState.status === 'playing' && (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    {/* Left: Scoreboard */}
                    {renderPlayerList()}

                    {/* Center: Canvas */}
                    <div style={{ flex: 1, minWidth: '400px' }}>
                        <div className="glass-card" style={{ padding: '1rem' }}>
                            {/* Header with timer and info */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem'
                            }}>
                                <span>
                                    Round {gameState.currentRound}/{gameState.players.length}
                                </span>
                                <span style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: timer < 30 ? '#ff6b6b' : 'inherit'
                                }}>
                                    ⏱️ {formatTime(timer)}
                                </span>
                                <span>
                                    {gameState.isDrawer
                                        ? `Mot: ${gameState.currentWord || '???'}`
                                        : `${gameState.currentDrawer?.username} dessine...`
                                    }
                                </span>
                            </div>

                            {/* Canvas - only drawer can draw, host can view */}
                            <div style={{
                                height: '500px',
                                background: 'white',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                {(gameState.isDrawer || gameState.isHost) ? (
                                    <Tldraw
                                        components={customComponents}
                                        onMount={editor => {
                                            editorRef.current = editor
                                            // If not drawer, make read-only
                                            if (!gameState.isDrawer) {
                                                editor.updateInstanceState({ isReadonly: true })
                                            }
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#666'
                                    }}>
                                        <p style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: '3rem' }}>🎨</span><br />
                                            Devine le mot dans le chat Twitch !
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Finished state */}
            {gameState.status === 'finished' && (
                <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>🏆 Partie terminée !</h2>
                    {gameState.players
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 3)
                        .map((player, i) => (
                            <div key={player.id} style={{
                                padding: '1rem',
                                marginBottom: '0.5rem',
                                background: i === 0 ? 'linear-gradient(135deg, #ffd700, #ffb700)' : 'var(--bg-card)',
                                borderRadius: '12px',
                                color: i === 0 ? '#000' : 'inherit',
                                fontWeight: i === 0 ? 700 : 500
                            }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {player.username} - {player.score} pts
                            </div>
                        ))
                    }
                    <FancyButton
                        onClick={() => setGameState({ ...gameState, status: 'idle', id: null, players: [] })}
                        style={{ marginTop: '1.5rem' }}
                    >
                        Nouvelle partie
                    </FancyButton>
                </div>
            )}

            {/* Word selection modal */}
            {showWordModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ padding: '2rem', maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                            Choisis ton mot !
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {wordChoices.map((choice, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectWord(choice.word)}
                                    disabled={loading}
                                    style={{
                                        padding: '1rem 1.5rem',
                                        background: 'var(--bg-card)',
                                        border: '2px solid var(--border-color)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontSize: '1.1rem',
                                        fontWeight: 500,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--pink-accent)'
                                        e.currentTarget.style.transform = 'scale(1.02)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--border-color)'
                                        e.currentTarget.style.transform = 'scale(1)'
                                    }}
                                >
                                    {choice.word}
                                    <span style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '0.25rem'
                                    }}>
                                        {choice.category}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
