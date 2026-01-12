'use client'

import { useState, useEffect, useCallback } from 'react'
import FancyButton from '@/components/ui/fancy-button'
import UserProfileWidget from '@/components/user-profile-widget'

const styles = `
  .stats-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      flex-wrap: wrap;
  }
  .stats-tab {
      padding: 0.5rem 1rem;
      border-radius: 8px 8px 0 0;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      font-size: 0.9rem;
  }
  .stats-tab.active {
      background: var(--pink-accent);
      color: white;
  }
  .stats-tab:hover:not(.active) {
      background: var(--bg-card);
  }
  .search-container {
      position: relative;
      margin-bottom: 1.5rem;
  }
  .search-box { 
      display: flex; 
      gap: 0.75rem;
      flex-wrap: wrap;
  }
  .search-box input {
      flex: 1;
      min-width: 200px;
  }
  .autocomplete-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-top: 4px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 50;
  }
  .autocomplete-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background 0.15s;
  }
  .autocomplete-item:hover {
      background: var(--bg-input);
  }
  .stats-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 1rem; 
  }
  @media (max-width: 480px) {
      .stats-grid {
          grid-template-columns: 1fr;
      }
      .stats-tabs {
          gap: 0.25rem;
      }
      .stats-tab {
          padding: 0.4rem 0.75rem;
          font-size: 0.8rem;
      }
      .stat-value {
          font-size: 1.5rem;
      }
      .player-header {
          flex-direction: column;
          text-align: center;
      }
      .leaderboard-item {
          flex-wrap: wrap;
      }
  }
  .stat-card { 
      padding: 1.25rem; 
      background: var(--bg-card); 
      border-radius: 16px; 
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      transform-style: preserve-3d;
      cursor: default;
  }
  .stat-card:hover {
      transform: perspective(1000px) rotateX(5deg) rotateY(-5deg) translateZ(10px);
      box-shadow: 10px 10px 30px rgba(0,0,0,0.15);
  }
  .stat-value { 
      font-size: 2rem; 
      font-weight: 700; 
      color: var(--pink-accent); 
  }
  .stat-label { 
      font-size: 0.8rem; 
      color: var(--text-muted); 
      margin-top: 0.25rem; 
  }
  .player-header { 
      display: flex; 
      align-items: center; 
      gap: 1rem; 
      margin-bottom: 1.5rem; 
  }
  .player-avatar { 
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      background: var(--bg-input); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 2rem; 
      font-weight: 700; 
      color: var(--pink-accent); 
      border: 3px solid var(--pink-main);
      overflow: hidden;
  }
  .player-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
  }
  .leaderboard-item { 
      display: flex; 
      align-items: center; 
      gap: 0.75rem; 
      padding: 0.75rem; 
      background: var(--bg-card); 
      border-radius: 12px; 
      margin-bottom: 0.5rem; 
      transition: transform 0.15s ease, background 0.15s ease;
      cursor: pointer;
  }
  .leaderboard-item:hover { 
      transform: translateX(4px);
      background: var(--bg-input);
  }
  .leaderboard-item.expanded {
      background: var(--bg-input);
  }
  .leaderboard-details {
      padding: 0.75rem;
      margin-left: 2.5rem;
      background: var(--bg-main);
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
  }
  .rank-badge { 
      width: 28px; 
      height: 28px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      border-radius: 50%; 
      font-weight: 700; 
      font-size: 0.8rem; 
      background: var(--bg-input); 
      color: var(--text-muted); 
  }
  .rank-1 { 
      background: linear-gradient(135deg, var(--pink-accent), #ff6b9d); 
      color: white; 
      box-shadow: 0 2px 8px rgba(255,107,157,0.3); 
  }
  .rank-2 { 
      background: linear-gradient(135deg, #d4a5ff, #b388ff); 
      color: white; 
      box-shadow: 0 2px 8px rgba(179,136,255,0.3); 
  }
  .rank-3 { 
      background: linear-gradient(135deg, #ffc4d6, #ffb3c6); 
      color: #8b5a6b; 
      box-shadow: 0 2px 8px rgba(255,179,198,0.3); 
  }
  .small-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg-input);
      overflow: hidden;
  }
  .small-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
  }
  .skeleton {
      background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-input) 50%, var(--bg-card) 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: 8px;
  }
  @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
  }
  .skeleton-text { height: 1rem; margin-bottom: 0.5rem; }
  .skeleton-title { height: 1.5rem; width: 60%; margin-bottom: 0.75rem; }
  .skeleton-avatar { width: 80px; height: 80px; border-radius: 50%; }
  .skeleton-card { height: 100px; }
  .skeleton-row { height: 48px; margin-bottom: 0.5rem; }
  .period-filter {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
  }
  .period-btn {
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
  }
  .period-btn.active {
      border-color: var(--pink-accent);
      background: var(--pink-accent);
      color: white;
  }
  .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
  }
  .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 1rem;
      opacity: 0.5;
  }
  .leaderboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
  }
  .leaderboard-section {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 1.25rem;
  }
  .leaderboard-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
  }
  .leaderboard-header svg {
      width: 18px;
      height: 18px;
      color: var(--pink-accent);
  }
  @media (max-width: 768px) { 
      .stats-grid { grid-template-columns: 1fr; }
      .leaderboard-grid { grid-template-columns: 1fr; }
  }
`

