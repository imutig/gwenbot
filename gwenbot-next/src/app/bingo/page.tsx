'use client'

import { useState, useEffect, useCallback } from 'react'

interface BingoSession {
    active: boolean
    sessionId?: string
    items?: string[]
    validated_items?: boolean[]
    winners?: { position: number; username: string; time: string }[]
}

export default function BingoAdminPage() {
    const [session, setSession] = useState<BingoSession | null>(null)
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<number | null>(null)

    const fetchSession = useCallback(async () => {
        try {
            const res = await fetch('/api/bingo/session')
            const data = await res.json()
            setSession(data)
        } catch {
            setSession({ active: false })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchSession()
        const interval = setInterval(fetchSession, 5000)
        return () => clearInterval(interval)
    }, [fetchSession])

    const toggleValidation = async (index: number) => {
        if (toggling !== null) return
        setToggling(index)
        try {
            const res = await fetch('/api/bingo/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIndex: index })
            })
            const data = await res.json()
            if (data.validated_items && session) {
                setSession({ ...session, validated_items: data.validated_items })
            }
        } catch (err) {
            console.error('Validation error:', err)
        } finally {
            setToggling(null)
        }
    }

    if (loading) {
        return (
            <div className="main-content" style={{ paddingTop: '7rem' }}>
                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <div style={{
                        width: 32, height: 32, margin: '0 auto 1rem',
                        border: '3px solid rgba(240,119,170,0.15)',
                        borderTopColor: '#f077aa',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite'
                    }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (!session?.active) {
        return (
            <div className="main-content" style={{ paddingTop: '7rem' }}>
                <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        Bingo
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Aucune session de bingo en cours.<br />
                        Lance un bingo depuis le Live Dashboard Twitch pour commencer !
                    </p>
                </div>
            </div>
        )
    }

    const { items = [], validated_items = [], winners = [] } = session
    const validatedCount = validated_items.filter(Boolean).length

    return (
        <div className="main-content" style={{ paddingTop: '7rem', maxWidth: '800px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    🎯 Bingo — Validation
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Clique sur un item quand il se passe pendant le stream !
                </p>
                <div style={{
                    display: 'inline-block',
                    marginTop: '0.75rem',
                    padding: '0.35rem 1rem',
                    borderRadius: '50px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                }}>
                    {validatedCount} / {items.length} validés
                </div>
            </div>

            {/* Items grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.5rem',
                padding: '0 1rem'
            }}>
                {items.map((item, index) => {
                    const isValidated = validated_items[index] || false
                    const isToggling = toggling === index

                    return (
                        <button
                            key={index}
                            onClick={() => toggleValidation(index)}
                            disabled={isToggling}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                border: `1px solid ${isValidated ? 'rgba(110, 199, 122, 0.3)' : 'var(--border-color)'}`,
                                background: isValidated ? 'rgba(110, 199, 122, 0.1)' : 'var(--bg-card)',
                                color: isValidated ? '#6ec77a' : 'var(--text-primary)',
                                cursor: isToggling ? 'wait' : 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left',
                                fontFamily: 'inherit',
                                fontSize: '0.85rem',
                                fontWeight: isValidated ? 600 : 400,
                                opacity: isToggling ? 0.6 : 1,
                            }}
                        >
                            <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: `2px solid ${isValidated ? '#6ec77a' : 'var(--border-color)'}`,
                                background: isValidated ? '#6ec77a' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: '0.7rem',
                                color: 'white',
                                transition: 'all 0.2s ease'
                            }}>
                                {isValidated && '✓'}
                            </span>
                            <span style={{
                                textDecoration: isValidated ? 'none' : 'none',
                            }}>
                                {item}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Winners */}
            {winners.length > 0 && (
                <div style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)'
                }}>
                    <h3 style={{ fontSize: '1rem', color: '#ffd700', textAlign: 'center', marginBottom: '0.75rem' }}>
                        🏆 Gagnants
                    </h3>
                    {winners.map((w, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(255, 215, 0, 0.06)',
                            marginBottom: '0.25rem',
                            fontSize: '0.85rem'
                        }}>
                            <span style={{ fontWeight: 600, color: '#ffd700' }}>
                                {w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : w.position === 3 ? '🥉' : `#${w.position}`}
                            </span>
                            <span>{w.username}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
