'use client'

import { useState, useEffect } from 'react'

const COOKIE_CONSENT_KEY = 'cookie-consent'

type ConsentStatus = 'pending' | 'accepted' | 'rejected'

export function useCookieConsent() {
    const [consent, setConsent] = useState<ConsentStatus>('pending')

    useEffect(() => {
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
        if (stored === 'accepted' || stored === 'rejected') {
            setConsent(stored)
        }
    }, [])

    const acceptCookies = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
        setConsent('accepted')
    }

    const rejectCookies = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected')
        setConsent('rejected')
    }

    return { consent, acceptCookies, rejectCookies }
}

export default function CookieConsent() {
    const { consent, acceptCookies, rejectCookies } = useCookieConsent()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Delay showing the banner slightly for better UX
        if (consent === 'pending') {
            const timer = setTimeout(() => setIsVisible(true), 1000)
            return () => clearTimeout(timer)
        } else {
            setIsVisible(false)
        }
    }, [consent])

    if (!isVisible) return null

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-color)',
            padding: '1rem 2rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            <p style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                maxWidth: '600px'
            }}>
                🍪 Ce site utilise des cookies pour analyser le trafic via Google Analytics.
                Aucune donnée personnelle n&apos;est partagée à des fins publicitaires.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={rejectCookies}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    Refuser
                </button>
                <button
                    onClick={acceptCookies}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--pink-accent)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600
                    }}
                >
                    Accepter
                </button>
            </div>
        </div>
    )
}