type Tab = 'chat' | 'games' | 'watchtime'
type Period = 'all' | 'month' | 'week'

interface UserStats {
    watch_time_minutes: number
    streams_watched: number
    messages: number
    top_emojis: { emoji: string; count: number }[]
    game_stats?: {
        sudoku_wins: number
        sudoku_br_wins: number
        memory_wins: number
        memory_best_solo: number | null
        gwendle_wins: number
        gwendle_avg_attempts: string | null
        cemantig_wins: number
        connect4_wins: number
    }
}

export default function StatsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('games')
    const [period, setPeriod] = useState<Period>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [userStats, setUserStats] = useState<UserStats | null>(null)
    const [searchedUser, setSearchedUser] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [autocompleteUsers, setAutocompleteUsers] = useState<{ id: number; username: string }[]>([])
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [userAvatar, setUserAvatar] = useState<string | null>(null)

    // Leaderboards
    const [topMessages, setTopMessages] = useState<any[]>([])
    const [topEmojis, setTopEmojis] = useState<any[]>([])
    const [watchTimeLeaderboard, setWatchTimeLeaderboard] = useState<any[]>([])
    const [sudokuLeaderboard, setSudokuLeaderboard] = useState<any[]>([])
    const [brWinsLeaderboard, setBrWinsLeaderboard] = useState<any[]>([])
    const [memoryLeaderboard, setMemoryLeaderboard] = useState<{ easyMoves: any[]; easyTime: any[]; hardMoves: any[]; hardTime: any[]; wins: any[] }>({ easyMoves: [], easyTime: [], hardMoves: [], hardTime: [], wins: [] })
    const [gwendleLeaderboard, setGwendleLeaderboard] = useState<any[]>([])
    const [gwendleStreakLeaderboard, setGwendleStreakLeaderboard] = useState<any[]>([])
    const [cemantigLeaderboard, setCemantigLeaderboard] = useState<any[]>([])
    const [emoteUsers, setEmoteUsers] = useState<Record<string, { username: string; count: number }[]>>({})
    const [loadingStats, setLoadingStats] = useState(true)
    const [expandedItem, setExpandedItem] = useState<string | null>(null)
    const [memoryType, setMemoryType] = useState<'moves' | 'time' | '1v1'>('moves')
    const [memoryDifficulty, setMemoryDifficulty] = useState<'4x4' | '6x6'>('4x4')
    const [gwendleLength, setGwendleLength] = useState<5 | 7>(5)

    // Load stats based on period
    const loadStats = useCallback(async () => {
        setLoadingStats(true)
        try {
            const periodParam = period !== 'all' ? `?period=${period}` : ''
            const [messages, emojis, watchTime, sudoku, brWins, memory, gwendle, cemantig, emoteUsersData] = await Promise.all([
                fetch('/api/stats/top-messages').then(r => r.json()),
                fetch('/api/stats/top-emojis').then(r => r.json()),
                fetch('/api/stats/watch-time').then(r => r.json()),
                fetch(`/api/sudoku/leaderboard${periodParam}`).then(r => r.json()),
                fetch('/api/sudoku/br-leaderboard').then(r => r.json()),
                fetch(`/api/stats/memory${periodParam}`).then(r => r.json()),
                fetch(`/api/stats/gwendle${periodParam}${periodParam ? '&' : '?'}wordLength=${gwendleLength}`).then(r => r.json()),
                fetch(`/api/stats/cemantig${periodParam}`).then(r => r.json()),
                fetch('/api/stats/emote-users').then(r => r.json())
            ])

            setTopMessages(messages.topMessages || [])
            setTopEmojis(emojis.topEmojis || [])
            setWatchTimeLeaderboard(watchTime.leaderboard || [])
            setSudokuLeaderboard(sudoku.leaderboard || [])
            setBrWinsLeaderboard(brWins.leaderboard || [])
            setMemoryLeaderboard({ easyMoves: memory.easyMoves || [], easyTime: memory.easyTime || [], hardMoves: memory.hardMoves || [], hardTime: memory.hardTime || [], wins: memory.winsLeaderboard || [] })
            setGwendleLeaderboard(gwendle.leaderboard || [])
            setGwendleStreakLeaderboard(gwendle.streakLeaderboard || [])
            setCemantigLeaderboard(cemantig.leaderboard || [])
            setEmoteUsers(emoteUsersData.topUsers || {})
        } catch (e) {
            console.error('Error loading stats:', e)
        }
        setLoadingStats(false)
    }, [period, gwendleLength])

    useEffect(() => {
        loadStats()
    }, [loadStats])

    // Autocomplete
    useEffect(() => {
        if (searchTerm.length < 2) {
            setAutocompleteUsers([])
            return
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/stats/search-users?q=${encodeURIComponent(searchTerm)}`)
                const data = await res.json()
                setAutocompleteUsers(data.users || [])
            } catch (e) {
                console.error(e)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchTerm])

    const handleSearch = async (username?: string) => {
        const term = username || searchTerm
        if (!term.trim()) return

        setLoading(true)
        setShowAutocomplete(false)
        setUserAvatar(null)
        try {
            const [statsRes, avatarRes] = await Promise.all([
                fetch(`/api/stats/watch-time/${encodeURIComponent(term.toLowerCase())}`),
                fetch(`/api/twitch/avatar?username=${encodeURIComponent(term)}`)
            ])
            const data = await statsRes.json()
            const avatarData = await avatarRes.json()
            setUserStats(data)
            setSearchedUser(term)
            setUserAvatar(avatarData.avatar_url)
        } catch (err) {
            console.error('Search error:', err)
        }
        setLoading(false)
    }

    const closeUserStats = () => {
        setSearchedUser(null)
        setUserStats(null)
        setUserAvatar(null)
        setSearchTerm('')
    }

    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}min`
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return mins > 0 ? `${hours}h${mins}` : `${hours}h`
    }

    const SkeletonLoader = () => (
        <div>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton skeleton-row" />
            ))}
        </div>
    )

    const EmptyState = ({ message }: { message: string }) => (
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>{message}</p>
        </div>
    )

    const LeaderboardItem = ({ rank, username, seed, value, valueLabel, itemKey }: { rank: number; username: string; seed?: string; value: string | number; valueLabel?: string; itemKey: string }) => (
        <>
            <div
                className={`leaderboard-item ${expandedItem === itemKey ? 'expanded' : ''}`}
                onClick={() => setExpandedItem(expandedItem === itemKey ? null : itemKey)}
            >
                <div className={`rank-badge ${rank <= 3 ? `rank-${rank}` : ''}`}>{rank}</div>
                <div style={{ flex: 1, fontWeight: 500, overflow: 'hidden', minWidth: 0, paddingRight: '0.5rem' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                        <UserProfileWidget username={username} seed={seed} showAvatar={false} />
                    </div>
                </div>
                <div style={{ color: 'var(--pink-accent)', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 'auto' }}>{value}{valueLabel && ` ${valueLabel}`}</div>
            </div>
        </>
    )

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
                    Statistiques
                </h1>

                {/* Search */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Recherche un pseudo Twitch pour voir ses stats
                    </p>
                    <div className="search-container">
                        <div className="search-box">
                            <input
                                type="text"
                                className="input"
                                style={{ flex: 1 }}
                                placeholder="Pseudo Twitch..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setShowAutocomplete(true) }}
                                onFocus={() => setShowAutocomplete(true)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <FancyButton size="sm" onClick={() => handleSearch()} disabled={loading}>
                                {loading ? '...' : 'Rechercher'}
                            </FancyButton>
                        </div>
                        {showAutocomplete && autocompleteUsers.length > 0 && (
                            <div className="autocomplete-list">
                                {autocompleteUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className="autocomplete-item"
                                        onClick={() => { setSearchTerm(user.username); handleSearch(user.username) }}
                                    >
                                        {user.username}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* User stats (only show if searched) */}
                    {searchedUser && (
                        <div style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.05))', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div className="player-header" style={{ marginBottom: 0 }}>
                                    <div className="player-avatar">
                                        {userAvatar ? (
                                            <img src={userAvatar} alt={searchedUser} />
                                        ) : (
                                            searchedUser.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{searchedUser}</h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Statistiques du viewer</p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeUserStats}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-muted)' }}
                                    title="Fermer"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Stream stats */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    Présence
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats ? formatTime(userStats.watch_time_minutes) : '0h'}</div>
                                        <div className="stat-label">Watch time</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.streams_watched || 0}</div>
                                        <div className="stat-label">Streams</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.messages || 0}</div>
                                        <div className="stat-label">Messages</div>
                                    </div>
                                </div>
                            </div>

                            {/* Game stats */}
                            <div>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}><rect x="6" y="11" width="12" height="9" rx="2" /><circle cx="12" cy="5" r="3" /></svg>
                                    Victoires aux jeux
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.sudoku_wins || 0}</div>
                                        <div className="stat-label">Sudoku</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.sudoku_br_wins || 0}</div>
                                        <div className="stat-label">BR</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.memory_wins || 0}</div>
                                        <div className="stat-label">Memory</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.connect4_wins || 0}</div>
                                        <div className="stat-label">P4</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.gwendle_wins || 0}</div>
                                        <div className="stat-label">Gwendle</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.gwendle_avg_attempts || '-'}</div>
                                        <div className="stat-label">Moy. essais</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.cemantig_wins || 0}</div>
                                        <div className="stat-label">Cemantig</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{userStats?.game_stats?.memory_best_solo || '-'}</div>
                                        <div className="stat-label">Best Memory</div>
                                    </div>
                                </div>
                            </div>

                            {/* Top emojis */}
                            {userStats?.top_emojis && userStats.top_emojis.length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Emotes favorites</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    )}
                </div>

                {/* Tabs */}
                <div className="stats-tabs">
                    <button className={`stats-tab ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '0.4rem' }}>
                            <rect x="6" y="11" width="12" height="9" rx="2" />
                            <circle cx="12" cy="5" r="3" />
                        </svg>
                        Jeux
                    </button>
                    <button className={`stats-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '0.4rem' }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Chat
                    </button>
                    <button className={`stats-tab ${activeTab === 'watchtime' ? 'active' : ''}`} onClick={() => setActiveTab('watchtime')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '0.4rem' }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Watch Time
                    </button>
                </div>

                {/* Period Filter */}
                <div className="period-filter">
                    <button className={`period-btn ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>
                        Tout
                    </button>
                    <button className={`period-btn ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>
                        Ce mois
                    </button>
                    <button className={`period-btn ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>
                        Cette semaine
                    </button>
                </div>

                {/* Games Tab */}
                {activeTab === 'games' && (
                    <div className="leaderboard-grid">
                        {/* Sudoku */}
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect width="18" height="18" x="3" y="3" rx="2" />
                                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                                </svg>
                                Sudoku - Meilleurs Temps
                            </div>
                            {loadingStats ? <SkeletonLoader /> : sudokuLeaderboard.length === 0 ? (
                                <EmptyState message="Aucune partie" />
                            ) : (
                                sudokuLeaderboard.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem key={`sudoku-${i}`} itemKey={`sudoku-${i}`} rank={i + 1} username={e.username} seed={e.avatar_seed} value={`${Math.floor(e.time_seconds / 60)}:${(e.time_seconds % 60).toString().padStart(2, '0')}`} />
                                ))
                            )}
                        </div>

                        {/* BR Wins */}
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                </svg>
                                Battle Royale - Victoires
                            </div>
                            {loadingStats ? <SkeletonLoader /> : brWinsLeaderboard.length === 0 ? (
                                <EmptyState message="Aucune victoire" />
                            ) : (
                                brWinsLeaderboard.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem key={`br-${i}`} itemKey={`br-${i}`} rank={i + 1} username={e.username} seed={e.avatar_seed} value={e.wins} valueLabel="victoires" />
                                ))
                            )}
                        </div>

                        {/* Memory - Combined Section */}
                        <div className="leaderboard-section" style={{ gridColumn: 'span 1' }}>
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect width="6" height="6" x="3" y="3" rx="1" />
                                    <rect width="6" height="6" x="15" y="3" rx="1" />
                                    <rect width="6" height="6" x="3" y="15" rx="1" />
                                    <rect width="6" height="6" x="15" y="15" rx="1" />
                                </svg>
                                Memory
                            </div>
                            {/* Type Filter */}
                            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                {(['moves', 'time', '1v1'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setMemoryType(type)}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: memoryType === type ? 'var(--pink-accent)' : 'var(--bg-main)',
                                            color: memoryType === type ? 'white' : 'var(--text-muted)'
                                        }}
                                    >
                                        {type === 'moves' ? 'Coups' : type === 'time' ? 'Temps' : '1v1'}
                                    </button>
                                ))}
                            </div>
                            {/* Difficulty Filter (only for solo modes) */}
                            {memoryType !== '1v1' && (
                                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                    {(['4x4', '6x6'] as const).map(diff => (
                                        <button
                                            key={diff}
                                            onClick={() => setMemoryDifficulty(diff)}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: memoryDifficulty === diff ? 'var(--pink-main)' : 'var(--bg-main)',
                                                color: memoryDifficulty === diff ? 'white' : 'var(--text-muted)'
                                            }}
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {/* Leaderboard Content */}
                            {loadingStats ? <SkeletonLoader /> : (() => {
                                let data: any[] = []
                                let valueLabel = ''
                                let isTime = false

                                if (memoryType === '1v1') {
                                    data = memoryLeaderboard.wins
                                    valueLabel = 'victoires'
                                } else if (memoryType === 'moves') {
                                    data = memoryDifficulty === '4x4' ? memoryLeaderboard.easyMoves : memoryLeaderboard.hardMoves
                                    valueLabel = 'coups'
                                } else {
                                    data = memoryDifficulty === '4x4' ? memoryLeaderboard.easyTime : memoryLeaderboard.hardTime
                                    isTime = true
                                }

                                if (data.length === 0) {
                                    return <EmptyState message="Aucune partie" />
                                }

                                return data.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem
                                        key={`mem-${i}`}
                                        itemKey={`mem-${i}`}
                                        rank={i + 1}
                                        username={e.username}
                                        value={isTime ? `${Math.floor(e.time / 60)}:${String(e.time % 60).padStart(2, '0')}` : (memoryType === '1v1' ? e.wins : e.moves)}
                                        valueLabel={isTime ? '' : valueLabel}
                                    />
                                ))
                            })()}
                        </div>

                        {/* Gwendle */}
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect width="5" height="5" x="3" y="3" rx="1" />
                                    <rect width="5" height="5" x="10" y="3" rx="1" />
                                    <rect width="5" height="5" x="17" y="3" rx="1" />
                                    <rect width="5" height="5" x="3" y="10" rx="1" />
                                    <rect width="5" height="5" x="10" y="10" rx="1" />
                                </svg>
                                Gwendle - Moyenne essais
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                {[5, 7].map(len => (
                                    <button
                                        key={len}
                                        onClick={() => setGwendleLength(len as 5 | 7)}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: gwendleLength === len ? 'var(--pink-accent)' : 'var(--bg-main)',
                                            color: gwendleLength === len ? 'white' : 'var(--text-muted)'
                                        }}
                                    >
                                        {len} Lettres
                                    </button>
                                ))}
                            </div>
                            {loadingStats ? <SkeletonLoader /> : gwendleLeaderboard.length === 0 ? (
                                <EmptyState message="Aucune partie" />
                            ) : (
                                gwendleLeaderboard.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem key={`gwendle-${i}`} itemKey={`gwendle-${i}`} rank={i + 1} username={e.username} value={e.avgAttempts.toFixed(1)} valueLabel="essais" />
                                ))
                            )}
                        </div>

                        {/* Gwendle Streak */}
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                                Gwendle - Streaks
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                {[5, 7].map(len => (
                                    <button
                                        key={len}
                                        onClick={() => setGwendleLength(len as 5 | 7)}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: gwendleLength === len ? 'var(--pink-accent)' : 'var(--bg-main)',
                                            color: gwendleLength === len ? 'white' : 'var(--text-muted)'
                                        }}
                                    >
                                        {len} Lettres
                                    </button>
                                ))}
                            </div>
                            {loadingStats ? <SkeletonLoader /> : gwendleStreakLeaderboard.length === 0 ? (
                                <EmptyState message="Aucun streak" />
                            ) : (
                                gwendleStreakLeaderboard.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem key={`gwendle-streak-${i}`} itemKey={`gwendle-streak-${i}`} rank={i + 1} username={e.username} value={e.streak} valueLabel="🔥" />
                                ))
                            )}
                        </div>

                        {/* Cemantig */}
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2v20M2 12h20" />
                                    <circle cx="12" cy="12" r="4" />
                                </svg>
                                Cemantig - Victoires
                            </div>
                            {loadingStats ? <SkeletonLoader /> : cemantigLeaderboard.length === 0 ? (
                                <EmptyState message="Aucune victoire" />
                            ) : (
                                cemantigLeaderboard.slice(0, 5).map((e, i) => (
                                    <LeaderboardItem key={`cemantig-${i}`} itemKey={`cemantig-${i}`} rank={i + 1} username={e.username} value={e.wins} valueLabel="victoires" />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Chat Tab */}
                {activeTab === 'chat' && (
                    <div className="leaderboard-grid">
                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Top Messages
                            </div>
                            {loadingStats ? <SkeletonLoader /> : topMessages.length === 0 ? (
                                <EmptyState message="Aucun message" />
                            ) : (
                                topMessages.slice(0, 10).map((e, i) => (
                                    <LeaderboardItem key={`msg-${i}`} itemKey={`msg-${i}`} rank={i + 1} username={e.username} value={e.count} valueLabel="messages" />
                                ))
                            )}
                        </div>

                        <div className="leaderboard-section">
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                    <line x1="9" x2="9.01" y1="9" y2="9" />
                                    <line x1="15" x2="15.01" y1="9" y2="9" />
                                </svg>
                                Emotes populaires
                            </div>
                            {loadingStats ? <SkeletonLoader /> : topEmojis.length === 0 ? (
                                <EmptyState message="Aucune emote" />
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                                    {topEmojis.slice(0, 10).map((e, i) => (
                                        <div key={i} style={{ padding: '0.5rem 1rem', background: 'var(--bg-main)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                            {/* Top users per emote */}
                            {Object.keys(emoteUsers).length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Top utilisateurs par emote</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        {Object.entries(emoteUsers).slice(0, 8).map(([emoji, users]) => (
                                            <div key={emoji} style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    {['xsgwenHug', 'xsgwenHype', 'xsgwenLol', 'xsgwenLove', 'xsgwenOuin', 'xsgwenSip', 'xsgwenWow'].includes(emoji) ? (
                                                        <img src={`/emotes/${emoji}.png`} alt={emoji} style={{ width: '24px', height: '24px' }} />
                                                    ) : (
                                                        <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
                                                    )}
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{emoji}</span>
                                                </div>
                                                {users.map((user, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0', color: i === 0 ? 'var(--pink-accent)' : 'var(--text-muted)' }}>
                                                        <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{i + 1}. {user.username}</span>
                                                        <span>{user.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Watch Time Tab */}
                {activeTab === 'watchtime' && (
                    <div className="leaderboard-grid">
                        <div className="leaderboard-section" style={{ gridColumn: 'span 2' }}>
                            <div className="leaderboard-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Top Viewers
                            </div>
                            {loadingStats ? <SkeletonLoader /> : watchTimeLeaderboard.length === 0 ? (
                                <EmptyState message="Aucune donnée" />
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
                                    {watchTimeLeaderboard.slice(0, 10).map((e, i) => (
                                        <LeaderboardItem key={`watch-${i}`} itemKey={`watch-${i}`} rank={i + 1} username={e.username} value={formatTime(e.watch_time_minutes)} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
