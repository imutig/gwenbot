'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import FancyButton from '@/components/ui/fancy-button'
import { useToast } from '@/components/toast-context'

// Leaflet CSS
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

// SVG Icons (Lucide-style)
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <polygon points="6,3 20,12 6,21 6,3" fill="currentColor" />
    </svg>
)

const SkipIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <polygon points="5,4 15,12 5,20 5,4" fill="currentColor" />
        <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
)

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <rect x="6" y="6" width="12" height="12" fill="currentColor" />
    </svg>
)

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <line x1="12" x2="12" y1="5" y2="19" />
        <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
)

const TargetIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
)

const MapPinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
)

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const TrophyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
)

interface GameStatus {
    game: {
        id: number
        status: string
        current_round: number
        total_rounds: number
        round_duration: number
        host: string
    } | null
    round: {
        id: number
        roundNumber: number
        imageUrl: string
        startedAt: string
        correctLat?: number
        correctLng?: number
        country?: string
        city?: string
    } | null
    leaderboard: Array<{
        playerId: number
        username: string
        avatar_seed: string | null
        totalPoints: number
    }>
}

interface RoundResult {
    roundNumber: number
    correctLat: number
    correctLng: number
    country: string
    city: string
    results: Array<{
        username: string
        avatarSeed: string | null
        guessLat: number
        guessLng: number
        distanceKm: number
        points: number
    }>
    isLastRound: boolean
}

