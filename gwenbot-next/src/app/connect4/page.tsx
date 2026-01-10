'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import FancyButton from '@/components/ui/fancy-button'
import { useToast } from '@/components/toast-context'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

const ROWS = 6
const COLS = 7

// SVG Icons
const SwordsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
        <path d="M14 10l6-6M20 4l-2 2M22 2l-6 6M2 22l6-6M4 20l2-2M8 16l-6 6" />
        <path d="m21.29 13.7-5.59-5.59-9 9 5.59 5.59a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.83Z" />
        <path d="m2.71 10.3 5.59 5.59 9-9-5.59-5.59a2 2 0 0 0-2.83 0L2.71 7.47a2 2 0 0 0 0 2.83Z" />
    </svg>
)

const TrophyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '48px', height: '48px' }}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
)

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </svg>
)

type Mode = 'menu' | 'lobby' | 'game'

interface Game {
    id: number
    status: 'waiting' | 'playing' | 'finished'
    board: (string | null)[][]
    current_turn: 'host' | 'challenger'
    host?: { id: number; username: string }
    challenger?: { id: number; username: string }
    winner?: { id: number; username: string }
}

interface Lobby {
    id: number
    host: { id: number; username: string }
    created_at: string
}

const styles = `
    .connect4-container {
        max-width: 700px;
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
    .board-container {
        background: linear-gradient(135deg, var(--pink-main), var(--pink-accent));
        padding: 12px;
        border-radius: 16px;
        display: inline-block;
    }
    .board {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
    }
    .cell {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    .cell:hover:not(.filled) {
        background: rgba(255, 255, 255, 0.5);
    }
    .cell.red {
        background: var(--pink-accent);
        box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2);
    }
    .cell.yellow {
        background: white;
        box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1);
    }
    .cell.winning {
        animation: pulse 0.5s ease infinite alternate;
    }
    @keyframes pulse {
        from { transform: scale(1); }
        to { transform: scale(1.1); }
    }
    @keyframes drop {
        from { transform: translateY(-400px); }
        to { transform: translateY(0); }
    }
    .cell.dropping {
        animation: drop 0.4s ease-out;
    }
    .column-indicator {
        display: flex;
        justify-content: space-around;
        margin-bottom: 8px;
        padding: 0 12px;
    }
    .column-btn {
        width: 60px;
        height: 30px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.2rem;
        opacity: 0.5;
        transition: opacity 0.2s;
    }
    .column-btn:hover {
        opacity: 1;
    }
    .column-btn.disabled {
        cursor: not-allowed;
        opacity: 0.2;
    }
    .turn-indicator {
        text-align: center;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 12px;
        font-weight: 600;
    }
    .turn-indicator.your-turn {
        background: rgba(236, 72, 153, 0.2);
        color: var(--pink-accent);
    }
    .turn-indicator.waiting {
        background: var(--bg-card);
        color: var(--text-muted);
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
    .player-colors {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-bottom: 1rem;
    }
    .player-color {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        background: var(--bg-card);
    }
    .color-dot {
        width: 20px;
        height: 20px;
        border-radius: 50%;
    }
    .color-dot.red { background: var(--pink-accent); }
    .color-dot.yellow { background: white; border: 2px solid var(--border-color); }
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
`

