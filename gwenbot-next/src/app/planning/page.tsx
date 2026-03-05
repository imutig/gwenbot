'use client'

import { useEffect, useMemo, useState } from 'react'

type WeeklyStream = {
    dayIndex: number
    streamDate: string
    startTime: string
    endTime: string | null
    game: string | null
    note: string | null
}

type WeeklyPlanningResponse = {
    weekStart: string
    weekEnd: string
    streams: WeeklyStream[]
}

const styles = `
  .plan-shell {
    position: relative;
    overflow: hidden;
    border-radius: 2rem;
    border: 2px solid rgba(255, 255, 255, 0.6);
    background: #fff0f5;
    box-shadow: 0 20px 50px rgba(255, 182, 193, 0.25);
    background-image: radial-gradient(rgba(255, 182, 193, 0.65) 1.2px, transparent 1.2px);
    background-size: 26px 26px;
    padding: 1.4rem;
  }
  .float-flower {
    position: absolute;
    color: rgba(255, 182, 193, 0.5);
    pointer-events: none;
    animation: flowerFloat 7s ease-in-out infinite;
  }
  .float-flower.f2 { animation-delay: 2s; opacity: 0.4; }
  .float-flower.f3 { animation-delay: 4s; opacity: 0.35; }

  .plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .avatar {
    width: 68px;
    height: 68px;
    border-radius: 999px;
    border: 3px solid #ffb6c1;
    object-fit: cover;
    background: #fff;
    box-shadow: 0 8px 18px rgba(255, 182, 193, 0.4);
  }
  .plan-title {
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 700;
    color: #d87093;
    line-height: 1.1;
  }
  .week-pill {
    margin-top: 0.4rem;
    display: inline-block;
    background: #fff;
    color: #5c404c;
    border: 1px solid #ffe4e1;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.3rem 0.8rem;
  }
  .brand-box {
    background: rgba(255, 255, 255, 0.8);
    border: 2px solid #ffe4e1;
    border-radius: 1rem;
    color: #d87093;
    font-weight: 700;
    font-size: 0.95rem;
    padding: 0.55rem 0.8rem;
    text-align: right;
    min-width: 190px;
  }

  .plan-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.55rem;
  }
  .day-col {
    display: flex;
    flex-direction: column;
    min-height: 270px;
    animation: cardIn 450ms ease both;
  }
  .day-head {
    position: relative;
    background: #fff;
    border: 2px solid #ffe4e1;
    border-bottom: 0;
    border-radius: 0.9rem 0.9rem 0 0;
    text-align: center;
    padding: 0.6rem 0.45rem;
  }
  .day-head::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: 0.8rem 0.8rem 0 0;
    background: linear-gradient(90deg, #ffb6c1, #f7a9c4);
  }
  .day-name {
    color: #d87093;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .day-date {
    font-size: 0.74rem;
    color: #8f6170;
    margin-top: 0.1rem;
  }
  .day-body {
    flex: 1;
    border: 2px solid #ffe4e1;
    border-radius: 0 0 0.9rem 0.9rem;
    background: rgba(255,255,255,0.58);
    padding: 0.42rem;
  }
  .stream-card {
    border: 1px solid rgba(255, 182, 193, 0.55);
    border-radius: 0.75rem;
    background: #fff;
    box-shadow: 0 2px 6px rgba(255,182,193,0.2);
    text-align: center;
    min-height: 100%;
    padding: 0.6rem 0.5rem;
  }
  .time-pill {
    display: inline-block;
    background: #ffe4e1;
    color: #5c404c;
    border-radius: 999px;
    font-size: 0.73rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    margin-bottom: 0.45rem;
  }
  .game-name {
    color: #d87093;
    font-weight: 700;
    line-height: 1.2;
    font-size: 0.9rem;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .game-note {
    margin-top: 0.35rem;
    font-size: 0.72rem;
    color: #7f5c66;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .day-col.rest .day-head {
    border-style: dashed;
    background: rgba(255,255,255,0.55);
  }
  .day-col.rest .day-body {
    border-style: dashed;
    background: rgba(255,182,193,0.22);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .zzz-icon { display: flex; align-items: end; gap: 2px; margin-bottom: 0.3rem; }
  .zzz-icon span:nth-child(1) { font-size: 0.8rem; color: rgba(216,112,147,0.7); font-weight: 700; }
  .zzz-icon span:nth-child(2) { font-size: 1rem; color: rgba(216,112,147,0.8); font-weight: 800; }
  .zzz-icon span:nth-child(3) { font-size: 1.3rem; color: rgba(216,112,147,0.95); font-weight: 800; }
  .rest-title { color: #d87093; font-weight: 700; font-size: 0.95rem; }
  .rest-note { color: rgba(92,64,76,0.72); text-align: center; font-size: 0.72rem; margin-top: 0.3rem; }

  .day-col.today .day-head,
  .day-col.today .day-body {
    box-shadow: 0 0 0 2px rgba(216,112,147,0.3) inset;
  }

  .loading { text-align: center; color: var(--text-muted); padding: 2.2rem 0.5rem; }

  @keyframes flowerFloat {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-12px) rotate(8deg); }
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 1200px) {
    .plan-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (max-width: 768px) {
    .plan-shell { padding: 1rem; }
    .plan-header { flex-direction: column; align-items: flex-start; }
    .brand-box { text-align: left; width: 100%; min-width: 0; }
    .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .day-col { min-height: 220px; }
  }
`

