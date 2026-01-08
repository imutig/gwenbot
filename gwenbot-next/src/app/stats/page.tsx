'use client'

import { useState, useEffect } from 'react'
import Loader from '@/components/ui/loader'
import FancyButton from '@/components/ui/fancy-button'

const styles = `
  .search-box { display: flex; gap: 0.75rem; margin-bottom: 2rem; }
  .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  .stat-card { padding: 1.25rem; background: var(--bg-card); border-radius: 16px; text-align: center; }
  .stat-value { font-size: 2rem; font-weight: 700; color: var(--pink-accent); }
  .stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
  .player-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
  .player-avatar { width: 80px; height: 80px; border-radius: 50%; background: var(--bg-input); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; color: var(--pink-accent); border: 3px solid var(--pink-main); }
  .leaderboard-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-card); border-radius: 12px; margin-bottom: 0.5rem; }
  .rank-badge { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; font-size: 0.75rem; }
  .rank-1 { background: linear-gradient(45deg, #FFD700, #FDB931); color: white; }
  .rank-2 { background: linear-gradient(45deg, #C0C0C0, #E8E8E8); color: #333; }
  .rank-3 { background: linear-gradient(45deg, #CD7F32, #E9967A); color: white; }
  @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } }
`

interface UserStats {
    watch_time_minutes: number
    streams_watched: number
    messages: number
    top_emojis: { emoji: string; count: number }[]
}

interface TopMessage {
    username: string
    count: number
}

interface TopEmoji {
    emoji: string
    count: number
}

interface WatchTimeEntry {
    username: string
    watch_time_minutes: number
    streams_watched: number
}

interface SudokuEntry {
    username: string
    difficulty: string
    time_seconds: number
}

