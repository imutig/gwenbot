'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import FancyButton from '@/components/ui/fancy-button'
import UserProfileWidget from '@/components/user-profile-widget'
import type { FabricCanvasRef } from '@/components/games/pictionary/FabricCanvas'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Dynamically import FabricCanvas to avoid SSR issues
const FabricCanvas = dynamic(() => import('@/components/games/pictionary/FabricCanvas'), { ssr: false })

// Types
interface Player {
    id: number
    username: string
    avatar_seed?: string
    score: number
    drawOrder: number
    hasDrawn: boolean
}

interface Guesser {
    id: number
    username: string
    avatar_seed?: string
    score: number
    correctGuesses: number
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
    guessers: Guesser[]
    isHost: boolean
    isDrawer: boolean
    timeRemaining: number | null
}

interface WordChoice {
    word: string
    category: string
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
        guessers: [],
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
    const [lobbies, setLobbies] = useState<{
        id: number
        maxPlayers: number
        playerCount: number
        host: { id: number; username: string; avatar_seed?: string }
    }[]>([])
    const canvasRef = useRef<FabricCanvasRef>(null)
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const [canvasData, setCanvasData] = useState<string>('')
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    // Fetch available lobbies
    const fetchLobbies = async () => {
        try {
            const res = await fetch('/api/pictionary/lobbies')
            const data = await res.json()
            setLobbies(data.lobbies || [])
        } catch (error) {
            console.error('Failed to fetch lobbies:', error)
        }
    }

