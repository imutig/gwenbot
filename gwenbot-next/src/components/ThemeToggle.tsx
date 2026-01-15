'use client'

import { useState, useEffect } from 'react'

const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
    </svg>
)

const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
)

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Check localStorage or system preference
        const stored = localStorage.getItem('theme')
        if (stored === 'dark' || stored === 'light') {
            setTheme(stored)
            document.documentElement.setAttribute('data-theme', stored)
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark')
            document.documentElement.setAttribute('data-theme', 'dark')
        }
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    // Avoid hydration mismatch
    if (!mounted) {
        return (
            <button
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                }}
                aria-label="Toggle theme"
            />
        )
    }

    return (
        <button
            onClick={toggleTheme}
            style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.color = 'var(--pink-accent)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.color = 'var(--text-muted)'
            }}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
        >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
    )
}
