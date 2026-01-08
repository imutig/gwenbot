'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Loader from '@/components/ui/loader'
import FancyButton from '@/components/ui/fancy-button'

const styles = `
  .clips-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
  .clip-card { border-radius: 16px; overflow: hidden; background: var(--bg-card); transition: all 0.3s; cursor: pointer; }
  .clip-card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px var(--shadow-color); }
  .clip-thumbnail { position: relative; padding-top: 56.25%; background: var(--bg-input); }
  .clip-thumbnail img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
  .clip-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; transition: all 0.2s; }
  .clip-card:hover .clip-play { background: var(--pink-accent); transform: translate(-50%, -50%) scale(1.1); }
  .clip-info { padding: 1rem; }
  .clip-title { font-weight: 600; margin-bottom: 0.5rem; line-height: 1.3; }
  .clip-meta { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .clip-meta-item { display: flex; align-items: center; gap: 0.3rem; }
  .clip-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s; }
  .clip-modal { width: 90%; max-width: 1200px; background: var(--bg-card); border-radius: 16px; overflow: hidden; animation: slideUp 0.3s; }
  .clip-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
  .clip-modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.5rem; }
  .clip-modal-close:hover { color: var(--text-primary); }
  .clip-modal-video { aspect-ratio: 16/9; width: 100%; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`

// Icons
const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
)

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
)

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
        <line x1="18" x2="6" y1="6" y2="18" />
        <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
)

interface Clip {
    id: string
    url: string
    embedUrl: string
    title: string
    thumbnail: string
    views: number
    createdAt: string
    creator: string
    duration: number
}

export default function ClipsPage() {
    const [clips, setClips] = useState<Clip[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
    const [sortBy, setSortBy] = useState<'views' | 'date'>('views')

    useEffect(() => {
        fetch('/api/clips')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(data.error)
                } else {
                    setClips(data.clips || [])
                }
                setLoading(false)
            })
            .catch(err => {
                console.error('Error loading clips:', err)
                setError('Erreur lors du chargement des clips')
                setLoading(false)
            })
    }, [])

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedClip(null)
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [])

    // Sort clips based on selected option and limit to 12
    const sortedClips = [...clips].sort((a, b) => {
        if (sortBy === 'views') return b.views - a.views
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }).slice(0, 12)

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatViews = (views: number) => {
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
        return views.toString()
    }

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="m9 8 6 4-6 4Z" />
                    </svg>
                    Clips & Moments
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Les meilleurs moments des streams</p>

                {/* Twitch Clips */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <svg viewBox="0 0 24 24" fill="#9146FF" style={{ width: '24px', height: '24px' }}>
                                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                            </svg>
                            Top Clips Twitch
                        </h2>

                        {/* Sort Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trier par :</span>
                            <button
                                onClick={() => setSortBy('views')}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: sortBy === 'views' ? 'var(--pink-accent)' : 'var(--bg-card)',
                                    color: sortBy === 'views' ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <EyeIcon /> Vues
                            </button>
                            <button
                                onClick={() => setSortBy('date')}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: sortBy === 'date' ? 'var(--pink-accent)' : 'var(--bg-card)',
                                    color: sortBy === 'date' ? 'white' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <CalendarIcon /> Récent
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
                            <Loader text="Chargement des clips..." />
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                        </div>
                    ) : sortedClips.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Aucun clip trouvé</p>
                        </div>
                    ) : (
                        <div className="clips-grid">
                            {sortedClips.map(clip => (
                                <div
                                    key={clip.id}
                                    className="clip-card"
                                    onClick={() => setSelectedClip(clip)}
                                >
                                    <div className="clip-thumbnail">
                                        <Image
                                            src={clip.thumbnail}
                                            alt={clip.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 320px"
                                            style={{ objectFit: 'cover' }}
                                        />
                                        <div className="clip-play">
                                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px', marginLeft: '3px' }}>
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '8px',
                                            right: '8px',
                                            background: 'rgba(0,0,0,0.8)',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            color: 'white'
                                        }}>
                                            {formatDuration(clip.duration)}
                                        </div>
                                    </div>
                                    <div className="clip-info">
                                        <div className="clip-title">{clip.title}</div>
                                        <div className="clip-meta">
                                            <span className="clip-meta-item"><UserIcon /> {clip.creator}</span>
                                            <span className="clip-meta-item"><EyeIcon /> {formatViews(clip.views)}</span>
                                            <span className="clip-meta-item"><CalendarIcon /> {new Date(clip.createdAt).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <a href="https://www.twitch.tv/xsgwen/clips" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" x2="21" y1="14" y2="3" />
                            </svg>
                            Voir tous les clips
                        </a>
                    </div>
                </section>

                {/* TikTok Section */}
                <section style={{ marginTop: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ff0050" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                            <path d="m22 8-6 4 6 4V8Z" />
                            <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                        </svg>
                        TikTok
                    </h2>
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Retrouve les meilleures vidéos sur TikTok !
                        </p>
                        <a href="https://www.tiktok.com/@xsgwen" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <FancyButton>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', marginRight: '0.5rem' }}>
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" x2="21" y1="14" y2="3" />
                                </svg>
                                Voir le TikTok
                            </FancyButton>
                        </a>
                    </div>
                </section>
            </div>

            {/* Clip Player Modal */}
            {selectedClip && (
                <div className="clip-modal-overlay" onClick={() => setSelectedClip(null)}>
                    <div className="clip-modal" onClick={e => e.stopPropagation()}>
                        <div className="clip-modal-header">
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedClip.title}</h3>
                            <button className="clip-modal-close" onClick={() => setSelectedClip(null)}>
                                <CloseIcon />
                            </button>
                        </div>
                        <iframe
                            className="clip-modal-video"
                            src={`https://clips.twitch.tv/embed?clip=${selectedClip.id}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
                            allowFullScreen
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>
            )}
        </>
    )
}