    // Join an existing game
    const handleJoinGame = async (gameId: number) => {
        if (!user.username) return
        setLoading(true)
        try {
            const res = await fetch('/api/pictionary/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, username: user.username })
            })
            const data = await res.json()
            if (data.success || data.message === 'Already in game') {
                setGameState(prev => ({
                    ...prev,
                    id: gameId,
                    status: 'waiting'
                }))
                setMessage('Partie rejointe !')
            } else {
                setMessage(data.error || 'Erreur')
            }
        } catch (error) {
            setMessage('Erreur réseau')
        }
        setLoading(false)
    }

    // Load user session
    useEffect(() => {
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated && data.user) {
                    const username = data.user.user_name || data.user.display_name || ''
                    setUser({
                        username,
                        isAuthorized: true
                    })

                    // Check if user has an active game
                    if (username) {
                        const activeRes = await fetch(`/api/pictionary/active?username=${username}`)
                        const activeData = await activeRes.json()
                        if (activeData.hasActiveGame) {
                            setGameState(prev => ({
                                ...prev,
                                id: activeData.gameId,
                                status: activeData.status,
                                isHost: activeData.isHost
                            }))
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load user:', error)
            }
        }
        loadUser()
        fetchLobbies()

        // Poll lobbies every 5 seconds when idle
        const lobbyInterval = setInterval(fetchLobbies, 5000)
        return () => clearInterval(lobbyInterval)
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
                guessers: data.guessers || [],
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

    // Subscribe to canvas broadcast channel for realtime sync
    useEffect(() => {
        if (!gameState.id || gameState.status !== 'playing') return

        const channel = supabase.channel(`pictionary-canvas-${gameState.id}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'canvas_update' }, (payload) => {
                // Host receives drawer's canvas updates (JSON)
                if (gameState.isHost && !gameState.isDrawer && payload.payload?.canvasJson) {
                    setCanvasData(payload.payload.canvasJson)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            channelRef.current = null
        }
    }, [gameState.id, gameState.status, gameState.isHost, gameState.isDrawer])

    // Timer countdown
    useEffect(() => {
        if (gameState.status === 'playing' && gameState.currentWord && timer > 0) {
            const interval = setInterval(() => {
                setTimer(t => Math.max(0, t - 1))
            }, 1000)
            return () => clearInterval(interval)
        }
    }, [gameState.status, gameState.currentWord, timer])

    // Clear canvas when round changes (when currentWord becomes null = new round starting)
    const prevRoundRef = useRef(gameState.currentRound)
    const prevWordRef = useRef(gameState.currentWord)

    useEffect(() => {
        // Detect round change or word becoming null (round ended)
        if (prevRoundRef.current !== gameState.currentRound ||
            (prevWordRef.current && !gameState.currentWord)) {
            // Clear the canvas for the new round
            canvasRef.current?.clear()
            setCanvasData('')
            console.log('[PICTIONARY] Canvas cleared for new round', gameState.currentRound)
        }
        prevRoundRef.current = gameState.currentRound
        prevWordRef.current = gameState.currentWord
    }, [gameState.currentRound, gameState.currentWord])

    // Handle timer expiration - move to next round when time runs out
    const timeoutCalledRef = useRef(false)

    useEffect(() => {
        // Only trigger once when timer hits 0
        if (timer === 0 && gameState.status === 'playing' && gameState.currentWord && gameState.id && !timeoutCalledRef.current) {
            timeoutCalledRef.current = true
            setMessage('Temps ecoule ! Passage au joueur suivant...')

            // Call timeout API to move to next round
            fetch('/api/pictionary/timeout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: gameState.id })
            }).then(() => {
                // Reset timer for next round
                setTimer(180)
                timeoutCalledRef.current = false
                // Poll will pick up the change
            }).catch(console.error)
        }

        // Reset the ref when a new word is chosen (new round)
        if (timer > 0) {
            timeoutCalledRef.current = false
        }
    }, [timer, gameState.status, gameState.currentWord, gameState.id])

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

    // Cancel game (host only)
    const handleCancelGame = async () => {
        if (!gameState.id || !gameState.isHost) return
        if (!confirm('Voulez-vous vraiment annuler cette partie ?')) return

        setLoading(true)
        try {
            const res = await fetch('/api/pictionary/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: gameState.id,
                    username: user.username
                })
            })
            const data = await res.json()

            if (data.success) {
                setGameState({
                    id: null,
                    status: 'idle',
                    maxPlayers: 6,
                    currentRound: 0,
                    host: null,
                    currentDrawer: null,
                    currentWord: null,
                    players: [],
                    guessers: [],
                    isHost: false,
                    isDrawer: false,
                    timeRemaining: null
                })
                setMessage('Partie annulee')
            } else {
                setMessage(data.error || 'Erreur')
            }
        } catch (error) {
            console.error('Error cancelling:', error)
        }
        setLoading(false)
    }

    // Format time
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    // Render player list - shows drawers in waiting, guessers in playing/finished
    const renderPlayerList = () => {
        const showGuessers = gameState.status === 'playing' || gameState.status === 'finished'

        return (
            <div className="glass-card" style={{ padding: '1rem', minWidth: '180px', maxWidth: '220px' }}>
                <h3 style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                    {showGuessers ? '🏆 Top Guessers' : `Dessinateurs (${gameState.players.length})`}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {showGuessers ? (
                        // Show guessers (viewers who guessed correctly)
                        gameState.guessers.length > 0 ? (
                            gameState.guessers.slice(0, 5).map((guesser, i) => (
                                <div
                                    key={guesser.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.4rem 0.6rem',
                                        background: i === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffb347 100%)' : 'var(--bg-card)',
                                        borderRadius: '8px',
                                        color: i === 0 ? '#333' : 'inherit',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', maxWidth: '120px' }}>
                                        <span style={{ flexShrink: 0 }}>{i === 0 ? '👑' : `${i + 1}.`}</span>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <UserProfileWidget username={guesser.username} seed={guesser.avatar_seed} showAvatar={false} />
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{guesser.score}</span>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', color: '#888', padding: '0.5rem', fontSize: '0.75rem' }}>
                                !dessin &lt;mot&gt;
                            </div>
                        )
                    ) : (
                        // Show drawers (players who will draw)
                        gameState.players.map((player, i) => (
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>{i + 1}.</span>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <UserProfileWidget username={player.username} seed={player.avatar_seed} showAvatar={false} className={gameState.currentDrawer?.id === player.id ? 'white-text-widget' : ''} />
                                    </div>
                                    {gameState.currentDrawer?.id === player.id && ' 🎨'}
                                    {gameState.host?.id === player.id && ' 👑'}
                                </div>
                                <span style={{ fontWeight: 700 }}>{player.hasDrawn ? '✓' : '⏳'}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )
    }

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
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Create game card */}
                    <div className="glass-card" style={{ maxWidth: '400px', padding: '2rem', flex: '1' }}>
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

                    {/* Available lobbies */}
                    {user.username && lobbies.filter(l => l.host.username.toLowerCase() !== user.username.toLowerCase()).length > 0 && (
                        <div className="glass-card" style={{ maxWidth: '400px', padding: '2rem', flex: '1' }}>
                            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Parties en attente</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {lobbies.filter(l => l.host.username.toLowerCase() !== user.username.toLowerCase()).map(lobby => (
                                    <div
                                        key={lobby.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '1rem',
                                            background: 'var(--bg-card)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <UserProfileWidget username={lobby.host.username} seed={lobby.host.avatar_seed} showAvatar={false} />
                                                </div>
                                                <span>👑</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {lobby.playerCount}/{lobby.maxPlayers} joueurs
                                            </div>
                                        </div>
                                        <FancyButton
                                            onClick={() => handleJoinGame(lobby.id)}
                                            disabled={loading || lobby.playerCount >= lobby.maxPlayers}
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                        >
                                            {lobby.playerCount >= lobby.maxPlayers ? 'Complet' : 'Rejoindre'}
                                        </FancyButton>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                                <FancyButton
                                    onClick={handleStartGame}
                                    disabled={loading || gameState.players.length < 2}
                                >
                                    {gameState.players.length < 2
                                        ? 'Minimum 2 joueurs'
                                        : 'Démarrer la partie'
                                    }
                                </FancyButton>
                                <button
                                    onClick={handleCancelGame}
                                    disabled={loading}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        color: '#ff6b6b',
                                        border: '1px solid #ff6b6b',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Annuler la partie
                                </button>
                            </div>
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
                                {gameState.isHost && (
                                    <button
                                        onClick={handleCancelGame}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: '#ff6b6b',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                        disabled={loading}
                                    >
                                        Annuler
                                    </button>
                                )}
                            </div>

                            {/* Canvas - only drawer can draw, host can view */}
                            <div style={{
                                height: '600px',
                                background: 'white',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                {(gameState.isDrawer || gameState.isHost) ? (
                                    <FabricCanvas
                                        ref={canvasRef}
                                        width={1000}
                                        height={600}
                                        disabled={!gameState.isDrawer || timer === 0}
                                        isDrawer={gameState.isDrawer}
                                        onCanvasChange={(json) => {
                                            // Broadcast canvas state to host
                                            if (gameState.id && channelRef.current) {
                                                channelRef.current.send({
                                                    type: 'broadcast',
                                                    event: 'canvas_update',
                                                    payload: { canvasJson: json }
                                                })
                                            }
                                        }}
                                        canvasData={canvasData}
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
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px' }}>
                                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                            </svg><br />
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
            {
                gameState.status === 'finished' && (
                    <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>🏆 Partie terminée !</h2>
                        {gameState.guessers.length > 0 ? (
                            gameState.guessers
                                .slice(0, 5)
                                .map((guesser, i) => (
                                    <div key={guesser.id} style={{
                                        padding: '1rem',
                                        marginBottom: '0.5rem',
                                        background: i === 0 ? 'linear-gradient(135deg, #ffd700, #ffb700)' : 'var(--bg-card)',
                                        borderRadius: '12px',
                                        color: i === 0 ? '#000' : 'inherit',
                                        fontWeight: i === 0 ? 700 : 500,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {guesser.username}
                                        </span>
                                        <span>{guesser.score} pts ({guesser.correctGuesses} ✓)</span>
                                    </div>
                                ))
                        ) : (
                            <p style={{ color: '#888', marginBottom: '1rem' }}>Aucun guesser cette partie !</p>
                        )}
                        <FancyButton
                            onClick={() => setGameState({ ...gameState, status: 'idle', id: null, players: [], guessers: [] })}
                            style={{ marginTop: '1.5rem' }}
                        >
                            Nouvelle partie
                        </FancyButton>
                    </div>
                )
            }

            {/* Word selection modal */}
            {
                showWordModal && (
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
                )
            }
        </div >
    )
}
