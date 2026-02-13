'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import FancyButton from '@/components/ui/fancy-button'
import UserSearch from '@/components/user-search'
import ThemeToggle from '@/components/ThemeToggle'

import { getTwitchUsername } from '@/lib/auth-utils'

// Game links for dropdown
const gameLinks = [
    { href: '/cemantix', label: 'Cemantix', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg> },
    { href: '/cemantig', label: 'Cemantig', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M12 2v20M2 12h20" /><circle cx="12" cy="12" r="4" /></svg> },
    { href: '/gwendle', label: 'Gwendle', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="10" y="3" rx="1" /><rect width="5" height="5" x="17" y="3" rx="1" /><rect width="5" height="5" x="3" y="10" rx="1" /><rect width="5" height="5" x="10" y="10" rx="1" /></svg> },
    { href: '/gwenshin', label: 'Gwenshin', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><circle cx="12" cy="12" r="10" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="4" /></svg> },
    { href: '/memory', label: 'Memory', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><rect width="6" height="6" x="3" y="3" rx="1" /><rect width="6" height="6" x="15" y="3" rx="1" /><rect width="6" height="6" x="3" y="15" rx="1" /><rect width="6" height="6" x="15" y="15" rx="1" /></svg> },
    { href: '/connect4', label: 'P4', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="12" cy="12" r="3" /><circle cx="18" cy="12" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="12" cy="18" r="3" /></svg> },
    { href: '/sudoku', label: 'Sudoku', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg> },
    { href: '/pictionary', label: 'Pictionary', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg> },
    { href: '/gwenguessr', label: 'GwenGuessr', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg> },
    { href: '/chatguessr', label: 'ChatGuessr', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
    { href: '/bingwen', label: 'Bingwen', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M3 3h18v18H3z" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg> },
]

const navLinks = [
    { href: '/', label: 'Accueil', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
    { href: '/planning', label: 'Planning', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg> },
    { href: '/clips', label: 'Clips', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 8 6 4-6 4Z" /></svg> },
    { href: '/commands', label: 'Commandes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></svg> },
    { href: '/stats', label: 'Stats', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg> },
]

const adminLinks = [
    { href: '/admin', label: 'Gestion', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}><line x1="4" x2="20" y1="21" y2="21" /><line x1="4" x2="20" y1="14" y2="14" /><line x1="4" x2="20" y1="7" y2="7" /><circle cx="12" cy="14" r="2" /><circle cx="12" cy="7" r="2" /><circle cx="12" cy="21" r="2" /></svg> },
]

// Chevron icon for dropdown
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{
            width: '14px',
            height: '14px',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }}
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
)

// Gamepad icon
const GamepadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
        <line x1="6" x2="10" y1="12" y2="12" />
        <line x1="8" x2="8" y1="10" y2="14" />
        <line x1="15" x2="15.01" y1="13" y2="13" />
        <line x1="18" x2="18.01" y1="11" y2="11" />
        <rect width="20" height="12" x="2" y="6" rx="2" />
    </svg>
)

// Hamburger icon for mobile menu
const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: '24px', height: '24px' }}
    >
        {isOpen ? (
            <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </>
        ) : (
            <>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
            </>
        )}
    </svg>
)