export default function StatsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [userStats, setUserStats] = useState<UserStats | null>(null)
    const [searchedUser, setSearchedUser] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const [topMessages, setTopMessages] = useState<TopMessage[]>([])
    const [topEmojis, setTopEmojis] = useState<TopEmoji[]>([])
    const [watchTimeLeaderboard, setWatchTimeLeaderboard] = useState<WatchTimeEntry[]>([])
    const [sudokuLeaderboard, setSudokuLeaderboard] = useState<SudokuEntry[]>([])
    const [sudokuDifficulty, setSudokuDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
    const [loadingStats, setLoadingStats] = useState(true)

    // Load global stats on mount
    useEffect(() => {
        Promise.all([
            fetch('/api/stats/top-messages').then(r => r.json()),
            fetch('/api/stats/top-emojis').then(r => r.json()),
            fetch('/api/stats/watch-time').then(r => r.json()),
            fetch('/api/sudoku/leaderboard').then(r => r.json())
        ]).then(([messages, emojis, watchTime, sudoku]) => {
            setTopMessages(messages.topMessages || [])
            setTopEmojis(emojis.topEmojis || [])
            setWatchTimeLeaderboard(watchTime.leaderboard || [])
            setSudokuLeaderboard(sudoku.leaderboard || [])
            setLoadingStats(false)
        }).catch(err => {
            console.error('Error loading stats:', err)
            setLoadingStats(false)
        })
    }, [])

    const handleSearch = async () => {
        if (!searchTerm.trim()) return

        setLoading(true)
        try {
            const res = await fetch(`/api/stats/watch-time/${encodeURIComponent(searchTerm.toLowerCase())}`)
            const data = await res.json()
            setUserStats(data)
            setSearchedUser(searchTerm)
        } catch (err) {
            console.error('Search error:', err)
        }
        setLoading(false)
    }

    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}min`
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return mins > 0 ? `${hours}h${mins}` : `${hours}h`
    }

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                        <line x1="12" x2="12" y1="20" y2="10" />
                        <line x1="18" x2="18" y1="20" y2="4" />
                        <line x1="6" x2="6" y1="20" y2="16" />
                    </svg>
                    Tes Stats
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Recherche ton pseudo Twitch pour voir tes statistiques</p>

                {/* Search */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <div className="search-box">
                        <input
                            type="text"
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="Entrez votre pseudo Twitch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <FancyButton size="sm" onClick={handleSearch} disabled={loading}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', marginRight: '0.5rem' }}>
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            {loading ? '...' : 'Rechercher'}
                        </FancyButton>
                    </div>
                </div>

                {/* User Results */}
                <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                    <div className="player-header">
                        <div className="player-avatar">
                            {searchedUser ? searchedUser.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                                {searchedUser || '-'}
                            </h2>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {searchedUser ? 'Statistiques du viewer' : 'Recherche un pseudo pour voir ses stats'}
                            </p>
                        </div>
                    </div>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{userStats ? formatTime(userStats.watch_time_minutes) : '0h'}</div>
                            <div className="stat-label">Temps de présence</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{userStats?.streams_watched || 0}</div>
                            <div className="stat-label">Streams regardés</div>
                        </div>
                        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                            <div className="stat-value">{userStats?.messages || 0}</div>
                            <div className="stat-label">Messages dans le chat</div>
                        </div>
                    </div>
                    {userStats && userStats.top_emojis.length > 0 && (
                        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Emotes favorites</p>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {userStats.top_emojis.map((e, i) => (
                                    <span key={i} style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-card)', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {['xsgwenHug', 'xsgwenHype', 'xsgwenLol', 'xsgwenLove', 'xsgwenOuin', 'xsgwenSip', 'xsgwenWow'].includes(e.emoji) ? (
                                            <img src={`/emotes/${e.emoji}.png`} alt={e.emoji} style={{ width: '20px', height: '20px' }} />
                                        ) : (
                                            <span>{e.emoji}</span>
                                        )}
                                        ({e.count})
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Top Messages */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Top 10 messages
                    </h3>
                    {loadingStats ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><Loader size="sm" /></div>
                    ) : topMessages.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée</p>
                    ) : (
                        <div>
                            {topMessages.map((entry, i) => (
                                <div key={`${entry.username}-${i}`} className="leaderboard-item">
                                    <div className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`} style={i >= 3 ? { background: 'var(--bg-input)' } : undefined}>
                                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                    </div>
                                    <div style={{ flex: 1, fontWeight: 500 }}>{entry.username}</div>
                                    <div style={{ color: 'var(--pink-accent)', fontWeight: 700 }}>{entry.count} messages</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Most Used Emotes */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" x2="9.01" y1="9" y2="9" />
                            <line x1="15" x2="15.01" y1="9" y2="9" />
                        </svg>
                        Emotes les plus utilisées
                    </h3>
                    {loadingStats ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><Loader size="sm" /></div>
                    ) : topEmojis.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée</p>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                            {topEmojis.map((e, i) => (
                                <div key={`${e.emoji}-${i}`} style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    {/* Check if emote image exists */}
                                    {['xsgwenHug', 'xsgwenHype', 'xsgwenLol', 'xsgwenLove', 'xsgwenOuin', 'xsgwenSip', 'xsgwenWow'].includes(e.emoji) ? (
                                        <img src={`/emotes/${e.emoji}.png`} alt={e.emoji} style={{ width: '28px', height: '28px' }} />
                                    ) : (
                                        <span style={{ fontSize: '1.5rem' }}>{e.emoji}</span>
                                    )}
                                    <span style={{ fontWeight: 600, color: 'var(--pink-accent)' }}>{e.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Watch Time Leaderboard */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Top Viewers (Temps de présence)
                    </h3>
                    {loadingStats ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><Loader size="sm" /></div>
                    ) : watchTimeLeaderboard.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée</p>
                    ) : (
                        <div>
                            {watchTimeLeaderboard.map((entry, i) => (
                                <div key={`${entry.username}-${i}`} className="leaderboard-item">
                                    <div className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`} style={i >= 3 ? { background: 'var(--bg-input)' } : undefined}>
                                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{entry.username}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.streams_watched} streams</div>
                                    </div>
                                    <div style={{ color: 'var(--pink-accent)', fontWeight: 700 }}>{formatTime(entry.watch_time_minutes)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sudoku Leaderboard */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" />
                        </svg>
                        Sudoku - Meilleurs Temps
                    </h3>

                    {/* Difficulty filter */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                            <button
                                key={d}
                                onClick={() => setSudokuDifficulty(d)}
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    border: sudokuDifficulty === d ? '1px solid var(--pink-accent)' : '1px solid var(--border-color)',
                                    background: sudokuDifficulty === d ? 'var(--pink-accent)' : 'var(--bg-card)',
                                    color: sudokuDifficulty === d ? 'white' : 'var(--text-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                {d === 'all' ? 'Tous' : d === 'easy' ? 'Facile' : d === 'medium' ? 'Moyen' : 'Difficile'}
                            </button>
                        ))}
                    </div>

                    {loadingStats ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><Loader size="sm" /></div>
                    ) : sudokuLeaderboard.filter(e => sudokuDifficulty === 'all' || e.difficulty === sudokuDifficulty).length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune partie enregistrée</p>
                    ) : (
                        <div>
                            {sudokuLeaderboard
                                .filter(e => sudokuDifficulty === 'all' || e.difficulty === sudokuDifficulty)
                                .slice(0, 10)
                                .map((entry, i) => (
                                    <div key={`${entry.username}-${entry.difficulty}-${i}`} className="leaderboard-item">
                                        <div className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`} style={i >= 3 ? { background: 'var(--bg-input)' } : undefined}>
                                            {i < 3 ? ['1', '2', '3'][i] : i + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{entry.username}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {entry.difficulty === 'easy' ? 'Facile' : entry.difficulty === 'medium' ? 'Moyen' : 'Difficile'}
                                            </div>
                                        </div>
                                        <div style={{ color: 'var(--pink-accent)', fontWeight: 700, fontFamily: 'monospace' }}>
                                            {Math.floor(entry.time_seconds / 60)}:{(entry.time_seconds % 60).toString().padStart(2, '0')}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
