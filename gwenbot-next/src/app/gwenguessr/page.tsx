'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import FancyButton from '@/components/ui/fancy-button'
import { useToast } from '@/components/toast-context'
import type * as LType from 'leaflet'

// Leaflet CSS is loaded dynamically
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

// SVG Icons (Lucide-style)
const MapPinIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
)

const ClockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
    </svg>
)

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

const TargetIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
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
    roundGuesses?: Array<{
        playerId: number
        username: string
        guessLat: number
        guessLng: number
        distanceKm: number
        points: number
    }>
}

export default function GwenGuessrPage() {
    const [status, setStatus] = useState<GameStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [guessSubmitted, setGuessSubmitted] = useState(false)
    const [selectedLat, setSelectedLat] = useState<number | null>(null)
    const [selectedLng, setSelectedLng] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [leafletLoaded, setLeafletLoaded] = useState(false)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<LType.Map | null>(null)
    const markerRef = useRef<LType.Marker | null>(null)
    const { showToast } = useToast()

    // Load Leaflet dynamically
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Load CSS
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = LEAFLET_CSS
            document.head.appendChild(link)
        }

        // Load JS
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => setLeafletLoaded(true)
        document.body.appendChild(script)

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [])

    // Initialize map when Leaflet is loaded and we have an active round
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!leafletLoaded || !mapContainerRef.current) return
        if (!status?.game || status.game.status !== 'playing') return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L as typeof import('leaflet')
        if (!L) return

        // Check if map is already initialized on this container
        const container = mapContainerRef.current as unknown as { _leaflet_id?: string }
        if (container._leaflet_id) {
            // Already initialized, try to reuse or destroy
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            } else {
                // If container claims to be initialized but we lost the ref, clear the id
                container._leaflet_id = undefined
            }
        }

        if (mapRef.current) return

        try {
            const map = L.map(mapContainerRef.current).setView([20, 0], 2)
            mapRef.current = map

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map)

            map.on('click', (e: LType.LeafletMouseEvent) => {
                if (guessSubmitted) return

                setSelectedLat(e.latlng.lat)
                setSelectedLng(e.latlng.lng)

                if (markerRef.current) {
                    markerRef.current.setLatLng(e.latlng)
                } else {
                    markerRef.current = L.marker(e.latlng, {
                        icon: L.divIcon({
                            className: 'custom-marker',
                            html: '<div style="width:24px;height:24px;background:var(--pink-main);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(map)
                }
            })
        } catch (e) {
            console.error('Leaflet init error:', e)
        }
    }, [leafletLoaded, status?.game?.status, guessSubmitted])

    // Fetch game status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/gwenguessr/status')
            const data = await res.json()
            setStatus(data)

            // Reset guess state on new round
            if (data.game?.status === 'playing') {
                // Check if we already guessed this round
                // For now, reset on each fetch
            }
        } catch (error) {
            console.error('Status fetch error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 3000)
        return () => clearInterval(interval)
    }, [fetchStatus])

    // Submit guess
    const handleSubmitGuess = async () => {
        if (selectedLat === null || selectedLng === null) {
            showToast('Cliquez sur la carte pour placer votre guess', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/gwenguessr/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: selectedLat, lng: selectedLng })
            })

            const data = await res.json()

            if (!res.ok) {
                showToast(data.error || 'Erreur', 'error')
                return
            }

            setGuessSubmitted(true)
            showToast('Guess envoye ! Attendez les résultats.', 'success')
        } catch (error) {
            showToast('Erreur lors de la soumission', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Reset state on new round
    useEffect(() => {
        if (status?.round?.roundNumber) {
            setGuessSubmitted(false)
            setSelectedLat(null)
            setSelectedLng(null)
            if (markerRef.current && mapRef.current) {
                mapRef.current.removeLayer(markerRef.current)
                markerRef.current = null
            }
        }
    }, [status?.round?.roundNumber])

    if (loading) {
        return (
            <div className="animate-slideIn" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ animation: 'pulse 1.5s infinite' }}>Chargement...</div>
            </div>
        )
    }

    // No active game
    if (!status?.game) {
        return (
            <div className="animate-slideIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <TargetIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr</h1>
                    <div style={{ marginLeft: 'auto' }}>
                        <a
                            href="/gwenguessr/host"
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(255,133,192,0.1)',
                                color: 'var(--pink-main)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                border: '1px solid rgba(255,133,192,0.2)'
                            }}
                        >
                            Accès Host
                        </a>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>
                        <MapPinIcon />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Aucune partie en cours</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Attendez que la streameuse lance une partie !
                    </p>
                </div>
            </div>
        )
    }

    // Waiting in lobby
    if (status.game.status === 'lobby') {
        return (
            <div className="animate-slideIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <TargetIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr</h1>
                    <div style={{ marginLeft: 'auto' }}>
                        <a
                            href="/gwenguessr/host"
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(255,133,192,0.1)',
                                color: 'var(--pink-main)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                border: '1px solid rgba(255,133,192,0.2)'
                            }}
                        >
                            Accès Host
                        </a>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ animation: 'pulse 2s infinite', marginBottom: '1rem' }}>
                        <ClockIcon />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Partie en preparation...</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {status.game.total_rounds} rounds - La partie va bientot commencer !
                    </p>
                </div>
            </div>
        )
    }

    // Between rounds - show results with map
    if (status.game.status === 'between_rounds' && status.round) {
        return (
            <div className="animate-slideIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <TargetIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr</h1>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                            Round {status.round.roundNumber}/{status.game.total_rounds}
                        </span>
                        <a
                            href="/gwenguessr/host"
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(255,133,192,0.1)',
                                color: 'var(--pink-main)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                border: '1px solid rgba(255,133,192,0.2)'
                            }}
                        >
                            Accès Host
                        </a>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckIcon />
                        Résultats du round
                    </h2>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--pink-main)' }}>
                        {status.round.city}, {status.round.country}
                    </p>
                </div>

                {/* Results Map */}
                {status.round.correctLat && status.round.correctLng && (
                    <div className="glass-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPinIcon /> Carte des résultats
                            </h3>
                        </div>
                        <div
                            id="results-map"
                            style={{ height: '300px', width: '100%' }}
                            ref={(el) => {
                                if (el && leafletLoaded && !el.hasChildNodes()) {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const L = (window as any).L as typeof import('leaflet')
                                    if (!L) return

                                    const map = L.map(el).setView([status.round!.correctLat!, status.round!.correctLng!], 4)
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
                                    L.marker([status.round!.correctLat!, status.round!.correctLng!], { icon: greenIcon })
                                        .addTo(map)
                                        .bindPopup(`<strong>Reponse correcte</strong><br>${status.round!.city}, ${status.round!.country}`)

                                    // Red/pink markers for guesses
                                    status.roundGuesses?.forEach((guess, i) => {
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
                                    if (status.roundGuesses && status.roundGuesses.length > 0) {
                                        const allPoints: [number, number][] = [
                                            [status.round!.correctLat!, status.round!.correctLng!],
                                            ...status.roundGuesses.map(g => [g.guessLat, g.guessLng] as [number, number])
                                        ]
                                        map.fitBounds(allPoints, { padding: [30, 30] })
                                    }
                                }
                            }}
                        />
                        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-base)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', marginRight: '4px' }}></span> Reponse</span>
                            <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ff85c0', marginRight: '4px' }}></span> 1er</span>
                            <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', marginRight: '4px' }}></span> Autres</span>
                        </div>
                    </div>
                )}

                {/* Leaderboard */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Classement</h3>
                    {status.leaderboard.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aucun participant</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {status.leaderboard.slice(0, 10).map((player, index) => (
                                <div key={player.playerId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.5rem',
                                    background: index === 0 ? 'rgba(255,133,192,0.1)' : 'transparent',
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ fontWeight: 700, width: '24px', color: index < 3 ? 'var(--pink-main)' : 'var(--text-muted)' }}>
                                        #{index + 1}
                                    </span>
                                    <span style={{ flex: 1 }}>{player.username}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--pink-main)' }}>
                                        {player.totalPoints} pts
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Game finished
    if (status.game.status === 'finished') {
        return (
            <div className="animate-slideIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <TargetIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>GwenGuessr - Termine !</h1>
                    <div style={{ marginLeft: 'auto' }}>
                        <a
                            href="/gwenguessr/host"
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(255,133,192,0.1)',
                                color: 'var(--pink-main)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                border: '1px solid rgba(255,133,192,0.2)'
                            }}
                        >
                            Accès Host
                        </a>
                    </div>
                </div>

                {status.round && (
                    <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckIcon />
                            Reponse finale ({status.round.city}, {status.round.country})
                        </h2>

                        {/* Results Map */}
                        <div
                            id="final-results-map"
                            style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}
                            ref={(el) => {
                                if (el && leafletLoaded && !el.hasChildNodes()) {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const L = (window as any).L as typeof import('leaflet')
                                    if (!L) return

                                    const map = L.map(el).setView([status.round!.correctLat!, status.round!.correctLng!], 4)
                                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                        attribution: '&copy; OpenStreetMap'
                                    }).addTo(map)

                                    const greenIcon = L.divIcon({
                                        className: 'custom-icon',
                                        html: '<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
                                        iconSize: [24, 24],
                                        iconAnchor: [12, 12]
                                    })
                                    L.marker([status.round!.correctLat!, status.round!.correctLng!], { icon: greenIcon })
                                        .addTo(map)
                                        .bindPopup(`<strong>Reponse correcte</strong><br>${status.round!.city}, ${status.round!.country}`)

                                    status.roundGuesses?.forEach((guess, i) => {
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

                                    if (status.roundGuesses && status.roundGuesses.length > 0) {
                                        const allPoints: [number, number][] = [
                                            [status.round!.correctLat!, status.round!.correctLng!],
                                            ...status.roundGuesses.map(g => [g.guessLat, g.guessLng] as [number, number])
                                        ]
                                        map.fitBounds(allPoints, { padding: [30, 30] })
                                    }
                                }
                            }}
                        />
                    </div>
                )}

                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Classement Final</h2>
                    {status.leaderboard.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aucun participant</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {status.leaderboard.map((player, index) => (
                                <div key={player.playerId} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: index === 0 ? 'linear-gradient(135deg, rgba(255,133,192,0.2), rgba(255,133,192,0.05))' : 'var(--bg-base)',
                                    borderRadius: '12px',
                                    border: index === 0 ? '2px solid var(--pink-main)' : '1px solid var(--border-color)'
                                }}>
                                    <span style={{
                                        fontSize: index === 0 ? '1.5rem' : '1rem',
                                        fontWeight: 700,
                                        width: '36px',
                                        color: index < 3 ? 'var(--pink-main)' : 'var(--text-muted)'
                                    }}>
                                        #{index + 1}
                                    </span>
                                    <Image
                                        src={`https://api.dicebear.com/7.x/notionists/png?seed=${player.avatar_seed || player.username}`}
                                        alt={player.username}
                                        width={40}
                                        height={40}
                                        style={{ borderRadius: '50%' }}
                                    />
                                    <span style={{ flex: 1, fontWeight: 500 }}>{player.username}</span>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--pink-main)' }}>
                                        {player.totalPoints} pts
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Playing - main game view
    return (
        <div className="animate-slideIn">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <TargetIcon />
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>GwenGuessr</h1>
                <span style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem', background: 'var(--pink-main)', color: 'white', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                    Round {status.round?.roundNumber}/{status.game.total_rounds}
                </span>
            </div>

            {/* Instructions - image is on stream */}
            <div className="glass-card" style={{ marginBottom: '1rem', padding: '1rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Regardez l'image sur le stream et cliquez sur la carte pour deviner l'emplacement !
                </p>
            </div>

            {/* Map */}
            <div className="glass-card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPinIcon />
                        Placez votre guess
                    </span>
                    {selectedLat !== null && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {selectedLat.toFixed(3)}, {selectedLng?.toFixed(3)}
                        </span>
                    )}
                </div>
                <div ref={mapContainerRef} style={{ height: '300px', width: '100%' }} />
            </div>

            {/* Submit button */}
            {guessSubmitted ? (
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(34,197,94,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#22c55e' }}>
                        <CheckIcon />
                        <span style={{ fontWeight: 600 }}>Guess envoye !</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        Regardez le stream pour voir les résultats
                    </p>
                </div>
            ) : (
                <FancyButton
                    onClick={handleSubmitGuess}
                    disabled={selectedLat === null || submitting}
                    style={{ width: '100%', justifyContent: 'center', opacity: selectedLat === null ? 0.5 : 1 }}
                >
                    {submitting ? 'Envoi...' : 'Confirmer mon guess'}
                </FancyButton>
            )}

            {/* Mini leaderboard */}
            {status.leaderboard.length > 0 && (
                <div className="glass-card" style={{ marginTop: '1rem', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Top 5</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                        {status.leaderboard.slice(0, 5).map((player, index) => (
                            <div key={player.playerId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>#{index + 1} {player.username}</span>
                                <span style={{ color: 'var(--pink-main)', fontWeight: 600 }}>{player.totalPoints}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
