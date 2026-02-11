'use client'

import { useState, useEffect, useCallback } from 'react'

interface GridCell {
    text: string
    isFree: boolean
}

interface Player {
    username: string
    grid: GridCell[]
    checked: boolean[]
    validChecked: boolean[]
    validCheckedCount: number
    hasBingo: boolean
}

interface LiveData {
    active: boolean
    items?: string[]
    validated_items?: boolean[]
    validatedCount?: number
    players?: Player[]
    participantCount?: number
    winners?: { position: number; username: string }[]
}

export default function BingoLiveView() {
    const [data, setData] = useState<LiveData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchLive = useCallback(async () => {
        try {
            const res = await fetch('/api/bingo/live')
            const json = await res.json()
            setData(json)
        } catch {
            setData({ active: false })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLive()
        const interval = setInterval(fetchLive, 3000)
        return () => clearInterval(interval)
    }, [fetchLive])

    if (loading) {
        return (
            <div className="main-content" style={{ paddingTop: '7rem', textAlign: 'center' }}>
                <div style={{
                    width: 32, height: 32, margin: '0 auto 1rem',
                    border: '3px solid rgba(240,119,170,0.15)',
                    borderTopColor: '#f077aa',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite'
                }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (!data?.active) {
        return (
            <div className="main-content" style={{ paddingTop: '7rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Bingo Live View</h1>
                <p style={{ color: 'var(--text-muted)' }}>Aucune session de bingo en cours.</p>
            </div>
        )
    }

    const { players = [], participantCount = 0, validatedCount = 0, items = [], winners = [] } = data

    return (
        <div className="main-content" style={{ paddingTop: '7rem', maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    🎯 Bingo — Live View
                </h1>

                {/* Stats bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    marginTop: '0.75rem'
                }}>
                    <StatBadge label="Participants" value={participantCount} color="#f077aa" />
                    <StatBadge label="Items validés" value={`${validatedCount}/${items.length}`} color="#6ec77a" />
                    <StatBadge label="Cartes" value={players.length} color="#8b8bdb" />
                    {winners.length > 0 && (
                        <StatBadge label="Gagnants" value={winners.length} color="#ffd700" />
                    )}
                </div>
            </div>

            {/* Players grid */}
            {players.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                    Aucun joueur pour le moment...
                </p>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1rem',
                    padding: '0 0.5rem'
                }}>
                    {players.map((player, i) => (
                        <PlayerCard key={i} player={player} rank={i + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '50px',
            background: 'var(--bg-card)',
            border: `1px solid ${color}33`,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
        }}>
            <span style={{ fontWeight: 700, color }}>{value}</span>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        </div>
    )
}

function PlayerCard({ player, rank }: { player: Player; rank: number }) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
    // Count valid checked excluding free space
    const score = player.validChecked.filter((v, i) => v && i !== 12).length

    return (
        <div style={{
            borderRadius: '14px',
            border: `1px solid ${player.hasBingo ? 'rgba(255,215,0,0.4)' : 'var(--border-color)'}`,
            background: player.hasBingo
                ? 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))'
                : 'var(--bg-card)',
            padding: '0.75rem',
            transition: 'all 0.3s ease'
        }}>
            {/* Player header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    overflow: 'hidden'
                }}>
                    {medal && <span style={{ fontSize: '0.9rem' }}>{medal}</span>}
                    <span style={{
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        color: player.hasBingo ? '#ffd700' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {player.username}
                    </span>
                </div>
                <span style={{
                    fontSize: '0.7rem',
                    background: score > 0 ? 'rgba(110,199,122,0.1)' : 'transparent',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    color: score > 0 ? '#6ec77a' : 'var(--text-muted)'
                }}>
                    {score}/24
                </span>
            </div>

            {/* Mini bingo grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '2px',
                aspectRatio: '1'
            }}>
                {player.grid.map((cell, idx) => {
                    const isValid = player.validChecked[idx]
                    const isFree = idx === 12

                    return (
                        <div
                            key={idx}
                            title={cell.text}
                            style={{
                                borderRadius: '3px',
                                background: isFree
                                    ? 'rgba(240,119,170,0.25)'
                                    : isValid
                                        ? 'rgba(110,199,122,0.5)'
                                        : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isValid ? 'rgba(110,199,122,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.35rem',
                                color: isValid ? '#fff' : 'rgba(255,255,255,0.15)',
                                overflow: 'hidden',
                                lineHeight: 1.1,
                                textAlign: 'center',
                                padding: '1px',
                                wordBreak: 'break-all',
                                transition: 'background 0.3s ease'
                            }}
                        >
                            {isFree ? '⭐' : (isValid ? '✓' : '')}
                        </div>
                    )
                })}
            </div>

            {/* Bingo badge */}
            {player.hasBingo && (
                <div style={{
                    marginTop: '0.4rem',
                    textAlign: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#ffd700',
                    letterSpacing: '0.05em'
                }}>
                    🎉 BINGO !
                </div>
            )}
        </div>
    )
}
