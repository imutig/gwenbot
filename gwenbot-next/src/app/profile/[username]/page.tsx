'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTwitchUsername } from '@/lib/auth-utils'
import AvatarPicker from '@/components/avatar-picker'
import Image from 'next/image'
import FancyButton from '@/components/ui/fancy-button'
import { createClient } from '@/lib/supabase'
import Loader from '@/components/ui/loader'

interface HistoryItem {
    id: number
    date: string
    mode: string
    difficulty: string
    time: number
    result: string
    opponent?: string
    isWinner: boolean
}

interface PlayerStats {
    games_played?: number
    total_points?: number
    best_session_score?: number
    sudoku_br_wins?: number
    words_found?: number
}

interface UserProfile {
    id: number
    username: string
    avatar_seed?: string
    created_at: string
}

export default function ProfilePage() {
    const params = useParams()
    const router = useRouter()
    const username = params.username as string

    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [stats, setStats] = useState<PlayerStats>({})
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isEditingAvatar, setIsEditingAvatar] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const supabase = createClient()

    useEffect(() => {
        const checkAuth = async () => {
            if (!supabase) return
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUser(user)
        }
        checkAuth()

        const fetchProfile = async () => {
            try {
                const res = await fetch(`/api/profile/${username}`)
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(data.error || 'Erreur lors du chargement du profil')
                }

                setProfile(data.player)
                setStats(data.stats)
                setHistory(data.history)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        if (username) {
            fetchProfile()
        }
    }, [username])

    const handleSaveAvatar = async (newSeed: string) => {
        if (!profile) return

        try {
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, seed: newSeed })
            })

            if (res.ok) {
                setProfile({ ...profile, avatar_seed: newSeed })
                setIsEditingAvatar(false)
                router.refresh()
            } else {
                alert('Erreur lors de la sauvegarde de l\'avatar')
            }
        } catch (error) {
            console.error(error)
            alert('Erreur technique')
        }
    }

    const formatTime = (seconds: number) => {
        if (!seconds && seconds !== 0) return '-'
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Icons
    const CalendarIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )

    const TrophyIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )

    const GamepadIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
            <line x1="6" x2="10" y1="12" y2="12" />
            <line x1="8" x2="8" y1="10" y2="14" />
            <line x1="15" x2="15.01" y1="13" y2="13" />
            <line x1="18" x2="18.01" y1="11" y2="11" />
            <rect width="20" height="12" x="2" y="6" rx="2" />
        </svg>
    )

    const StarIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    )

    const GhostIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
            <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
            <line x1="13" x2="19" y1="19" y2="13" />
            <line x1="16" x2="20" y1="16" y2="20" />
            <line x1="19" x2="21" y1="21" y2="19" />
            <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
            <line x1="5" x2="9" y1="14" y2="18" />
            <line x1="7" x2="4" y1="17" y2="20" />
            <line x1="3" x2="5" y1="19" y2="21" />
        </svg>
    )

    const ScrollIcon = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    )

    if (loading) return <Loader />

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-4">
                <div className="text-4xl">😕</div>
                <h1 className="text-2xl font-bold text-gray-800">Profil introuvable</h1>
                <p className="text-gray-500">{error}</p>
                <FancyButton onClick={() => router.push('/')}>
                    Retour à l'accueil
                </FancyButton>
            </div>
        )
    }

    const isOwner = currentUser && getTwitchUsername(currentUser)?.toLowerCase() === profile?.username.toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avatarSeed = (profile as any)?.avatar_seed || profile?.username

    return (
        <main className="main-content">
            {/* Header Card */}
            <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', flexDirection: 'column', textAlign: 'center' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: '128px',
                        height: '128px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '4px solid var(--pink-main)',
                        boxShadow: '0 8px 16px var(--shadow-color)',
                        position: 'relative'
                    }}>
                        <Image
                            src={`https://api.dicebear.com/7.x/notionists/png?seed=${avatarSeed}&backgroundColor=transparent`}
                            alt={profile?.username || ''}
                            fill
                            className="object-cover"
                        />
                    </div>
                    {isOwner && (
                        <button
                            onClick={() => setIsEditingAvatar(true)}
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                right: '0',
                                background: 'var(--pink-main)',
                                color: 'white',
                                border: '3px solid var(--bg-card)',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                transition: 'transform 0.2s',
                                zIndex: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            title="Modifier la photo"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', background: 'linear-gradient(45deg, var(--text-primary), var(--pink-vibrant))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {profile?.username}
                    </h1>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 1rem',
                            borderRadius: '50px',
                            fontSize: '0.9rem',
                            background: 'rgba(255, 255, 255, 0.5)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <CalendarIcon />
                            Membre depuis le {formatDate(profile?.created_at || '')}
                        </span>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 1rem',
                            borderRadius: '50px',
                            fontSize: '0.9rem',
                            background: 'rgba(255, 255, 255, 0.5)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)'
                        }}>
                            #{profile?.id}
                        </span>
                    </div>
                </div>
            </div>

            {/* Avatar Picker Modal */}
            {isEditingAvatar && (
                <AvatarPicker
                    currentSeed={avatarSeed}
                    onSave={handleSaveAvatar}
                    onCancel={() => setIsEditingAvatar(false)}
                />
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--pink-accent)', marginBottom: '0.5rem' }}>
                        <GamepadIcon />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.games_played || 0}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Parties jouées</div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--pink-accent)', marginBottom: '0.5rem' }}>
                        <TrophyIcon />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.sudoku_br_wins || 0}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Victoires Battle Round</div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--pink-accent)', marginBottom: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                            <path d="M2 2l7.586 7.586" />
                            <circle cx="11" cy="11" r="2" />
                        </svg>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.words_found || 0}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Pictionary Gagnés</div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ color: 'var(--pink-accent)', marginBottom: '0.5rem' }}>
                        <StarIcon />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total_points || 0}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Points Totaux</div>
                </div>
            </div>

            {/* History Section */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'rgba(255,255,255,0.3)'
                }}>
                    <ScrollIcon />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Historique Sudoku</h2>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mode</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Difficulté</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Résultat</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chrono</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? (
                                history.map((game) => (
                                    <tr key={game.id} style={{ borderBottom: '1px solid rgba(255, 182, 193, 0.2)' }}>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                            {formatDate(game.date)}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                background: game.mode === 'Battle Royale' ? '#f3e8ff' : game.mode === 'Duel 1v1' ? '#e0f2fe' : '#f3f4f6',
                                                color: game.mode === 'Battle Royale' ? '#7e22ce' : game.mode === 'Duel 1v1' ? '#0369a1' : '#374151'
                                            }}>
                                                {game.mode}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                            {game.difficulty}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: (game.result.includes('Victoire') || game.result.includes('#1')) ? '#16a34a' :
                                                        game.result.includes('Défaite') ? '#dc2626' : 'var(--text-primary)'
                                                }}>
                                                    {game.result}
                                                </span>
                                                {game.opponent && !game.result.includes('#') && (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs {game.opponent}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                            {formatTime(game.time)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => router.push(`/sudoku?sourceId=${game.id}`)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--pink-accent)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 500,
                                                    transition: 'opacity 0.2s'
                                                }}
                                                title="Essayer de battre ce temps"
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                            >
                                                <GhostIcon />
                                                <span className="hidden sm:inline">Defier</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Aucune partie récente trouvée.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    )
}
