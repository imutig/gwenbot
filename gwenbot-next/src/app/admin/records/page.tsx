'use client'

import { useState, useEffect } from 'react'
import FancyButton from '@/components/ui/fancy-button'
import Loader from '@/components/ui/loader'

interface RecordsData {
    fr: { alltime: { score: number, date: string }, monthly: { score: number, date: string } }
    en: { alltime: { score: number, date: string }, monthly: { score: number, date: string } }
}

export default function RecordsAdminPage() {
    const [records, setRecords] = useState<RecordsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

    const [newScoreFr, setNewScoreFr] = useState('')
    const [newScoreEn, setNewScoreEn] = useState('')

    const fetchRecords = async () => {
        try {
            const res = await fetch('/api/records')
            const data = await res.json()
            if (data) {
                const formatted = {
                    fr: {
                        alltime: data.fr?.alltime || { score: 0, date: '' },
                        monthly: data.fr?.monthly || { score: 0, date: '' }
                    },
                    en: {
                        alltime: data.en?.alltime || { score: 0, date: '' },
                        monthly: data.en?.monthly || { score: 0, date: '' }
                    }
                }
                setRecords(formatted)
            }
        } catch (error) {
            console.error('Error fetching records:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRecords()
    }, [])

    const handleUpdate = async (lang: 'fr' | 'en') => {
        const score = lang === 'fr' ? newScoreFr : newScoreEn
        if (!score) {
            setMessage('Score requis')
            return
        }

        setMessage('Mise à jour...')

        try {
            const res = await fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: lang,
                    score: Number(score)
                })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`Records ${lang.toUpperCase()} mis à jour !`)
                if (lang === 'fr') setNewScoreFr('')
                else setNewScoreEn('')
                fetchRecords()
            } else {
                setMessage(`Erreur: ${data.error}`)
            }
        } catch (error) {
            console.error('Error updating records:', error)
            setMessage('Erreur lors de la mise à jour')
        }
    }

    const renderCurrentRecords = (lang: 'fr' | 'en') => {
        if (!records) return null
        const current = records[lang]

        return (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-base)', borderRadius: '8px', fontSize: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Record Absolu</div>
                        <div style={{ fontWeight: 600, color: 'var(--pink-accent)' }}>{current.alltime?.score || '0'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{current.alltime?.date || '-'}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Record du Mois</div>
                        <div style={{ fontWeight: 600, color: 'var(--purple-accent)' }}>{current.monthly?.score || '0'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{current.monthly?.date || '-'}</div>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader /></div>

    return (
        <div className="animate-slideIn" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <a href="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>←</a>
                Gestion des Records
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {/* French Records */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>🇫🇷 Records Français</h3>

                    {renderCurrentRecords('fr')}

                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mettre à jour</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                            type="number"
                            placeholder="Nouveau score (Nb coups)"
                            value={newScoreFr}
                            onChange={(e) => setNewScoreFr(e.target.value)}
                            className="input-field"
                            style={{ flex: 1 }}
                        />
                    </div>
                    <FancyButton onClick={() => handleUpdate('fr')} size="sm">
                        Mettre à jour
                    </FancyButton>
                </div>

                {/* English Records */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>🇬🇧 Records Anglais</h3>

                    {renderCurrentRecords('en')}

                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mettre à jour</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                            type="number"
                            placeholder="Nouveau score (Nb coups)"
                            value={newScoreEn}
                            onChange={(e) => setNewScoreEn(e.target.value)}
                            className="input-field"
                            style={{ flex: 1 }}
                        />
                    </div>
                    <FancyButton onClick={() => handleUpdate('en')} size="sm">
                        Mettre à jour
                    </FancyButton>
                </div>
            </div>

            {message && (
                <div style={{
                    marginTop: '1.5rem',
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
