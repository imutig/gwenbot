'use client'

import { useEffect, useState } from 'react'

const styles = `
  .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; }
  .day-card { padding: 1rem; text-align: center; border-radius: 16px; background: var(--bg-card); border: 1px solid var(--border-color); transition: all 0.2s; }
  .day-card.has-stream { border: 2px solid var(--pink-accent); background: linear-gradient(135deg, rgba(255, 105, 180, 0.1), rgba(255, 182, 193, 0.2)); }
  .day-card.today { box-shadow: 0 0 0 3px #999999; }
  .day-name { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.5rem; }
  .day-number { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; }
  .stream-time { font-size: 0.8rem; color: var(--pink-accent); font-weight: 600; }
  .no-stream { font-size: 0.75rem; color: var(--text-muted); opacity: 0.6; }
  .shift-btn { padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-muted); cursor: pointer; opacity: 0.7; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
  .shift-btn:hover { opacity: 1; background: var(--bg-card-hover); }
  .shift-btn:disabled { cursor: wait; opacity: 0.4; }
  @media (max-width: 768px) { .calendar { grid-template-columns: repeat(3, 1fr); } }
`

const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const dayNamesFull = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Base reference date for the stream cycle
const BASE_FIRST_STREAM = new Date('2026-01-07')
BASE_FIRST_STREAM.setHours(0, 0, 0, 0)

function isStreamDay(date: Date, offset: number) {
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    const diffTime = checkDate.getTime() - BASE_FIRST_STREAM.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    // Apply offset: shifting by 1 flips the parity
    return (diffDays - offset) >= 0 && (diffDays - offset) % 2 === 0
}

export default function PlanningPage() {
    const [weekDays, setWeekDays] = useState<Date[]>([])
    const [nextStream, setNextStream] = useState<{ date: string, time: string }>({ date: '', time: '' })
    const [isAdmin, setIsAdmin] = useState(false)
    const [shifting, setShifting] = useState(false)
    const [offset, setOffset] = useState(0)
    const [configLoaded, setConfigLoaded] = useState(false)

    // Load stream config from DB
    useEffect(() => {
        fetch('/api/planning/config')
            .then(res => res.json())
            .then(data => {
                setOffset(data.offset ?? 0)
                setConfigLoaded(true)
            })
            .catch(() => setConfigLoaded(true))
    }, [])

    // Check admin status
    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.user) {
                    const username = data.user.display_name || data.user.user_name
                    if (username) {
                        const authRes = await fetch(`/api/auth/check-admin?username=${username}`)
                        const authData = await authRes.json()
                        setIsAdmin(authData.isAdmin || false)
                    }
                }
            } catch {
                // Not logged in or error
            }
        }
        checkAdmin()
    }, [])

    // Compute week days and next stream
    useEffect(() => {
        if (!configLoaded) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const startOfWeek = new Date(today)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)

        const days = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek)
            d.setDate(startOfWeek.getDate() + i)
            days.push(d)
        }
        setWeekDays(days)

        // Find next stream
        let checkDate = new Date(today)
        for (let i = 0; i < 14; i++) {
            if (isStreamDay(checkDate, offset)) {
                setNextStream({
                    date: `${dayNamesFull[checkDate.getDay()]} ${checkDate.getDate()} ${monthNames[checkDate.getMonth()]}`,
                    time: 'à 22h'
                })
                break
            }
            checkDate.setDate(checkDate.getDate() + 1)
        }
    }, [configLoaded, offset])

    const handleShift = async () => {
        if (shifting) return
        setShifting(true)
        try {
            const res = await fetch('/api/planning/shift', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                setOffset(data.newOffset)
            }
        } catch (error) {
            console.error('Error shifting:', error)
        } finally {
            setShifting(false)
        }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                    Planning des streams
                </h1>

                {/* Schedule Info */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Horaires habituels
                            </h3>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Un jour sur deux, de <strong style={{ color: 'var(--pink-accent)' }}>22h</strong> à <strong style={{ color: 'var(--pink-accent)' }}>2h</strong>
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ width: '12px', height: '12px', background: 'var(--pink-accent)', borderRadius: '3px' }}></span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Jour de stream</span>
                        </div>
                    </div>
                </div>

                {/* Calendar */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <div className="calendar">
                        {weekDays.map((date, i) => {
                            const isToday = date.toDateString() === today.toDateString()
                            const hasStream = isStreamDay(date, offset)
                            return (
                                <div key={i} className={`day-card ${hasStream ? 'has-stream' : ''} ${isToday ? 'today' : ''}`}>
                                    <div className="day-name">{dayNames[date.getDay()]}</div>
                                    <div className="day-number">{date.getDate()}</div>
                                    {hasStream ? (
                                        <div className="stream-time">22h - 2h</div>
                                    ) : (
                                        <div className="no-stream">-</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Next Stream */}
                <div className="glass-card" style={{ overflow: 'hidden', marginBottom: isAdmin ? '1.5rem' : '0' }}>
                    <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(255, 209, 220, 0.5)' }}>
                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Prochain stream
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {nextStream.date}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--pink-accent)', marginTop: '0.25rem' }}>
                            {nextStream.time}
                        </div>
                    </div>
                </div>

                {/* Admin: Shift cycle button */}
                {isAdmin && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            className="shift-btn"
                            onClick={handleShift}
                            disabled={shifting}
                            title="Décaler le cycle de stream de 1 jour"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                                <polyline points="1 4 1 10 7 10" />
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            {shifting ? 'Décalage...' : 'Décaler le cycle'}
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
