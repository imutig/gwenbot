'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import FancyButton from '@/components/ui/fancy-button'
import { useToast } from '@/components/toast-context'
import type { MemoryMode, MemoryDifficulty, MemoryGame, MemoryLobby, MemoryPlayer } from '@/types/memory'
import { GamepadIcon, SwordsIcon, TrophyIcon, RefreshIcon, CARD_ICONS } from '@/components/games/memory/MemoryIcons'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

// Icons imported from @/components/games/memory/MemoryIcons

const styles = `
    .memory-container {
        max-width: 800px;
        margin: 0 auto;
    }
    .mode-card {
        padding: 2rem;
        border-radius: 16px;
        background: var(--bg-card);
        border: 2px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .mode-card:hover {
        border-color: var(--pink-accent);
        transform: translateY(-4px);
    }
    .mode-card.selected {
        border-color: var(--pink-main);
        background: rgba(236, 72, 153, 0.1);
    }
    .card-grid {
        display: grid;
        gap: 8px;
        justify-content: center;
    }
    .card-grid.easy { grid-template-columns: repeat(4, 100px); }
    .card-grid.hard { grid-template-columns: repeat(6, 85px); }
    .memory-card {
        aspect-ratio: 1;
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.4s ease;
    }
    .memory-card.flipped {
        transform: rotateY(180deg);
    }
    .memory-card.matched {
        opacity: 0.6;
        cursor: default;
    }
    .card-face {
        position: absolute;
        inset: 0;
        border-radius: 12px;
        backface-visibility: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .card-back {
        background: linear-gradient(135deg, var(--pink-main), var(--pink-accent));
        border: 2px solid var(--pink-accent);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .card-back svg {
        width: 32px;
        height: 32px;
        color: white;
        opacity: 0.5;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    .card-front {
        background: var(--bg-card);
        border: 2px solid var(--border-color);
        transform: rotateY(180deg);
        padding: 8px;
    }
    .card-front svg {
        width: 100%;
        height: 100%;
    }
    .score-bar {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        background: var(--bg-card);
        border-radius: 12px;
        margin-bottom: 1rem;
    }
    .player-score {
        text-align: center;
        padding: 0.5rem 1rem;
        border-radius: 8px;
    }
    .player-score.active {
        background: var(--pink-accent);
        color: white;
    }
    .lobby-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: var(--bg-card);
        border-radius: 12px;
        margin-bottom: 0.5rem;
        border: 1px solid var(--border-color);
    }
    .victory-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
    }
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    .victory-modal {
        background: #fce4ec;
        padding: 3rem 4rem;
        border-radius: 24px;
        text-align: center;
        max-width: 420px;
        border: 2px solid var(--pink-accent);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        animation: scaleIn 0.4s ease;
    }
    .victory-trophy {
        display: inline-block;
        animation: float 2s ease-in-out infinite;
        filter: drop-shadow(0 4px 12px rgba(236, 72, 153, 0.4));
    }
    .victory-title {
        font-size: 2rem;
        font-weight: 800;
        background: linear-gradient(135deg, var(--pink-main), var(--pink-accent));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
    }
    .victory-stats {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin: 1.5rem 0;
        padding: 1rem;
        background: rgba(236, 72, 153, 0.1);
        border-radius: 12px;
    }
    .victory-stat {
        text-align: center;
    }
    .victory-stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--pink-accent);
    }
    .victory-stat-label {
        font-size: 0.8rem;
        color: var(--text-muted);
        text-transform: uppercase;
    }
    .confetti {
        position: absolute;
        width: 10px;
        height: 10px;
        background: var(--pink-accent);
        animation: confetti-fall 3s linear infinite;
    }
    @keyframes confetti-fall {
        0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
    }
    .difficulty-btn {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: 2px solid var(--border-color);
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text-primary);
    }
    .difficulty-btn.selected {
        border-color: var(--pink-main);
        background: var(--pink-main);
        color: white;
    }
`

