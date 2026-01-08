'use client'

import { useState } from 'react'
import FancyButton from '@/components/ui/fancy-button'

export default function LeaderboardAdminPage() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const handleReset = async (type: 'sudoku' | 'cemantix') => {
        const confirmText = type === 'sudoku'
            ? 'Êtes-vous sûr de vouloir supprimer TOUTES les parties de Sudoku ?'
            : 'Êtes-vous sûr de vouloir supprimer TOUT l\'historique Cemantix ?'

        if (!confirm(confirmText)) return

        setLoading(true)
        setMessage(`Réinitialisation ${type}...`)

        try {
            const res = await fetch('/api/admin/leaderboard/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`Leaderboard ${type} réinitialisé avec succès !`)
            } else {
                setMessage(`Erreur: ${data.error}`)
            }
        } catch (error) {
            console.error('Error resetting leaderboard:', error)
            setMessage('Erreur lors de la réinitialisation')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="animate-slideIn" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <a href="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>←</a>
                Gestion des Classements
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

                {/* Sudoku Reset */}
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(236, 72, 153, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Sudoku</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Supprimer toutes les parties terminées et remettre le classement à zéro.
                    </p>
                    <button
                        onClick={() => handleReset('sudoku')}
                        disabled={loading}
                        className="btn"
                        style={{
                            background: 'var(--red-500)',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            opacity: loading ? 0.7 : 1,
                            border: 'none',
                            fontSize: '1rem'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        Réinitialiser Sudoku
                    </button>
                </div>

                {/* Cemantix Reset */}
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(168, 85, 247, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Cemantix</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        Supprimer l'historique des sessions et remettre le classement à zéro.
                    </p>
                    <button
                        onClick={() => handleReset('cemantix')}
                        disabled={loading}
                        className="btn"
                        style={{
                            background: 'var(--red-500)',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            opacity: loading ? 0.7 : 1,
                            border: 'none',
                            fontSize: '1rem'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        Réinitialiser Cemantix
                    </button>
                </div>

            </div>

            {message && (
                <div style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: message.includes('Erreur') ? 'var(--red-400)' : 'var(--green-400)',
                    border: `1px solid ${message.includes('Erreur') ? 'var(--red-400)' : 'var(--green-400)'}`
                }}>
                    {message}
                </div>
            )}
        </div>
    )
}