export default function Navbar() {
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [gamesOpen, setGamesOpen] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const gamesRef = useRef<HTMLLIElement>(null)
    const supabase = createClient()

    // Check if current page is a game page
    const isGamePage = gameLinks.some(link => pathname === link.href)

    // ... existing code ...

    useEffect(() => {
        if (!supabase) return

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const username = getTwitchUsername(user)
                const { data } = await supabase
                    .from('authorized_users')
                    .select('username')
                    .eq('username', username)
                    .single()
                setIsAdmin(!!data)
            }
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (gamesRef.current && !gamesRef.current.contains(event.target as Node)) {
                setGamesOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <nav className="main-nav">
            <div className="nav-container">
                {/* Logo */}
                <Link href="/" className="nav-logo">
                    <Image
                        src="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png"
                        alt="xsgwen"
                        width={40}
                        height={40}
                    />
                    <span>xsgwen</span>
                </Link>

                {/* Nav Links */}
                <ul className="nav-links">
                    {/* Accueil */}
                    <li className={pathname === '/' ? 'active' : ''}>
                        <Link href="/">
                            {navLinks[0].icon}
                            {navLinks[0].label}
                        </Link>
                    </li>

                    {/* Games Dropdown */}
                    <li
                        ref={gamesRef}
                        className={isGamePage ? 'active' : ''}
                        style={{ position: 'relative' }}
                    >
                        <button
                            onClick={() => setGamesOpen(!gamesOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '10px',
                                fontFamily: 'inherit',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <GamepadIcon />
                            Jeux
                            <ChevronIcon isOpen={gamesOpen} />
                        </button>

                        {/* Dropdown Menu */}
                        {gamesOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '0',
                                marginTop: '0.5rem',
                                background: 'var(--bg-card)',
                                borderRadius: '12px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                border: '1px solid var(--border-color)',
                                padding: '0.5rem',
                                minWidth: '160px',
                                zIndex: 100
                            }}>
                                {gameLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setGamesOpen(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            color: pathname === link.href ? 'var(--pink-accent)' : 'inherit',
                                            background: pathname === link.href ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = pathname === link.href ? 'rgba(236, 72, 153, 0.1)' : 'transparent'}
                                    >
                                        {link.icon}
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </li>

                    {/* Other nav links (skip Accueil which is index 0) */}
                    {navLinks.slice(1).map((link) => (
                        <li key={link.href} className={pathname === link.href ? 'active' : ''}>
                            <Link href={link.href}>
                                {link.icon}
                                {link.label}
                            </Link>
                        </li>
                    ))}

                    {/* Admin links */}
                    {isAdmin && adminLinks.map((link) => (
                        <li key={link.href} className={pathname === link.href ? 'active' : ''}>
                            <Link href={link.href}>
                                {link.icon}
                                {link.label}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Hamburger Button - Mobile Only */}
                <button
                    className="hamburger-btn"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                    style={{
                        display: 'none',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        color: 'var(--text-primary)',
                        marginLeft: 'auto'
                    }}
                >
                    <HamburgerIcon isOpen={mobileMenuOpen} />
                </button>

                {/* User Search - Desktop */}
                <div className="hidden md:block">
                    <UserSearch />
                </div>

                {/* Theme Toggle & Auth Section */}
                <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ThemeToggle />
                    {user ? (
                        <>
                            <Link href={`/profile/${getTwitchUsername(user)}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                                <Image
                                    src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                                    alt={getTwitchUsername(user) || 'User'}
                                    width={32}
                                    height={32}
                                    style={{ borderRadius: '50%', border: '2px solid var(--pink-main)' }}
                                />
                                <span className="user-name-desktop" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                                    {getTwitchUsername(user)}
                                </span>
                            </Link>
                            <button
                                className="logout-btn-desktop"
                                onClick={() => supabase?.auth.signOut()}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                Déconnexion
                            </button>
                        </>
                    ) : (
                        <Link href="/auth/login" className="login-btn-desktop" style={{ textDecoration: 'none' }}>
                            <FancyButton size="xs">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.5rem' }}>
                                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                                </svg>
                                Connexion
                            </FancyButton>
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Menu Portal */}
            {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className="mobile-menu-overlay"
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 9998
                        }}
                    />

                    <div
                        className="mobile-menu"
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '280px',
                            maxWidth: '85vw',
                            background: 'var(--bg-base)',
                            zIndex: 9999,
                            transform: 'translateX(0)',
                            animation: 'slideIn 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1rem',
                            overflowY: 'auto',
                            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
                        }}
                    >
                        {/* Mobile menu header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <ThemeToggle />
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <HamburgerIcon isOpen={true} />
                            </button>
                        </div>

                        {/* User info in mobile */}
                        {user && (
                            <Link href={`/profile/${getTwitchUsername(user)}`} onClick={() => setMobileMenuOpen(false)} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                marginBottom: '1rem',
                                background: 'var(--bg-card)',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                color: 'inherit'
                            }}>
                                <Image
                                    src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                                    alt={getTwitchUsername(user) || 'User'}
                                    width={40}
                                    height={40}
                                    style={{ borderRadius: '50%', border: '2px solid var(--pink-main)' }}
                                />
                                <span style={{ fontWeight: 500 }}>{getTwitchUsername(user)}</span>
                            </Link>
                        )}

                        {/* Mobile nav links */}
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ padding: '0 0 1rem 0' }}>
                                <UserSearch />
                            </div>
                            {navLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.875rem 1rem',
                                        borderRadius: '10px',
                                        textDecoration: 'none',
                                        color: pathname === link.href ? 'var(--pink-accent)' : 'var(--text-primary)',
                                        background: pathname === link.href ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                        fontWeight: 500,
                                        fontSize: '1rem'
                                    }}
                                >
                                    {link.icon}
                                    {link.label}
                                </Link>
                            ))}

                            {/* Games section */}
                            <div style={{
                                marginTop: '0.5rem',
                                paddingTop: '0.5rem',
                                borderTop: '1px solid var(--border-color)'
                            }}>
                                <span style={{
                                    display: 'block',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Jeux
                                </span>
                                {gameLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '10px',
                                            textDecoration: 'none',
                                            color: pathname === link.href ? 'var(--pink-accent)' : 'var(--text-primary)',
                                            background: pathname === link.href ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                            fontWeight: 500,
                                            fontSize: '1rem'
                                        }}
                                    >
                                        {link.icon}
                                        {link.label}
                                    </Link>
                                ))}
                            </div>

                            {/* Admin links */}
                            {isAdmin && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px solid var(--border-color)'
                                }}>
                                    {adminLinks.map(link => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '10px',
                                                textDecoration: 'none',
                                                color: pathname === link.href ? 'var(--pink-accent)' : 'var(--text-primary)',
                                                background: pathname === link.href ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                                                fontWeight: 500,
                                                fontSize: '1rem'
                                            }}
                                        >
                                            {link.icon}
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </nav>

                        {/* Mobile auth */}
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            {user ? (
                                <button
                                    onClick={() => {
                                        supabase?.auth.signOut()
                                        setMobileMenuOpen(false)
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem 1rem',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: 500
                                    }}
                                >
                                    Déconnexion
                                </button>
                            ) : (
                                <Link
                                    href="/auth/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    style={{ textDecoration: 'none', display: 'block' }}
                                >
                                    <FancyButton style={{ width: '100%', justifyContent: 'center' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.5rem' }}>
                                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                                        </svg>
                                        Connexion avec Twitch
                                    </FancyButton>
                                </Link>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </nav>
    )
}
