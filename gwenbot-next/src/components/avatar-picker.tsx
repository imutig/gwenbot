'use client'

import { useState } from 'react'
import Image from 'next/image'
import FancyButton from '@/components/ui/fancy-button'

interface AvatarPickerProps {
    currentSeed: string
    onSave: (newSeed: string) => void
    onCancel: () => void
}

export default function AvatarPicker({ currentSeed, onSave, onCancel }: AvatarPickerProps) {
    const [seed, setSeed] = useState(currentSeed)
    const [loading, setLoading] = useState(false)

    const randomize = () => {
        setSeed(Math.random().toString(36).substring(7))
    }

    const handleSave = async () => {
        setLoading(true)
        await onSave(seed)
        setLoading(false)
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '2rem',
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                animation: 'slideUp 0.3s ease-out'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Modifier la photo</h3>

                <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '4px solid var(--pink-main)',
                    position: 'relative',
                    background: 'white'
                }}>
                    <Image
                        src={`https://api.dicebear.com/7.x/notionists/png?seed=${seed}&backgroundColor=transparent`}
                        alt="Avatar Preview"
                        fill
                        style={{ objectFit: 'cover' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <input
                        type="text"
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                        placeholder="Graine aléatoire..."
                        style={{
                            flex: 1,
                            padding: '0.5rem 1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}
                    />
                    <button
                        onClick={randomize}
                        style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            width: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--pink-main)'
                            e.currentTarget.style.color = 'var(--pink-main)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)'
                            e.currentTarget.style.color = 'var(--text-primary)'
                        }}
                        title="Aléatoire"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <path d="M16 8h.01" />
                            <path d="M8 8h.01" />
                            <path d="M8 16h.01" />
                            <path d="M16 16h.01" />
                            <path d="M12 12h.01" />
                        </svg>
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            padding: '0.75rem',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        Annuler
                    </button>
                    <FancyButton
                        onClick={handleSave}
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? '...' : 'Sauvegarder'}
                    </FancyButton>
                </div>
            </div>
        </div>
    )
}
