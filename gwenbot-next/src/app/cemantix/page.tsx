'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Loader from '@/components/ui/loader'
import { useToast } from '@/components/toast-context'

const styles = `
  .cemantix-card {
    background: var(--bg-card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-color);
    border-radius: 30px;
    box-shadow: 0 8px 32px 0 var(--shadow-color);
    width: 100%;
    max-width: 500px;
    overflow: hidden;
  }
  .toggle-btn { transition: all 0.3s; background: transparent; color: var(--text-muted); }
  .toggle-btn.active { background-color: var(--pink-accent); color: white; }
  .leaderboard-item { transition: transform 0.2s; border-radius: 15px; }
  .leaderboard-item:hover { transform: scale(1.02); background: var(--bg-card-hover); }
  .rank-badge { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; }
  .rank-1 { background: linear-gradient(45deg, #FFD700, #FDB931); color: white; }
  .rank-2 { background: linear-gradient(45deg, #C0C0C0, #E8E8E8); color: white; }
  .rank-3 { background: linear-gradient(45deg, #CD7F32, #E9967A); color: white; }
  .cemantix-section { background: var(--bg-input); border-radius: 16px; padding: 0.75rem; }
  .cemantix-inner-card { background: var(--bg-card); border-radius: 12px; padding: 0.5rem; text-align: center; }
`

// SVG Icons
const TrophyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
)

const ZapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
)

const HistoryIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
    </svg>
)

interface Records {
    fr: { alltime: { score: number, date: string } | null; monthly: { score: number, date: string } | null }
    en: { alltime: { score: number, date: string } | null; monthly: { score: number, date: string } | null }
}

interface LeaderboardEntry {
    user: string
    points: number
}

interface HistoryEntry {
    id: number
    date: string
    lang: string
    word: string
    winner: string
    guessCount: number
    playerCount: number
}