export default function GwenGuessrHostPage() {
    const [status, setStatus] = useState<GameStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
    const [totalRounds, setTotalRounds] = useState(5)
    const [roundDuration, setRoundDuration] = useState(60)
    const [leafletLoaded, setLeafletLoaded] = useState(false)
    const [ignoredGameId, setIgnoredGameId] = useState<number | null>(null)
    const ignoredGameIdRef = useRef<number | null>(null)
    const { showToast } = useToast()

    // Sync ref with state
    useEffect(() => {
        ignoredGameIdRef.current = ignoredGameId
    }, [ignoredGameId])

    // Fetch game status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/gwenguessr/status')
            const data = await res.json()

            // Should we ignore this game?
            // Use ref to avoid stale closures if a request was already in flight
            if (data.game?.status === 'finished' && data.game?.id === ignoredGameIdRef.current) {
                setStatus({ ...data, game: null }) // Pretend no game exists
            } else {
                setStatus(data)
            }
        } catch (error) {
            console.error('Status fetch error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 2000)
        return () => clearInterval(interval)
    }, [fetchStatus])

    // Load Leaflet dynamically
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).L) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = LEAFLET_CSS
            document.head.appendChild(link)

            import('leaflet').then((L) => {
                // @ts-ignore
                window.L = L
                setLeafletLoaded(true)
            })
        } else if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).L) {
            setLeafletLoaded(true)
        }
    }, [])

    // Create new game
    const handleCreateGame = async () => {
        setActionLoading(true)
        try {
            const res = await fetch('/api/gwenguessr/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalRounds: totalRounds, roundDuration: roundDuration })
            })
            const data = await res.json()

            if (res.ok) {
                showToast('Partie créée !', 'success')
                setRoundResult(null)
                setStatus(null)
                // New game created, so we stop ignoring "finished" games since a new "lobby" game will be returned
                setIgnoredGameId(null)
                ignoredGameIdRef.current = null // Immediate ref update
                fetchStatus()
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (error) {
            showToast('Erreur création partie', 'error')
        } finally {
            setActionLoading(false)
        }
    }

    // ... (omitted code)


    // Start next round
    const handleStartRound = async () => {
        setActionLoading(true)
        setRoundResult(null)
        try {
            const res = await fetch('/api/gwenguessr/start-round', {
                method: 'POST'
            })
            const data = await res.json()

            if (res.ok) {
                showToast('Round lancé !', 'success')
                fetchStatus()
            } else {
                showToast(data.error || 'Erreur', 'error')
            }
        } catch (error) {
            showToast('Erreur lancement round', 'error')
        } finally {
            setActionLoading(false)
        }
    }

    // End current round (reveal)
    const handleEndRound = async () => {
        setActionLoading(true)
        try {
            const res = await fetch('/api/gwenguessr/end-round', {
                method: 'POST'
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error)
            }

            setRoundResult(data)
            showToast('Résultats reveles !', 'success')
            fetchStatus()
        } catch (error) {
            showToast('Erreur lors de la revelation', 'error')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="animate-slideIn" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ animation: 'pulse 1.5s infinite' }}>Chargement...</div>
            </div>
        )
    }

    // Lobby - Create Game
    if (!status?.game || status.game.status === 'lobby') {
        return (
            <div className="animate-slideIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <TargetIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr - Host</h1>
                </div>

                {!status?.game ? (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Nouvelle Partie</h2>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                Nombre de rounds ({totalRounds})
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={totalRounds}
                                onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>



                        <FancyButton onClick={handleCreateGame} disabled={actionLoading}>
                            <PlusIcon />
                            {actionLoading ? 'Création...' : 'Créer la partie'}
                        </FancyButton>
                    </div>
                ) : (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite', display: 'flex', justifyContent: 'center' }}>
                            <TargetIcon />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Partie en attente..</h2>
                        <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
                            Les viewers peuvent guess à tout moment via le lien posté dans le chat.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <FancyButton
                                onClick={handleStartRound}
                                disabled={actionLoading}
                            >
                                <PlayIcon />
                                {actionLoading ? 'Lancement...' : 'Lancer le premier round'}
                            </FancyButton>
                        </div>
                    </div>
                )}


            </div>
        )
    }

    return (
        <div className="animate-slideIn">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <TargetIcon />
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr - Host</h1>
            </div>

            {/* No active game - Create form */}
            {!status?.game && (
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PlusIcon />
                        Nouvelle Partie
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre de rounds</label>
                            <select
                                className="input"
                                style={{ width: '100%' }}
                                value={totalRounds}
                                onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                            >
                                <option value="3">3 rounds</option>
                                <option value="5">5 rounds</option>
                                <option value="7">7 rounds</option>
                                <option value="10">10 rounds</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Duree par round</label>
                            <select
                                className="input"
                                style={{ width: '100%' }}
                                value={roundDuration}
                                onChange={(e) => setRoundDuration(parseInt(e.target.value))}
                            >
                                <option value="30">30 secondes</option>
                                <option value="60">1 minute</option>
                                <option value="90">1m30</option>
                                <option value="120">2 minutes</option>
                            </select>
                        </div>
                    </div>

                    <FancyButton
                        onClick={handleCreateGame}
                        disabled={actionLoading}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <PlusIcon />
                        {actionLoading ? 'Creation...' : 'Creer la partie'}
                    </FancyButton>
                </div>
            )}

            {/* Active game controls */}
            {status?.game && (
                <>
                    {/* Game info bar */}
                    <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <span style={{ fontWeight: 600 }}>Partie #{status.game.id}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '1rem' }}>
                                {status.game.total_rounds} rounds
                            </span>
                        </div>
                        <div style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            background: status.game.status === 'playing' ? 'var(--pink-main)' : 'var(--bg-base)',
                            color: status.game.status === 'playing' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}>
                            {status.game.status === 'lobby' && 'En attente'}
                            {status.game.status === 'playing' && `Round ${status.game.current_round}`}
                            {status.game.status === 'between_rounds' && 'Entre les rounds'}
                            {status.game.status === 'finished' && 'Termine'}
                        </div>
                    </div>

                    {/* Controls based on state */}
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                        {/* Lobby - Start first round */}
                        {status.game.status === 'lobby' && (
                            <FancyButton
                                onClick={handleStartRound}
                                disabled={actionLoading}
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <PlayIcon />
                                {actionLoading ? 'Lancement...' : 'Lancer le Round 1'}
                            </FancyButton>
                        )}

                        {/* Playing - Show image preview + End round button */}
                        {status.game.status === 'playing' && status.round && (
                            <>
                                <div style={{ marginBottom: '1rem', position: 'relative', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden' }}>
                                    <Image
                                        src={status.round.imageUrl}
                                        alt="Round image"
                                        fill
                                        style={{ objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '1rem',
                                        left: '1rem',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: 'white',
                                        borderRadius: '8px',
                                        fontWeight: 600
                                    }}>
                                        Round {status.round.roundNumber}/{status.game.total_rounds}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <FancyButton
                                        onClick={handleEndRound}
                                        disabled={actionLoading}
                                        style={{ flex: 1, justifyContent: 'center' }}
                                    >
                                        <EyeIcon />
                                        {actionLoading ? 'Revelation...' : 'Reveler les résultats'}
                                    </FancyButton>
                                </div>

                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>
                                    {status.leaderboard.length} participant(s) ont guess
                                </p>
                            </>
                        )}

                        {/* Between rounds OR Finished - Show results + Next/End controls */}
                        {(status.game.status === 'between_rounds' || (status.game.status === 'finished' && roundResult)) && (
                            <>
                                {roundResult && (
                                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-base)', borderRadius: '12px' }}>
                                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckIcon />
                                            Résultats du {status.game.status === 'finished' ? 'Dernier Round' : 'Round'} : {roundResult.city}, {roundResult.country}
                                        </h3>

                                        {/* Results Map */}
                                        <div
                                            id="host-results-map"
                                            style={{ height: '300px', width: '100%', borderRadius: '8px', marginBottom: '1rem' }}
                                            ref={(el) => {
                                                if (el && leafletLoaded && !el.hasChildNodes()) {
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const L = (window as any).L as typeof import('leaflet')
                                                    if (!L) return

                                                    const map = L.map(el).setView([roundResult.correctLat, roundResult.correctLng], 4)
                                                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                                        attribution: '&copy; OpenStreetMap'
                                                    }).addTo(map)

                                                    // Green marker for correct location
                                                    const greenIcon = L.divIcon({
                                                        className: 'custom-icon',
                                                        html: '<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
                                                        iconSize: [24, 24],
                                                        iconAnchor: [12, 12]
                                                    })
                                                    L.marker([roundResult.correctLat, roundResult.correctLng], { icon: greenIcon })
                                                        .addTo(map)
                                                        .bindPopup(`<strong>Reponse correcte</strong><br>${roundResult.city}, ${roundResult.country}`)

                                                    // Red/pink markers for guesses
                                                    roundResult.results.forEach((guess, i) => {
                                                        const guessIcon = L.divIcon({
                                                            className: 'custom-icon',
                                                            html: `<div style="background:${i === 0 ? '#ff85c0' : '#ef4444'};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold">${i + 1}</div>`,
                                                            iconSize: [18, 18],
                                                            iconAnchor: [9, 9]
                                                        })
                                                        L.marker([guess.guessLat, guess.guessLng], { icon: guessIcon })
                                                            .addTo(map)
                                                            .bindPopup(`<strong>${guess.username}</strong><br>${guess.distanceKm.toFixed(1)} km - ${guess.points} pts`)
                                                    })

                                                    // Fit bounds to show all markers
                                                    const allPoints: [number, number][] = [
                                                        [roundResult.correctLat, roundResult.correctLng],
                                                        ...roundResult.results.map(g => [g.guessLat, g.guessLng] as [number, number])
                                                    ]
                                                    map.fitBounds(allPoints, { padding: [30, 30] })
                                                }
                                            }}
                                        />

                                        {/* Legend */}
                                        <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></span> Reponse</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ff85c0' }}></span> 1er</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></span> Autres</span>
                                        </div>
                                        {roundResult.results.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                                {roundResult.results.slice(0, 5).map((r, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: i === 0 ? 'rgba(255,133,192,0.1)' : 'transparent', borderRadius: '8px' }}>
                                                        <span>#{i + 1} {r.username}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{r.distanceKm} km</span>
                                                        <span style={{ fontWeight: 600, color: 'var(--pink-main)' }}>+{r.points}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {status.game.status === 'between_rounds' ? (
                                    <FancyButton
                                        onClick={handleStartRound}
                                        disabled={actionLoading}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        <SkipIcon />
                                        {actionLoading ? 'Lancement...' : `Lancer le Round ${status.game.current_round + 1}`}
                                    </FancyButton>
                                ) : (
                                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                                            <TrophyIcon />
                                        </div>
                                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Partie terminée !</h2>
                                        <FancyButton
                                            onClick={() => {
                                                if (status.game) {
                                                    const id = status.game.id
                                                    setIgnoredGameId(id)
                                                    ignoredGameIdRef.current = id
                                                }
                                                setStatus(null)
                                                setRoundResult(null)
                                            }}
                                            style={{ margin: '0 auto' }}
                                        >
                                            <PlusIcon />
                                            Nouvelle partie
                                        </FancyButton>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Finished without round results (if page refreshed) */}
                        {status.game.status === 'finished' && !roundResult && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                                    <TrophyIcon />
                                </div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Partie terminée !</h2>
                                <FancyButton
                                    onClick={() => {
                                        if (status.game) {
                                            const id = status.game.id
                                            setIgnoredGameId(id)
                                            ignoredGameIdRef.current = id
                                        }
                                        setStatus(null)
                                        setRoundResult(null)
                                    }}
                                    style={{ margin: '0 auto' }}
                                >
                                    <PlusIcon />
                                    Nouvelle partie
                                </FancyButton>
                            </div>
                        )}
                    </div>

                    {/* Live Leaderboard */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <TrophyIcon />
                            Leaderboard
                        </h3>

                        {status.leaderboard.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                                Aucun participant pour le moment
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {status.leaderboard.map((player, index) => (
                                    <div key={player.playerId} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        padding: '0.75rem',
                                        background: index === 0 ? 'linear-gradient(135deg, rgba(255,133,192,0.15), rgba(255,133,192,0.05))' : 'var(--bg-base)',
                                        borderRadius: '10px',
                                        border: index === 0 ? '1px solid var(--pink-main)' : 'none'
                                    }}>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: index < 3 ? '1.25rem' : '1rem',
                                            width: '32px',
                                            color: index < 3 ? 'var(--pink-main)' : 'var(--text-muted)'
                                        }}>
                                            #{index + 1}
                                        </span>
                                        <Image
                                            src={`https://api.dicebear.com/7.x/notionists/png?seed=${player.avatar_seed || player.username}`}
                                            alt={player.username}
                                            width={36}
                                            height={36}
                                            style={{ borderRadius: '50%' }}
                                        />
                                        <span style={{ flex: 1, fontWeight: 500 }}>{player.username}</span>
                                        {status.game?.status !== 'playing' && (
                                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--pink-main)' }}>
                                                {player.totalPoints} pts
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