export default function Connect4Page() {
    const { showToast } = useToast()
    const [mode, setMode] = useState<Mode>('menu')
    const [game, setGame] = useState<Game | null>(null)
    const [lobbies, setLobbies] = useState<Lobby[]>([])
    const [user, setUser] = useState<{ id: number; username: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [droppingCell, setDroppingCell] = useState<{ row: number; col: number } | null>(null)
    const [winningCells, setWinningCells] = useState<[number, number][]>([])

    // Load user
    useEffect(() => {
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated && data.user) {
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

    // Fetch lobbies
    const fetchLobbies = useCallback(async () => {
        try {
            const res = await fetch('/api/connect4')
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

    // Supabase Broadcast for real-time sync
    useEffect(() => {
        if (!supabase || !game?.id) return

        const refetchGame = async () => {
            try {
                const res = await fetch(`/api/connect4?gameId=${game.id}`)
                const data = await res.json()
                if (data.game) {
                    setGame(data.game)
                }
            } catch (e) {
                console.error('Error refetching game:', e)
            }
        }

        const channel = supabase
            .channel(`connect4-game-${game.id}`)
            .on('broadcast', { event: 'game_update' }, (payload) => {
                if (payload.payload?.game) {
                    setGame(payload.payload.game)
                    if (payload.payload.winCells) {
                        setWinningCells(payload.payload.winCells)
                    }
                    if (payload.payload.move) {
                        setDroppingCell(payload.payload.move)
                        setTimeout(() => setDroppingCell(null), 400)
                    }
                }
            })
            .subscribe()

        const pollInterval = setInterval(refetchGame, 3000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollInterval)
        }
    }, [game?.id])

    const handleCreate = async () => {
        if (!user) {
            showToast('Connecte-toi pour jouer', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/connect4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', playerId: user.id })
            })
            const data = await res.json()
            if (data.success) {
                setGame(data.game)
                setMode('game')
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
            const res = await fetch('/api/connect4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', playerId: user.id, gameId: lobbyId })
            })
            const data = await res.json()
            if (data.success) {
                setGame(data.game)
                setMode('game')
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (e) {
            console.error(e)
            showToast('Erreur de connexion', 'error')
        }
        setLoading(false)
    }

    const handlePlay = async (column: number) => {
        if (!game || !user || game.status !== 'playing') return

        const isHost = user.id === game.host?.id
        const isOurTurn = (isHost && game.current_turn === 'host') ||
            (!isHost && game.current_turn === 'challenger')

        if (!isOurTurn) {
            showToast("Ce n'est pas ton tour", 'error')
            return
        }

        // Check if column is full
        if (game.board[0][column] !== null) {
            showToast("Colonne pleine", 'error')
            return
        }

        // Find target row (lowest empty)
        let targetRow = -1
        for (let row = ROWS - 1; row >= 0; row--) {
            if (game.board[row][column] === null) {
                targetRow = row
                break
            }
        }

        if (targetRow === -1) return

        // Optimistic update - update board locally with animation
        const playerColor = isHost ? 'red' : 'yellow'
        const newBoard = game.board.map((row, i) =>
            row.map((cell, j) => (i === targetRow && j === column) ? playerColor : cell)
        )

        setDroppingCell({ row: targetRow, col: column })
        setGame({ ...game, board: newBoard })

        try {
            const res = await fetch('/api/connect4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'play', playerId: user.id, gameId: game.id, column })
            })
            const data = await res.json()
            if (data.success) {
                // Update with server state after animation
                setTimeout(() => {
                    setGame(data.game)
                    setDroppingCell(null)
                    if (data.winCells) {
                        setWinningCells(data.winCells)
                    }
                }, 400)
                // Broadcast to opponent
                if (supabase) {
                    supabase.channel(`connect4-game-${game.id}`).send({
                        type: 'broadcast',
                        event: 'game_update',
                        payload: { game: data.game, move: data.move, winCells: data.winCells }
                    })
                }
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (e) {
            console.error(e)
            showToast('Erreur de connexion', 'error')
        }
    }

    const handlePlayAgain = () => {
        setGame(null)
        setWinningCells([])
        setMode('menu')
    }

    const isWinningCell = (row: number, col: number) => {
        return winningCells.some(([r, c]) => r === row && c === col)
    }

    // Render menu
    const renderMenu = () => (
        <div className="connect4-container">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--pink-accent)' }}>Puissance</span> 4
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Aligne 4 jetons pour gagner</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="mode-card" onClick={handleCreate}>
                    <div style={{ marginBottom: '1rem', color: 'var(--pink-accent)' }}><SwordsIcon /></div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Creer une partie</h3>
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

    // Render lobby
    const renderLobby = () => (
        <div className="connect4-container">
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

        const isHost = user?.id === game.host?.id
        const isOurTurn = game.status === 'playing' && (
            (isHost && game.current_turn === 'host') ||
            (!isHost && game.current_turn === 'challenger')
        )

        return (
            <div className="connect4-container">
                {/* Player colors legend */}
                <div className="player-colors">
                    <div className="player-color">
                        <div className="color-dot red"></div>
                        <span>{game.host?.username || 'Host'}</span>
                    </div>
                    <div className="player-color">
                        <div className="color-dot yellow"></div>
                        <span>{game.challenger?.username || 'En attente...'}</span>
                    </div>
                </div>

                {/* Turn indicator */}
                {game.status === 'waiting' ? (
                    <div className="turn-indicator waiting">
                        En attente d'un adversaire...
                        <div style={{ marginTop: '1rem' }}>
                            <FancyButton size="sm" onClick={handlePlayAgain}>Annuler</FancyButton>
                        </div>
                    </div>
                ) : game.status === 'playing' && (
                    <div className={`turn-indicator ${isOurTurn ? 'your-turn' : 'waiting'}`}>
                        {isOurTurn ? 'A toi de jouer !' : `C'est au tour de ${game.current_turn === 'host' ? game.host?.username : game.challenger?.username}`}
                    </div>
                )}

                {/* Board */}
                {(game.status === 'playing' || game.status === 'finished') && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="board-container">
                            <div className="column-indicator">
                                {Array.from({ length: COLS }).map((_, col) => (
                                    <button
                                        key={col}
                                        className={`column-btn ${!isOurTurn || game.board[0][col] !== null ? 'disabled' : ''}`}
                                        onClick={() => handlePlay(col)}
                                        disabled={!isOurTurn || game.board[0][col] !== null}
                                    >
                                        ▼
                                    </button>
                                ))}
                            </div>
                            <div className="board">
                                {game.board.map((row, rowIndex) =>
                                    row.map((cell, colIndex) => (
                                        <div
                                            key={`${rowIndex}-${colIndex}`}
                                            className={`cell ${cell || ''} ${isWinningCell(rowIndex, colIndex) ? 'winning' : ''} ${droppingCell?.row === rowIndex && droppingCell?.col === colIndex ? 'dropping' : ''}`}
                                            onClick={() => handlePlay(colIndex)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Victory Section */}
                {game.status === 'finished' && (
                    <div style={{ textAlign: 'center', marginTop: '2rem', animation: 'scaleIn 0.4s ease' }}>
                        <div className="victory-trophy" style={{ color: 'var(--pink-accent)', marginBottom: '1rem' }}>
                            <TrophyIcon />
                        </div>
                        <h2 className="victory-title">
                            {game.winner?.id === user?.id ? 'Victoire !' :
                                game.winner ? 'Defaite...' : 'Egalite !'}
                        </h2>
                        {game.winner && (
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                {game.winner.username} remporte la partie
                            </p>
                        )}
                        <FancyButton onClick={handlePlayAgain}>Rejouer</FancyButton>
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
                {mode === 'game' && renderGame()}
            </div>
        </>
    )
}
