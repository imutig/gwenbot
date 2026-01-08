'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

interface Guess {
    id: number
    word: string
    similarity: number
    username: string
    guessed_at: string
}

interface Session {
    id: number
    started_at: string
    total_guesses: number
}

interface LastSession {
    id: number
    secret_word: string
    started_at: string
    finished_at: string
    total_guesses: number
    winner: string | null
}

export default function CemantigPage() {
    const [isActive, setIsActive] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const [lastSession, setLastSession] = useState<LastSession | null>(null)
    const [topGuesses, setTopGuesses] = useState<Guess[]>([])
    const [recentGuesses, setRecentGuesses] = useState<Guess[]>([])
    const [loading, setLoading] = useState(true)
    const [secretWord, setSecretWord] = useState('')
    const [message, setMessage] = useState<string | null>(null)

    // Mock user - in production get from auth
    const [user, setUser] = useState<{ username: string; isAdmin: boolean } | null>(null)

    // Check if user is admin
    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/session')
            const data = await res.json()

            if (data.user) {
                // Check if user is in authorized_users
                const authRes = await fetch(`/api/auth/check-admin?username=${data.user.display_name}`)
                const authData = await authRes.json()

                setUser({
                    username: data.user.display_name,
                    isAdmin: authData.isAdmin || false
                })
            }
        } catch (error) {
            console.error('Error checking auth:', error)
        }
    }, [])

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/cemantig/status')
            const data = await res.json()

            setIsActive(data.active)

            if (data.active && data.session) {
                setSession(data.session)
                setTopGuesses(data.topGuesses || [])
                setRecentGuesses(data.recentGuesses || [])
                setLastSession(null)
            } else {
                setSession(null)
                if (data.lastSession) {
                    setLastSession(data.lastSession)
                    // Keep showing the guesses from the finished session
                    setTopGuesses(data.lastSession.topGuesses || [])
                    setRecentGuesses(data.lastSession.recentGuesses || [])
                }
            }
        } catch (error) {
            console.error('Error fetching status:', error)
        }
        setLoading(false)
    }, [])

    // Initial load
    useEffect(() => {
        checkAuth()
        fetchStatus()
    }, [checkAuth, fetchStatus])

    // Subscribe to Realtime updates via Broadcast
    useEffect(() => {
        if (!supabase) {
            console.log('[Cemantig] Supabase not available for Realtime')
            return
        }

        console.log('[Cemantig] Setting up Broadcast subscription...')

        const channel = supabase
            .channel('cemantig-broadcast')
            .on('broadcast', { event: 'new_guess' }, (payload) => {
                console.log('[Cemantig] New guess received via broadcast:', payload)
                fetchStatus()
            })
            .subscribe((status) => {
                console.log('[Cemantig] Broadcast subscription status:', status)
            })

        return () => {
            console.log('[Cemantig] Cleaning up Broadcast subscription')
            supabase.removeChannel(channel)
        }
    }, [fetchStatus])



    const handleStartSession = async () => {
        if (!secretWord.trim()) {
            setMessage('Entre un mot secret')
            return
        }

        try {
            const res = await fetch('/api/cemantig/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user?.username,
                    secret_word: secretWord
                })
            })
            const data = await res.json()

            if (data.success) {
                setSecretWord('')
                setMessage('Session démarrée !')
                fetchStatus()
            } else {
                setMessage(data.error || 'Erreur')
            }
        } catch (error) {
            console.error('Error starting session:', error)
            setMessage('Erreur de connexion')
        }
    }

    const handleEndSession = async () => {
        try {
            const res = await fetch('/api/cemantig/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user?.username })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`Session terminée. Le mot était "${data.secret_word}"`)
                fetchStatus()
            } else {
                setMessage(data.error || 'Erreur')
            }
        } catch (error) {
            console.error('Error ending session:', error)
            setMessage('Erreur de connexion')
        }
    }

    // Convert similarity (0-1000) to temperature (-100 to 100)
    // Based on Cemantix scale from the image
    const getTemperature = (similarity: number): number => {
        if (similarity === 1000) return 100.00
        if (similarity === 999) return 59.04
        if (similarity >= 990) return 51.03 + (similarity - 990) * 0.89 // 990-999 maps to ~51-59
        if (similarity >= 900) return 42.05 + (similarity - 900) * 0.10 // 900-989 maps to ~42-51
        if (similarity >= 400) return 31.96 + (similarity - 400) * 0.02 // 400-899 maps to ~32-42
        if (similarity >= 150) return 0 + (similarity - 150) * 0.128 // 150-399 maps to 0-32
        if (similarity >= 1) return -100 + (similarity - 1) * 0.67 // 1-149 maps to -100 to 0
        return -100
    }

    const getSimilarityEmoji = (similarity: number) => {
        if (similarity === 1000) return '🎉'
        if (similarity === 999) return '😲'
        if (similarity >= 990) return '🔥'
        if (similarity >= 900) return '🥵'
        if (similarity >= 400) return '😎'
        if (similarity >= 150) return '🥶'
        return '🧊'
    }

    const getSimilarityColor = (similarity: number) => {
        if (similarity >= 990) return '#ef4444' // red
        if (similarity >= 900) return '#f97316' // orange
        if (similarity >= 400) return '#eab308' // yellow
        if (similarity >= 150) return '#22c55e' // green
        return '#3b82f6' // blue
    }

    const formatTemperature = (similarity: number): string => {
        const temp = getTemperature(similarity)
        return temp.toFixed(2) + '°C'
    }

    if (loading) {
        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Chargement...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '900px', padding: '1rem' }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: '1rem',
                    color: 'var(--text-primary)'
                }}>
                    Cemantig
                </h1>

                {/* How to play instructions */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    textAlign: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Pour deviner, tape dans le chat :
                        </span>
                        <code style={{
                            background: 'var(--pink-accent)',
                            color: 'white',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '1rem'
                        }}>
                            !g ton_mot
                        </code>
                    </div>
                </div>

                {/* Admin Controls */}
                {user?.isAdmin && (
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Admin</h3>

                        {!isActive ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={secretWord}
                                    onChange={(e) => setSecretWord(e.target.value)}
                                    placeholder="Mot secret..."
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleStartSession}
                                >
                                    Démarrer
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-secondary"
                                onClick={handleEndSession}
                                style={{ width: '100%' }}
                            >
                                Terminer la session
                            </button>
                        )}

                        {message && (
                            <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                {message}
                            </p>
                        )}
                    </div>
                )}

                {/* Winner Banner - Show when session just ended */}
                {!isActive && lastSession && lastSession.winner && (
                    <div style={{
                        background: 'linear-gradient(135deg, var(--pink-accent), var(--pink-main))',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        color: 'white'
                    }}>
                        <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px' }}>
                                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                <path d="M4 22h16" />
                                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
                                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
                                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                            </svg>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {lastSession.winner} a trouvé le mot !
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                            &quot;{lastSession.secret_word}&quot;
                        </div>
                        <div style={{ marginTop: '0.5rem', opacity: 0.9, fontSize: '0.9rem' }}>
                            {lastSession.total_guesses} essais au total
                        </div>
                    </div>
                )}

                {/* Session Grids - Show for both active sessions AND finished sessions with results */}
                {(isActive && session) || (!isActive && lastSession && topGuesses.length > 0) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Top 10 */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                Top 10 - Plus proches
                            </h3>

                            {topGuesses.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aucun guess</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {topGuesses.map((guess, i) => (
                                        <div key={guess.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'var(--bg-card)',
                                            borderRadius: '8px'
                                        }}>
                                            <span style={{
                                                fontWeight: 700,
                                                color: i < 3 ? 'var(--pink-accent)' : 'var(--text-muted)',
                                                width: '24px'
                                            }}>
                                                #{i + 1}
                                            </span>
                                            <span style={{ flex: 1, fontWeight: 500 }}>{guess.word}</span>
                                            <span style={{ width: '28px', textAlign: 'center' }}>
                                                {getSimilarityEmoji(guess.similarity)}
                                            </span>
                                            <span style={{
                                                fontWeight: 700,
                                                color: getSimilarityColor(guess.similarity),
                                                fontFamily: 'monospace',
                                                minWidth: '80px',
                                                textAlign: 'right'
                                            }}>
                                                {formatTemperature(guess.similarity)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Guesses */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Historique ({session?.total_guesses || lastSession?.total_guesses || 0} total)
                            </h3>

                            {recentGuesses.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Aucun guess</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                                    {recentGuesses.map((guess) => (
                                        <div key={guess.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.5rem 0.75rem',
                                            background: 'var(--bg-card)',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}>
                                            <span style={{ color: 'var(--pink-accent)', fontWeight: 500 }}>
                                                {guess.username}
                                            </span>
                                            <span style={{ flex: 1 }}>{guess.word}</span>
                                            <span style={{ fontSize: '1rem' }}>
                                                {getSimilarityEmoji(guess.similarity)}
                                            </span>
                                            <span style={{
                                                fontWeight: 600,
                                                color: getSimilarityColor(guess.similarity),
                                                fontFamily: 'monospace',
                                                minWidth: '70px',
                                                textAlign: 'right'
                                            }}>
                                                {formatTemperature(guess.similarity)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* No Active Session */
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
                            Pas de session en cours
                        </h2>

                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Attends que le streamer lance une session Cemantig !
                        </p>

                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Tape <code style={{ background: 'var(--bg-card)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>!guess mot</code> dans le chat pour proposer un mot.
                        </p>

                        {/* Last Session Info */}
                        {lastSession && (
                            <div style={{
                                marginTop: '2rem',
                                padding: '1rem',
                                background: 'var(--bg-card)',
                                borderRadius: '12px',
                                textAlign: 'center',
                                maxWidth: '300px',
                                margin: '2rem auto 0'
                            }}>
                                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Dernière session</h4>
                                <p>
                                    <strong>Mot :</strong> {lastSession.secret_word}
                                </p>
                                <p>
                                    <strong>Gagnant :</strong> {lastSession.winner || 'Personne'}
                                </p>
                                <p>
                                    <strong>Guesses :</strong> {lastSession.total_guesses}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
