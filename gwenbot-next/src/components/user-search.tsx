'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import useDebounce from '@/lib/hooks/use-debounce'

interface UserResult {
    username: string
}

interface UserSearchProps {
    variant?: 'compact' | 'full'
}

export default function UserSearch({ variant = 'compact' }: UserSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserResult[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Inline debounce logic since the hook is external
    const [debouncedQuery, setDebouncedQuery] = useState(query)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(query)
        }, 300)
        return () => clearTimeout(handler)
    }, [query])

    useEffect(() => {
        const searchUsers = async () => {
            if (debouncedQuery.length < 2) {
                setResults([])
                return
            }

            setLoading(true)
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`)
                const data = await res.json()
                setResults(data.users || [])
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setLoading(false)
            }
        }

        searchUsers()
    }, [debouncedQuery])

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (username: string) => {
        router.push(`/profile/${username}`)
        setIsOpen(false)
        setQuery('')
    }

    const toggleOpen = () => {
        setIsOpen(!isOpen)
        // Focus input after opening
        if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }

    // --- FULL MODE (Mobile) ---
    if (variant === 'full') {
        return (
            <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Chercher..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255, 255, 255, 0.4)',
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                    />
                    <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" x2="16.65" y1="21" y2="16.65" />
                        </svg>
                    </div>
                </div>
                {/* Results Dropdown (Inline) */}
                {(results.length > 0 || (loading && query.length >= 2)) && (
                    <div style={{
                        marginTop: '0.5rem',
                        background: 'var(--bg-card)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        padding: '0.5rem',
                        boxShadow: '0 4px 12px var(--shadow-color)'
                    }}>
                        {loading && results.length === 0 ? (
                            <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chargement...</div>
                        ) : (
                            results.map((user) => (
                                <button
                                    key={user.username}
                                    onClick={() => handleSelect(user.username)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem',
                                        border: 'none', background: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                                        overflow: 'hidden' // Ensure button respects overflow
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        flexShrink: 0 // Prevent shrinking
                                    }}>
                                        <Image src={`https://api.dicebear.com/7.x/notionists/png?seed=${user.username}`} alt={user.username} fill style={{ objectFit: 'cover' }} />
                                    </div>
                                    <span style={{
                                        fontSize: '0.9rem',
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {user.username}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        )
    }

    // --- COMPACT MODE (Desktop - Popover) ---
    return (
        <div ref={containerRef} style={{ position: 'relative', width: '40px', height: '40px' }}>
            <button
                onClick={toggleOpen}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isOpen ? 'var(--pink-main)' : 'rgba(255, 255, 255, 0.1)',
                    color: isOpen ? 'white' : 'var(--text-muted)',
                    border: isOpen ? 'none' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: 0
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)' }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '50px', // Explicitly below the 40px button + gap
                    right: '-10px',
                    width: '280px',
                    background: 'var(--bg-card)', // Ensure solid background (glassmorphism via CSS var if available) or use rgba
                    backdropFilter: 'blur(16px)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Fallback opacity for legibility
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    padding: '1rem',
                    zIndex: 9999, // Ensure it's on top of everything
                    animation: 'slideIn 0.2s ease-out'
                }}>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Rechercher un joueur..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            outline: 'none',
                            marginBottom: (results.length > 0 || loading) ? '0.75rem' : '0'
                        }}
                    />

                    {(results.length > 0 || (loading && query.length >= 2)) && (
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {loading && results.length === 0 ? (
                                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Chargement en cours...</div>
                            ) : (
                                results.map((user) => (
                                    <button
                                        key={user.username}
                                        onClick={() => handleSelect(user.username)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.6rem',
                                            border: 'none', background: 'none', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                                            transition: 'background 0.2s',
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden' // Ensure button respects overflow
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.15)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            border: '2px solid var(--pink-pastel)',
                                            flexShrink: 0, // Prevent shrinking
                                        }}>
                                            <Image src={`https://api.dicebear.com/7.x/notionists/png?seed=${user.username}`} alt={user.username} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
                                            <span style={{
                                                fontSize: '0.95rem',
                                                color: 'var(--text-primary)',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: 'block'
                                            }}>
                                                {user.username}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