export default function CemantixPage() {
    const { showToast } = useToast()
    const [records, setRecords] = useState<Records | null>(null)
    const [activeTab, setActiveTab] = useState<'session' | 'global' | 'history'>('session')
    const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([])
    const [sessionLeaderboard, setSessionLeaderboard] = useState<LeaderboardEntry[]>([])
    const [sessionActive, setSessionActive] = useState(false)
    const [sessionLang, setSessionLang] = useState('fr')
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [currentUser, setCurrentUser] = useState<string | null>(null)
    const [sessionLoading, setSessionLoading] = useState(false)
    const supabase = createClient()

    // Check if user is admin
    useEffect(() => {
        if (!supabase) return

        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const username = (
                    user.user_metadata?.user_name ||
                    user.user_metadata?.preferred_username ||
                    user.user_metadata?.name ||
                    user.email?.split('@')[0]
                )?.toLowerCase()

                if (username) {
                    setCurrentUser(username)
                    const res = await fetch(`/api/auth/check-admin?username=${username}`)
                    const data = await res.json()
                    setIsAdmin(data.isAdmin)
                }
            }
        }
        checkAdmin()
    }, [supabase])

    // Load records
    useEffect(() => {
        fetch('/api/records')
            .then(res => res.json())
            .then(data => setRecords(data))
            .catch(err => console.error('Error loading records:', err))
    }, [])

    // Load leaderboard
    const loadLeaderboard = useCallback(() => {
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => {
                setGlobalLeaderboard(data.globalLeaderboard || [])
                setSessionLeaderboard(data.sessionLeaderboard || [])
                setSessionActive(data.sessionActive || false)
                setSessionLang(data.lang || 'fr')
                setLoading(false)
            })
            .catch(err => {
                console.error('Error loading leaderboard:', err)
                setLoading(false)
            })
    }, [])

    useEffect(() => {
        loadLeaderboard()
    }, [loadLeaderboard])

    // Subscribe to Realtime updates via Broadcast
    useEffect(() => {
        if (!supabase) return

        const channel = supabase
            .channel('cemantix-broadcast')
            .on('broadcast', { event: 'new_guess' }, () => {
                loadLeaderboard()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [supabase, loadLeaderboard])


    // Load history callback
    const loadHistory = useCallback(() => {
        fetch('/api/history')
            .then(res => res.json())
            .then(data => setHistory(data.history || []))
            .catch(err => console.error('Error loading history:', err))
    }, [])

    // Load history when tab changes
    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory()
        }
    }, [activeTab, loadHistory])

    // Delete session handler
    const deleteSession = async (sessionId: number) => {
        if (!confirm('Supprimer cette session ? Les points associés seront annulés.')) return

        try {
            const res = await fetch('/api/session/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, username: currentUser })
            })
            const data = await res.json()
            if (data.success) {
                loadHistory()
                loadLeaderboard()
            } else {
                alert(data.error || 'Erreur lors de la suppression')
            }
        } catch (error) {
            console.error('Delete session error:', error)
            alert('Erreur lors de la suppression')
        }
    }

    const formatRecord = (record: { score: number, date: string } | null) => {
        return record?.score ? record.score.toString() : '-'
    }

    const handleStartSession = async (lang: 'fr' | 'en') => {
        setSessionLoading(true)
        try {
            const res = await fetch('/api/cemantix/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', lang })
            })
            const data = await res.json()
            if (data.success) {
                showToast(`Session ${lang === 'fr' ? 'Cémantix 🇫🇷' : 'Cemantle 🇬🇧'} lancée !`, 'success')
                loadLeaderboard()
            } else {
                showToast(data.error || 'Erreur lors du démarrage', 'error')
            }
        } catch (error) {
            console.error('Start session error:', error)
            showToast('Erreur de connexion au bot', 'error')
        }
        setSessionLoading(false)
    }

    const handleStopSession = async () => {
        setSessionLoading(true)
        try {
            const res = await fetch('/api/cemantix/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            })
            const data = await res.json()
            if (data.success) {
                let msg = 'Session terminée !'
                if (data.winner) {
                    msg += ` 🏆 ${data.winner} a gagné avec "${data.winningWord}"`
                }
                showToast(msg, 'info')
                loadLeaderboard()
            } else {
                showToast(data.error || 'Erreur lors de l\'arrêt', 'error')
            }
        } catch (error) {
            console.error('Stop session error:', error)
            showToast('Erreur de connexion au bot', 'error')
        }
        setSessionLoading(false)
    }

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                <div className="cemantix-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
                    {/* Header */}
                    <div style={{ padding: '1.5rem', paddingBottom: '0.75rem', textAlign: 'center', position: 'relative' }}>
                        <div style={{ display: 'inline-block', position: 'relative', marginBottom: '0.75rem' }}>
                            <Image
                                src="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png"
                                alt="xsgwen"
                                width={80}
                                height={80}
                                style={{
                                    borderRadius: '50%',
                                    border: '4px solid var(--pink-main)',
                                    boxShadow: '0 0 15px rgba(255, 182, 193, 0.5)'
                                }}
                            />
                            <div style={{
                                position: 'absolute', bottom: '-8px', right: '-8px',
                                background: 'var(--pink-pastel)', padding: '8px', borderRadius: '50%',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)'
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--pink-accent)" stroke="none">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </div>
                        </div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            Cemantix Leaderboard
                        </h1>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>@xsgwen</p>
                    </div>

                    {/* Records Section */}
                    <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
                        <div className="cemantix-section">
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <TrophyIcon /> Records de xsgwen
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className="cemantix-inner-card">
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '1rem' }}>🇫🇷</span> Cémantix
                                    </div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {formatRecord(records?.fr?.alltime ?? null)}
                                    </div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                        mois: {formatRecord(records?.fr?.monthly ?? null)}
                                    </div>
                                </div>
                                <div className="cemantix-inner-card">
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '1rem' }}>🇬🇧</span> Cemantle
                                    </div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {formatRecord(records?.en?.alltime ?? null)}
                                    </div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                        mois: {formatRecord(records?.en?.monthly ?? null)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin Controls */}
                    {isAdmin && (
                        <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
                            <div className="cemantix-section" style={{ padding: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}>
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                    </svg>
                                    Admin
                                </div>
                                {!sessionActive ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleStartSession('fr')}
                                            disabled={sessionLoading}
                                            style={{
                                                flex: 1,
                                                padding: '0.5rem',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: 'var(--pink-accent)',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                cursor: sessionLoading ? 'not-allowed' : 'pointer',
                                                opacity: sessionLoading ? 0.6 : 1,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {sessionLoading ? '...' : '🇫🇷 Start FR'}
                                        </button>
                                        <button
                                            onClick={() => handleStartSession('en')}
                                            disabled={sessionLoading}
                                            style={{
                                                flex: 1,
                                                padding: '0.5rem',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: 'var(--pink-accent)',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                cursor: sessionLoading ? 'not-allowed' : 'pointer',
                                                opacity: sessionLoading ? 0.6 : 1,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {sessionLoading ? '...' : '🇬🇧 Start EN'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleStopSession}
                                        disabled={sessionLoading}
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            borderRadius: '10px',
                                            border: '1px solid #ef4444',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            cursor: sessionLoading ? 'not-allowed' : 'pointer',
                                            opacity: sessionLoading ? 0.6 : 1,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {sessionLoading ? '...' : '⏹️ Stop Session'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Toggle Tabs */}
                    <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
                        <div className="cemantix-section" style={{ padding: '0.25rem', display: 'flex', gap: '0.25rem' }}>
                            <button
                                className={`toggle-btn ${activeTab === 'session' ? 'active' : ''}`}
                                onClick={() => setActiveTab('session')}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: activeTab === 'session' ? undefined : '#f472b6' }}
                            >
                                <ZapIcon /> Session
                            </button>
                            <button
                                className={`toggle-btn ${activeTab === 'global' ? 'active' : ''}`}
                                onClick={() => setActiveTab('global')}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: activeTab === 'global' ? undefined : '#f472b6' }}
                            >
                                <GlobeIcon /> Global
                            </button>
                            <button
                                className={`toggle-btn ${activeTab === 'history' ? 'active' : ''}`}
                                onClick={() => setActiveTab('history')}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: activeTab === 'history' ? undefined : '#f472b6' }}
                            >
                                <HistoryIcon /> Historique
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem', paddingBottom: '1rem' }}>
                        {activeTab === 'session' && (
                            loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader size="sm" /></div>
                            ) : !sessionActive && sessionLeaderboard.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                    Aucune session en cours
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.85rem', color: sessionActive ? '#10b981' : 'var(--text-muted)' }}>
                                        {sessionActive ? `🟢 Session ${sessionLang === 'fr' ? '🇫🇷' : '🇬🇧'} en cours` : `Dernière session (${sessionLang === 'fr' ? '🇫🇷' : '🇬🇧'})`}
                                    </div>
                                    {sessionLeaderboard.map((entry: LeaderboardEntry, i: number) => (
                                        <div key={`${entry.user}-${i}`} className="leaderboard-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
                                            <div className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`} style={i >= 3 ? { background: 'var(--bg-card)' } : undefined}>
                                                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.user}</div>
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--pink-accent)' }}>{entry.points} pts</div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {activeTab === 'global' && (
                            loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader size="sm" /></div>
                            ) : globalLeaderboard.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucune donnée</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {globalLeaderboard.map((entry: LeaderboardEntry, i: number) => (
                                        <div key={`${entry.user}-${i}`} className="leaderboard-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
                                            <div className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`} style={i >= 3 ? { background: 'var(--bg-card)' } : undefined}>
                                                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.user}</div>
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--pink-accent)' }}>{entry.points} pts</div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {activeTab === 'history' && (
                            history.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun historique</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {history.map((entry, i) => (
                                        <div key={`${entry.word}-${i}`} className="leaderboard-item" style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: '12px', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {entry.lang === 'fr' ? '🇫🇷' : '🇬🇧'} {entry.word || 'Mot inconnu'}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : '-'}
                                                    </span>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => deleteSession(entry.id)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.2)',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '0.25rem 0.5rem',
                                                                cursor: 'pointer',
                                                                fontSize: '0.7rem',
                                                                color: '#dc2626'
                                                            }}
                                                            title="Supprimer cette session"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                🏆 {entry.winner || 'Personne'} • {entry.guessCount || 0} essais • {entry.playerCount || 0} joueurs
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', background: 'rgba(255,255,255,0.1)' }}>
                        <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(157, 23, 77, 0.4)', fontWeight: 700 }}>
                            Powered by <span style={{ color: '#ec4899' }}>GwenBot</span>
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                            <a href="https://discord.gg/jyyEErgFcq" target="_blank" rel="noopener noreferrer">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            </a>
                            <a href="https://www.twitch.tv/xsgwen" target="_blank" rel="noopener noreferrer">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#f472b6"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" /></svg>
                            </a>
                            <a href="https://www.instagram.com/cyndie.jpg/" target="_blank" rel="noopener noreferrer">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