export default function MemoryPage() {
    const { showToast } = useToast()
    const [mode, setMode] = useState<MemoryMode>('menu')
    const [difficulty, setDifficulty] = useState<MemoryDifficulty>('easy')
    const [game, setGame] = useState<MemoryGame | null>(null)
    const [lobbies, setLobbies] = useState<MemoryLobby[]>([])
    const [user, setUser] = useState<MemoryPlayer | null>(null)
    const [loading, setLoading] = useState(false)
    const [flippedCards, setFlippedCards] = useState<number[]>([])
    const [processing, setProcessing] = useState(false)
    const [timer, setTimer] = useState(0)

    // Load user
    useEffect(() => {
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated && data.user) {
                    // Get player ID from database
                    const playerRes = await fetch(`/api/player?username=${encodeURIComponent(data.user.display_name)}`)
                    const playerData = await playerRes.json()
                    if (playerData.player) {
                        setUser({ id: playerData.player.id, username: data.user.display_name })
                    }
                }
            } catch (e) {
                console.error('Error loading user:', e)
            }
        }
        loadUser()
    }, [])

    // Timer
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (game?.status === 'playing' && game.start_time) {
            interval = setInterval(() => {
                const start = new Date(game.start_time!).getTime()
                setTimer(Math.floor((Date.now() - start) / 1000))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [game?.status, game?.start_time])

    // Fetch lobbies
    const fetchLobbies = useCallback(async () => {
        try {
            const res = await fetch('/api/memory')
            const data = await res.json()
            setLobbies(data.lobbies || [])
        } catch (e) {
            console.error('Error fetching lobbies:', e)
        }
    }, [])

    useEffect(() => {
        if (mode === 'lobby') {
            fetchLobbies()
            const interval = setInterval(fetchLobbies, 5000)
            return () => clearInterval(interval)
        }
    }, [mode, fetchLobbies])

    // Supabase Broadcast for real-time sync in 1v1
    useEffect(() => {
        if (!supabase || !game?.id) return

        // Function to refetch full game data
        const refetchGame = async () => {
            try {
                const res = await fetch(`/api/memory?gameId=${game.id}`)
                const data = await res.json()
                if (data.game) {
                    setGame(data.game)
                }
            } catch (e) {
                console.error('Error refetching game:', e)
            }
        }

        const channel = supabase
            .channel(`memory-game-${game.id}`)
            .on('broadcast', { event: 'game_update' }, (payload) => {
                // Update game state from broadcast
                if (payload.payload?.game) {
                    setGame(payload.payload.game)
                }
            })
            .on('broadcast', { event: 'card_flip' }, (payload) => {
                // Show opponent's flipped cards temporarily
                if (payload.payload?.flippedCards && payload.payload?.playerId !== user?.id) {
                    setFlippedCards(payload.payload.flippedCards)
                }
            })
            .subscribe()

        // Poll regularly to stay in sync
        const pollInterval = setInterval(refetchGame, 3000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollInterval)
        }
    }, [game?.id, user?.id])

    const handleStartSolo = async () => {
        if (!user) {
            showToast('Connecte-toi pour jouer', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_solo', playerId: user.id, difficulty })
            })
            const data = await res.json()
            if (data.success) {
                setGame(data.game)
                setMode('solo')
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (e) {
            console.error(e)
            showToast('Erreur de connexion', 'error')
        }
        setLoading(false)
    }

    const handleCreate1v1 = async () => {
        if (!user) {
            showToast('Connecte-toi pour jouer', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_1v1', playerId: user.id, difficulty })
            })
            const data = await res.json()
            if (data.success) {
                setGame(data.game)
                setMode('1v1')
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (e) {
            console.error(e)
            showToast('Erreur de connexion', 'error')
        }
        setLoading(false)
    }

    const handleJoinLobby = async (lobbyId: number) => {
        if (!user) {
            showToast('Connecte-toi pour jouer', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', playerId: user.id, gameId: lobbyId })
            })
            const data = await res.json()
            if (data.success) {
                setGame(data.game)
                setMode('1v1')
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (e) {
            console.error(e)
            showToast('Erreur de connexion', 'error')
        }
        setLoading(false)
    }

    const handleCardClick = async (index: number) => {
        if (!game || processing) return
        if (game.matched.includes(index)) return
        if (flippedCards.includes(index)) return
        if (flippedCards.length >= 2) return

        // In 1v1, check if it's our turn
        if (game.mode === '1v1' && game.status === 'playing') {
            const isHost = user?.id === game.host?.id
            const isOurTurn = (isHost && game.current_turn === 'host') ||
                (!isHost && game.current_turn === 'challenger')
            if (!isOurTurn) {
                showToast("Ce n'est pas ton tour", 'error')
                return
            }
        }

        const newFlipped = [...flippedCards, index]
        setFlippedCards(newFlipped)

        // Broadcast card flip to opponent in 1v1
        if (game.mode === '1v1' && supabase) {
            supabase.channel(`memory-game-${game.id}`).send({
                type: 'broadcast',
                event: 'card_flip',
                payload: { flippedCards: newFlipped, playerId: user?.id }
            })
        }

        if (newFlipped.length === 2) {
            setProcessing(true)
            const [first, second] = newFlipped
            const isMatch = game.cards[first] === game.cards[second]

            // Wait for flip animation
            setTimeout(async () => {
                try {
                    const res = await fetch('/api/memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'match',
                            gameId: game.id,
                            card1: first,
                            card2: second,
                            isMatch
                        })
                    })
                    const data = await res.json()
                    if (data.success) {
                        setGame(data.game)
                        // Broadcast game update to opponent
                        if (game.mode === '1v1' && supabase) {
                            supabase.channel(`memory-game-${game.id}`).send({
                                type: 'broadcast',
                                event: 'game_update',
                                payload: { game: data.game }
                            })
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
                setFlippedCards([])
                // Broadcast card reset to opponent
                if (game.mode === '1v1' && supabase) {
                    supabase.channel(`memory-game-${game.id}`).send({
                        type: 'broadcast',
                        event: 'card_flip',
                        payload: { flippedCards: [], playerId: user?.id }
                    })
                }
                setProcessing(false)
            }, 800)
        }
    }

    const handlePlayAgain = () => {
        setGame(null)
        setFlippedCards([])
        setTimer(0)
        setMode('menu')
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Render menu
    const renderMenu = () => (
        <div className="memory-container">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--pink-accent)' }}>Gwen</span> Memory
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Trouve toutes les paires</p>
            </div>

            {/* Difficulty Selection */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Difficulte</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        className={`difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                        onClick={() => setDifficulty('easy')}
                    >
                        4x4 (8 paires)
                    </button>
                    <button
                        className={`difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                        onClick={() => setDifficulty('hard')}
                    >
                        6x6 (18 paires)
                    </button>
                </div>
            </div>

            {/* Mode Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="mode-card" onClick={handleStartSolo}>
                    <div style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}><GamepadIcon /></div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Solo</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Joue seul, bats ton record</p>
                </div>
                <div className="mode-card" onClick={handleCreate1v1}>
                    <div style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}><SwordsIcon /></div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Creer 1v1</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Defie un ami</p>
                </div>
                <div className="mode-card" onClick={() => { setMode('lobby'); fetchLobbies() }}>
                    <div style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Rejoindre</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Parties en attente</p>
                </div>
            </div>

            {!user && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Connecte-toi avec Twitch pour jouer
                </p>
            )}
        </div>
    )

    // Render lobby list
    const renderLobby = () => (
        <div className="memory-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Parties en attente</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <FancyButton size="sm" onClick={fetchLobbies}><RefreshIcon /></FancyButton>
                    <FancyButton size="sm" onClick={() => setMode('menu')}>Retour</FancyButton>
                </div>
            </div>

            {lobbies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Aucune partie en attente
                </div>
            ) : (
                lobbies.map(lobby => (
                    <div key={lobby.id} className="lobby-card">
                        <div>
                            <strong>{lobby.host.username}</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                {lobby.difficulty === 'easy' ? '4x4' : '6x6'}
                            </span>
                        </div>
                        <FancyButton size="sm" onClick={() => handleJoinLobby(lobby.id)}>
                            Rejoindre
                        </FancyButton>
                    </div>
                ))
            )}
        </div>
    )

    // Render game
    const renderGame = () => {
        if (!game) return null

        const gridSize = game.difficulty === 'easy' ? 16 : 36
        const isHost = user?.id === game.host?.id
        const isOurTurn = game.mode === 'solo' ||
            (isHost && game.current_turn === 'host') ||
            (!isHost && game.current_turn === 'challenger')

        return (
            <div className="memory-container">
                {/* Score bar */}
                {game.mode === '1v1' ? (
                    <div className="score-bar">
                        <div className={`player-score ${game.current_turn === 'host' ? 'active' : ''}`}>
                            <div style={{ fontWeight: 600 }}>{game.host?.username || 'Host'}</div>
                            <div style={{ fontSize: '1.5rem' }}>{game.host_pairs}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Paires</div>
                            <div style={{ fontSize: '1.5rem' }}>{formatTime(timer)}</div>
                        </div>
                        <div className={`player-score ${game.current_turn === 'challenger' ? 'active' : ''}`}>
                            <div style={{ fontWeight: 600 }}>{game.challenger?.username || 'En attente...'}</div>
                            <div style={{ fontSize: '1.5rem' }}>{game.challenger_pairs}</div>
                        </div>
                    </div>
                ) : (
                    <div className="score-bar">
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Coups: </span>
                            <strong>{game.moves}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Temps: </span>
                            <strong>{formatTime(timer)}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>Paires: </span>
                            <strong>{game.matched.length / 2} / {gridSize / 2}</strong>
                        </div>
                    </div>
                )}

                {/* Waiting for opponent */}
                {game.status === 'waiting' && (
                    <div style={{ textAlign: 'center', padding: '2rem', marginBottom: '1rem', background: 'var(--bg-card)', borderRadius: '12px' }}>
                        <p>En attente d'un adversaire...</p>
                        <FancyButton size="sm" onClick={handlePlayAgain}>
                            Annuler
                        </FancyButton>
                    </div>
                )}

                {/* Turn indicator for 1v1 */}
                {game.mode === '1v1' && game.status === 'playing' && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem', color: isOurTurn ? 'var(--pink-accent)' : 'var(--text-muted)' }}>
                        {isOurTurn ? 'A toi de jouer !' : `C'est au tour de ${game.current_turn === 'host' ? game.host?.username : game.challenger?.username}`}
                    </div>
                )}

                {/* Card Grid */}
                {game.status === 'playing' && (
                    <div className={`card-grid ${game.difficulty}`}>
                        {Array.from({ length: gridSize }).map((_, index) => {
                            const isFlipped = flippedCards.includes(index) || game.matched.includes(index)
                            const isMatched = game.matched.includes(index)

                            return (
                                <div
                                    key={index}
                                    className={`memory-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
                                    onClick={() => handleCardClick(index)}
                                >
                                    <div className="card-face card-back">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 2v20M2 12h20" />
                                        </svg>
                                    </div>
                                    <div className="card-face card-front">
                                        {game.cards[index] && CARD_ICONS[game.cards[index]] && (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CARD_ICONS[game.cards[index]].color }}>
                                                <div style={{ width: '60%', height: '60%' }}>
                                                    {CARD_ICONS[game.cards[index]].svg}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Victory Modal */}
                {game.status === 'finished' && (
                    <div className="victory-overlay">
                        <div className="victory-modal">
                            <div className="victory-trophy" style={{ color: 'var(--pink-accent)', marginBottom: '1.5rem' }}>
                                <TrophyIcon />
                            </div>
                            <h2 className="victory-title">
                                {game.mode === 'solo' ? 'Bravo !' :
                                    game.winner?.id === user?.id ? 'Victoire !' :
                                        game.winner ? 'Defaite...' : 'Egalite !'}
                            </h2>
                            {game.mode === '1v1' && game.winner && (
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    {game.winner.username} remporte la partie
                                </p>
                            )}
                            <div className="victory-stats">
                                {game.mode === 'solo' ? (
                                    <>
                                        <div className="victory-stat">
                                            <div className="victory-stat-value">{game.moves}</div>
                                            <div className="victory-stat-label">Coups</div>
                                        </div>
                                        <div className="victory-stat">
                                            <div className="victory-stat-value">{formatTime(timer)}</div>
                                            <div className="victory-stat-label">Temps</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="victory-stat">
                                            <div className="victory-stat-value">{game.host_pairs}</div>
                                            <div className="victory-stat-label">{game.host?.username}</div>
                                        </div>
                                        <div style={{ fontSize: '2rem', color: 'var(--text-muted)', alignSelf: 'center' }}>-</div>
                                        <div className="victory-stat">
                                            <div className="victory-stat-value">{game.challenger_pairs}</div>
                                            <div className="victory-stat-label">{game.challenger?.username}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <FancyButton onClick={handlePlayAgain}>Rejouer</FancyButton>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn" style={{ padding: '2rem 0' }}>
                {mode === 'menu' && renderMenu()}
                {mode === 'lobby' && renderLobby()}
                {(mode === 'solo' || mode === '1v1') && renderGame()}
            </div>
        </>
    )
}