const DAY_NAMES_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec']

function weekText(start: string, end: string) {
    const s = new Date(start)
    const e = new Date(end)
    return `Semaine du ${s.getDate()} au ${e.getDate()} ${MONTH_NAMES[e.getMonth()]}`
}

function formatDateLabel(isoDate: string) {
    const d = new Date(isoDate)
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

export default function PlanningPage() {
    const [data, setData] = useState<WeeklyPlanningResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const loadPlanning = async () => {
            try {
                const res = await fetch('/api/planning/weekly', { cache: 'no-store' })
                if (!res.ok) throw new Error('Impossible de charger le planning')
                const json = await res.json()
                setData(json)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Erreur inconnue')
            } finally {
                setLoading(false)
            }
        }
        loadPlanning()
    }, [])

    const todayISO = useMemo(() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d.toISOString().split('T')[0]
    }, [])

    return (
        <>
            <style>{styles}</style>
            <div className="animate-slideIn">
                <div className="plan-shell">
                    <div className="float-flower" style={{ top: '-18px', left: '-18px', width: '120px', height: '120px' }}>🌸</div>
                    <div className="float-flower f2" style={{ top: '58px', right: '-8px', width: '78px', height: '78px' }}>🌸</div>
                    <div className="float-flower f3" style={{ bottom: '22px', left: '16%', width: '66px', height: '66px' }}>🌸</div>

                    <div className="plan-header">
                        <div className="header-left">
                            <img src={process.env.NEXT_PUBLIC_PLANNING_AVATAR_URL || '/jennie/gwen.jpg'} alt="Avatar" className="avatar" />
                            <div>
                                <h1 className="plan-title">Planning de la semaine</h1>
                                <div className="week-pill">{data ? weekText(data.weekStart, data.weekEnd) : 'Chargement...'}</div>
                            </div>
                        </div>
                        <div className="brand-box">
                            <div>@xsgwen</div>
                            <div>twitch.tv/xsgwen</div>
                        </div>
                    </div>

                    {loading && <div className="loading">Chargement du planning...</div>}
                    {!loading && error && <div className="loading">{error}</div>}

                    {!loading && !error && data && (
                        <div className="plan-grid">
                            {DAY_NAMES_FULL.map((dayName, index) => {
                                const stream = data.streams.find((s) => s.dayIndex === index) || null
                                const streamDate = stream?.streamDate || new Date(new Date(data.weekStart).setDate(new Date(data.weekStart).getDate() + index)).toISOString().split('T')[0]
                                const isToday = streamDate === todayISO

                                if (!stream) {
                                    return (
                                        <div key={dayName} className={`day-col rest ${isToday ? 'today' : ''}`} style={{ animationDelay: `${index * 55}ms` }}>
                                            <div className="day-head">
                                                <div className="zzz-icon" aria-label="Repos"><span>z</span><span>Z</span><span>Z</span></div>
                                                <div className="day-name">{dayName}</div>
                                                <div className="day-date">{formatDateLabel(streamDate)}</div>
                                            </div>
                                            <div className="day-body">
                                                <div className="rest-title">Repos</div>
                                                <div className="rest-note">Je dors pour reprendre des forces !</div>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div key={dayName} className={`day-col ${isToday ? 'today' : ''}`} style={{ animationDelay: `${index * 55}ms` }}>
                                        <div className="day-head">
                                            <div className="day-name">{dayName}</div>
                                            <div className="day-date">{formatDateLabel(stream.streamDate)}</div>
                                        </div>
                                        <div className="day-body">
                                            <div className="stream-card">
                                                <div className="time-pill">{stream.endTime ? `${stream.startTime} - ${stream.endTime}` : stream.startTime}</div>
                                                <p className="game-name">{stream.game || 'Just Chatting'}</p>
                                                {stream.note && <p className="game-note">{stream.note}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
