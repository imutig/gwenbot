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
  .planning-page-wrap {
    width: min(96vw, 1760px);
    margin: 0;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
  }
  .plan-shell {
    position: relative;
    overflow: hidden;
    border-radius: 2rem;
    border: 2px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-card) 88%, white 12%);
    box-shadow: 0 20px 55px color-mix(in srgb, var(--shadow-color) 78%, transparent 22%);
    background-image: radial-gradient(color-mix(in srgb, var(--pink-main) 35%, transparent 65%) 1.2px, transparent 1.2px);
    background-size: 26px 26px;
    padding: 2rem 2rem 2.2rem;
    min-height: 720px;
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
    border: 3px solid color-mix(in srgb, var(--pink-main) 70%, white 30%);
    object-fit: cover;
    background: var(--bg-base);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--shadow-color) 85%, transparent 15%);
  }
  .plan-title {
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 700;
    color: var(--pink-dark);
    line-height: 1.1;
  }
  .week-pill {
    margin-top: 0.4rem;
    display: inline-block;
    background: color-mix(in srgb, var(--bg-base) 92%, white 8%);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.3rem 0.8rem;
  }
  .brand-box {
    background: color-mix(in srgb, var(--bg-card) 88%, white 12%);
    border: 2px solid var(--border-color);
    border-radius: 1rem;
    color: var(--pink-dark);
    font-weight: 700;
    font-size: 0.95rem;
    padding: 0.55rem 0.8rem;
    text-align: right;
    min-width: 190px;
  }
  .brand-line {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .brand-line + .brand-line { margin-top: 0.2rem; }
  .brand-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .plan-grid-wrap {
    overflow: visible;
  }
  .plan-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    width: 100%;
    gap: 0.95rem;
  }
  .day-col {
    display: flex;
    flex-direction: column;
    min-height: 500px;
    animation: cardIn 450ms ease both;
  }
  .day-head {
    position: relative;
    background: color-mix(in srgb, var(--bg-card) 92%, white 8%);
    border: 2px solid var(--border-color);
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
    background: linear-gradient(90deg, color-mix(in srgb, var(--pink-main) 70%, white 30%), color-mix(in srgb, var(--pink-dark) 55%, white 45%));
  }
  .day-name {
    color: var(--pink-dark);
    font-weight: 700;
    font-size: 0.95rem;
  }
  .day-date {
    font-size: 0.74rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
  }
  .day-body {
    flex: 1;
    border: 2px solid var(--border-color);
    border-radius: 0 0 0.9rem 0.9rem;
    background: color-mix(in srgb, var(--bg-card) 78%, transparent 22%);
    padding: 0.55rem;
  }
  .stream-card {
    border: 1px solid color-mix(in srgb, var(--pink-main) 45%, transparent 55%);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--bg-card) 90%, white 10%);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--shadow-color) 70%, transparent 30%);
    text-align: center;
    display: inline-flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    padding: 0.75rem 0.6rem;
  }
  .time-pill {
    display: inline-block;
    background: color-mix(in srgb, var(--pink-pastel) 45%, var(--bg-base) 55%);
    color: var(--text-primary);
    border-radius: 999px;
    font-size: 0.73rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    margin-bottom: 0.45rem;
  }
  .game-name {
    color: var(--pink-dark);
    font-weight: 700;
    line-height: 1.2;
    font-size: 0.98rem;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .game-note {
    margin-top: 0.35rem;
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .day-col.rest .day-head {
    border-style: dashed;
    background: color-mix(in srgb, var(--bg-card) 70%, transparent 30%);
  }
  .day-col.rest .day-body {
    border-style: dashed;
    background: color-mix(in srgb, var(--pink-pastel) 22%, transparent 78%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .zzz-icon { display: flex; align-items: end; justify-content: center; width: 100%; gap: 2px; margin: 0 auto 0.3rem auto; line-height: 1; }
  .zzz-icon span:nth-child(1) { font-size: 0.8rem; color: color-mix(in srgb, var(--pink-dark) 68%, transparent 32%); font-weight: 700; }
  .zzz-icon span:nth-child(2) { font-size: 1rem; color: color-mix(in srgb, var(--pink-dark) 82%, transparent 18%); font-weight: 800; }
  .zzz-icon span:nth-child(3) { font-size: 1.3rem; color: color-mix(in srgb, var(--pink-dark) 95%, transparent 5%); font-weight: 800; }
  .rest-title { color: var(--pink-dark); font-weight: 700; font-size: 0.95rem; }
  .rest-note { color: color-mix(in srgb, var(--text-primary) 72%, transparent 28%); text-align: center; font-size: 0.72rem; margin-top: 0.3rem; }

  .day-col.today .day-head,
  .day-col.today .day-body {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--pink-dark) 35%, transparent 65%) inset;
  }

  [data-theme="dark"] .plan-shell {
    background: color-mix(in srgb, var(--bg-card) 88%, #1a1520 12%);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(240, 119, 170, 0.1) inset;
    background-image: radial-gradient(rgba(240, 119, 170, 0.22) 1.2px, transparent 1.2px);
  }
  [data-theme="dark"] .brand-box,
  [data-theme="dark"] .day-head,
  [data-theme="dark"] .stream-card {
    background: color-mix(in srgb, var(--bg-card) 88%, #2a2030 12%);
  }
  [data-theme="dark"] .day-body {
    background: color-mix(in srgb, var(--bg-card) 70%, transparent 30%);
  }
  [data-theme="dark"] .day-col.rest .day-body {
    background: rgba(212, 165, 190, 0.13);
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

  @media (max-width: 1450px) {
    .plan-shell {
      min-height: 660px;
      padding: 1.6rem;
    }
    .plan-grid {
      gap: 0.6rem;
    }
    .day-col {
      min-height: 450px;
    }
  }
  @media (max-width: 1200px) {
    .planning-page-wrap {
      width: 100%;
      left: 0;
      transform: none;
    }
    .plan-grid {
      grid-template-columns: repeat(7, minmax(125px, 1fr));
      gap: 0.5rem;
    }
    .day-col { min-height: 360px; }
  }
  @media (max-width: 768px) {
    .plan-shell { padding: 1rem; min-height: 0; }
    .plan-header { flex-direction: column; align-items: flex-start; }
    .brand-box { text-align: left; width: 100%; min-width: 0; }
    .brand-line { justify-content: flex-start; }
    .plan-grid-wrap {
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 0.35rem;
    }
    .plan-grid-wrap::-webkit-scrollbar { height: 8px; }
    .plan-grid-wrap::-webkit-scrollbar-thumb { background: rgba(216, 112, 147, 0.35); border-radius: 999px; }
    .plan-grid {
      grid-template-columns: repeat(7, minmax(150px, 1fr));
      min-width: 1080px;
      gap: 0.55rem;
    }
    .day-col { min-height: 240px; }
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
        <div className="animate-slideIn planning-page-wrap">
                <div className="plan-shell">
                    <div className="float-flower" style={{ top: '-18px', left: '-18px', width: '120px', height: '120px' }}>🌸</div>
                    <div className="float-flower f2" style={{ top: '58px', right: '-8px', width: '78px', height: '78px' }}>🌸</div>
                    <div className="float-flower f3" style={{ bottom: '22px', left: '16%', width: '66px', height: '66px' }}>🌸</div>

                    <div className="plan-header">
                        <div className="header-left">
                        <img
                          src={process.env.NEXT_PUBLIC_PLANNING_AVATAR_URL || 'https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png'}
                          alt="Avatar"
                          className="avatar"
                          onError={(e) => {
                            const img = e.currentTarget
                            if (!img.src.includes('jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png')) {
                              img.src = 'https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png'
                            }
                          }}
                        />
                            <div>
                                <h1 className="plan-title">Planning de la semaine</h1>
                                <div className="week-pill">{data ? weekText(data.weekStart, data.weekEnd) : 'Chargement...'}</div>
                            </div>
                        </div>
                        <div className="brand-box">
                        <div className="brand-line">
                          <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 8.5c-1.2 0-2.3-.4-3.1-1.2A4.2 4.2 0 0 1 16.7 4v8.1a5.7 5.7 0 1 1-5.7-5.7c.3 0 .7 0 1 .1v3a2.8 2.8 0 1 0 1.7 2.6V0h3a4.2 4.2 0 0 0 4.2 4.2V8.5z"/></svg>
                          <span>@xsgwen</span>
                        </div>
                        <div className="brand-line">
                          <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.57 4.71h1.72v5.15h-1.72zm4.72 0H18v5.15h-1.71zM6 0 1.71 4.29v15.43h5.14V24l4.29-4.29h3.43L22.29 12V0Zm14.57 11.14-3.43 3.43h-3.43l-3 3v-3H6.86V1.71h13.71Z"/></svg>
                          <span>twitch.tv/xsgwen</span>
                        </div>
                        </div>
                    </div>

                    {loading && <div className="loading">Chargement du planning...</div>}
                    {!loading && error && <div className="loading">{error}</div>}

                    {!loading && !error && data && (
                      <div className="plan-grid-wrap">
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
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
