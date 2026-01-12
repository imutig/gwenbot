'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import FancyButton from '@/components/ui/fancy-button'

interface UserProfileWidgetProps {
    username: string
    seed?: string | null
    className?: string
    showAvatar?: boolean
}

export default function UserProfileWidget({ username, seed, className = '', showAvatar = true }: UserProfileWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    const avatarSeed = seed || username

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()

        if (isOpen) {
            setIsOpen(false)
            return
        }

        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
            // Position summary: Center horizontally relative to button, display above if space, else below
            const spaceAbove = rect.top
            const spaceBelow = window.innerHeight - rect.bottom
            const height = 300 // Approx height of card

            let top = rect.bottom + 10
            if (spaceBelow < height && spaceAbove > height) {
                top = rect.top - height - 10
            }

            setCoords({
                top: top + window.scrollY,
                left: rect.left + (rect.width / 2)
            })
        }

        setIsOpen(true)

        if (!stats) {
            setLoading(true)
            try {
                const res = await fetch(`/api/profile/${username}`)
                const data = await res.json()
                if (data.player) {
                    setStats(data)
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        const close = () => setIsOpen(false)
        if (isOpen) {
            window.addEventListener('click', close)
            window.addEventListener('scroll', close, { capture: true })
        }
        return () => {
            window.removeEventListener('click', close)
            window.removeEventListener('scroll', close, { capture: true })
        }
    }, [isOpen])

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleClick}
                className={`user-profile-widget ${className}`}
                style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    font: 'inherit',
                    color: 'inherit',
                    textDecoration: 'none' // remove underline if any
                }}
            >
                {showAvatar && (
                    <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        position: 'relative',
                        border: '1px solid var(--border-color)',
                        flexShrink: 0
                    }}>
                        <Image
                            src={`https://api.dicebear.com/7.x/notionists/png?seed=${avatarSeed}&backgroundColor=transparent`}
                            alt={username}
                            fill
                            style={{ objectFit: 'cover' }}
                        />
                    </div>
                )}
                <span style={{ fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--pink-main)'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                    {username}
                </span>
            </button>

            {isOpen && createPortal(
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        width: '280px',
                        background: '#ffffff', // User explicitly requested white
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid var(--pink-main)',
                        position: 'relative',
                        background: 'white'
                    }}>
                        <Image
                            src={`https://api.dicebear.com/7.x/notionists/png?seed=${stats?.player?.avatar_seed || seed || username}&backgroundColor=transparent`}
                            alt={username}
                            fill
                            style={{ objectFit: 'cover' }}
                        />
                    </div>

                    <div style={{ textAlign: 'center', width: '100%' }}>
                        <h3 style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            margin: 0,
                            color: '#333',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} title={username}>
                            {username}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>
                            {loading ? (
                                <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>Chargement...</span>
                            ) : (
                                stats?.player?.created_at ? `Membre depuis ${new Date(stats.player.created_at).toLocaleDateString()}` : '...'
                            )}
                        </p>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                            <svg style={{ animation: 'spin 1s linear infinite', width: '24px', height: '24px', color: 'var(--pink-main)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
                            </svg>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } @keyframes pulse { 50% { opacity: 0.5; } }`}</style>
                        </div>
                    ) : stats ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%', fontSize: '0.8rem' }}>
                            <div style={{ background: '#f8f9fa', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', color: '#333' }}>
                                <div style={{ fontWeight: 700, color: 'var(--pink-main)', fontSize: '1.1rem' }}>{stats.totalSudokuGames || 0}</div>
                                <div style={{ color: '#666', whiteSpace: 'nowrap' }}>Sudoku</div>
                            </div>
                            <div style={{ background: '#f8f9fa', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', color: '#333' }}>
                                <div style={{ fontWeight: 700, color: 'var(--pink-main)', fontSize: '1.1rem' }}>{stats.totalPictionaryGames || 0}</div>
                                <div style={{ color: '#666', whiteSpace: 'nowrap' }}>Pictionary</div>
                            </div>
                            <div style={{ background: '#f8f9fa', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', color: '#333' }}>
                                <div style={{ fontWeight: 700, color: 'var(--pink-main)', fontSize: '1.1rem' }}>{stats.totalWins || 0}</div>
                                <div style={{ color: '#666', whiteSpace: 'nowrap' }}>Victoires</div>
                            </div>
                            <div style={{ background: '#f8f9fa', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', color: '#333' }}>
                                <div style={{ fontWeight: 700, color: 'var(--pink-main)', fontSize: '1.1rem' }}>{stats.stats?.total_points || 0}</div>
                                <div style={{ color: '#666', whiteSpace: 'nowrap' }}>Cemantix</div>
                            </div>
                        </div>
                    ) : null}

                    <Link href={`/profile/${username}`} style={{ width: '100%' }}>
                        <FancyButton style={{ width: '100%', justifyContent: 'center' }}>
                            Voir le profil
                        </FancyButton>
                    </Link>
                </div>,
                document.body
            )}
        </>
    )
}
