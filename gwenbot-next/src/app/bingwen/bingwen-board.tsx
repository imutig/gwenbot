'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface BingoCard {
    id: number
    grid: { text: string; isFree: boolean }[]
    checked: boolean[]
    has_bingo: boolean
}

interface SessionInfo {
    items: string[]
    validated_items: boolean[]
}

export default function BingwenBoard() {
    const [card, setCard] = useState<BingoCard | null>(null)
    const [session, setSession] = useState<SessionInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchCard = useCallback(async () => {
        try {
            const res = await fetch('/api/bingwen/card')
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data.active) {
                setCard(data.card)
                setSession(data.session)
                setError(null)
            } else {
                setError('Aucune session de bingo en cours.')
            }
        } catch {
            setError('Erreur lors du chargement de la carte.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCard()
        // Poll for session updates (validated items) every 5s
        const interval = setInterval(fetchCard, 5000)
        return () => clearInterval(interval)
    }, [fetchCard])

    const toggleCell = async (index: number) => {
        if (!card || card.has_bingo || index === 12) return

        const newChecked = [...card.checked]
        newChecked[index] = !newChecked[index]

        // Optimistic update
        setCard({ ...card, checked: newChecked })

        try {
            const res = await fetch('/api/bingwen/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id, cellIndex: index })
            })
            if (!res.ok) throw new Error()
        } catch {
            // Revert on error
            fetchCard()
        }
    }

    const claimBingo = async () => {
        if (!card || card.has_bingo || claiming) return
        setClaiming(true)

        try {
            const res = await fetch('/api/bingwen/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id })
            })
            const data = await res.json()

            if (data.success) {
                setCard({ ...card, has_bingo: true })
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#f077aa', '#ffd700', '#ffffff']
                })
            } else {
                alert(data.error || 'Impossible de réclamer le Bingo.')
            }
        } catch {
            alert('Erreur lors de la réclamation.')
        } finally {
            setClaiming(false)
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-10 h-10 border-4 border-pink-500/20 border-t-pink-500 rounded-full"
            />
            <p className="text-slate-400 animate-pulse">Chargement de ta carte...</p>
        </div>
    )

    if (error) return (
        <div className="text-center p-20">
            <p className="text-slate-300 text-lg mb-4">{error}</p>
            <button onClick={fetchCard} className="px-6 py-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors border border-slate-700">
                Réessayer
            </button>
        </div>
    )

    if (!card) return null

    return (
        <div className="max-w-md mx-auto p-4 sm:p-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black bg-gradient-to-br from-pink-400 to-rose-600 bg-clip-text text-transparent mb-2 italic tracking-tighter">
                    BINGWEN
                </h1>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold opacity-80">Joue en direct avec Gwen !</p>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-8 select-none">
                {card.grid.map((cell, i) => {
                    const isChecked = card.checked[i]
                    // Determine if validated
                    let isValidated = cell.isFree;
                    if (!cell.isFree && session) {
                        const idx = session.items.indexOf(cell.text);
                        if (idx !== -1 && session.validated_items[idx]) {
                            isValidated = true;
                        }
                    }

                    return (
                        <motion.button
                            key={i}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => toggleCell(i)}
                            className={`
                                relative aspect-square flex items-center justify-center p-1.5 rounded-xl text-[10px] sm:text-[11px] leading-tight font-bold text-center transition-all duration-300
                                ${cell.isFree ? 'bg-pink-500/30 border-pink-400/50 shadow-[inset_0_0_12px_rgba(240,119,170,0.2)]' :
                                    isChecked ? 'bg-pink-500/90 border-pink-200 text-white shadow-[0_0_20px_rgba(240,119,170,0.6)] z-10' :
                                        'bg-slate-900/80 border-slate-700/50 hover:bg-slate-800/90 text-slate-300'}
                                border-[1.5px] backdrop-blur-xl
                            `}
                        >
                            <span className="relative z-10 drop-shadow-md">
                                {cell.text === '⭐' ? '✨' : cell.text}
                            </span>

                            {/* Validation indicator */}
                            <AnimatePresence>
                                {isValidated && !cell.isFree && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-black shadow-lg z-20 border-2 border-slate-950"
                                    >
                                        ✓
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Glow effect for validated cells */}
                            {isValidated && (
                                <div className={`absolute inset-0 rounded-xl blur-md opacity-40 ${cell.isFree ? 'bg-pink-400' : 'bg-green-400'}`} />
                            )}
                        </motion.button>
                    )
                })}
            </div>

            <div className="flex flex-col gap-6">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={claimBingo}
                    disabled={card.has_bingo || claiming}
                    className={`
                        py-5 rounded-2xl font-black text-xl tracking-tighter transition-all duration-300
                        ${card.has_bingo ? 'bg-green-500 text-white shadow-[0_0_25px_rgba(34,197,94,0.5)]' :
                            'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-2xl hover:shadow-pink-500/50'}
                        disabled:opacity-50 disabled:translate-y-0 disabled:scale-100
                    `}
                >
                    {card.has_bingo ? '🎉 BINGO GAGNÉ !!!' : claiming ? 'CHARGEMENT...' : 'RÉCLAMER BINGO !'}
                </motion.button>

                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-lg">
                    <p className="text-[11px] leading-relaxed text-center text-slate-400 uppercase tracking-[0.15em] font-black opacity-70">
                        Coche 5 cases en ligne, colonne ou diagonale.<br />
                        Les cases doivent être <span className="text-green-500">validées en live</span> par Gwen.
                    </p>
                </div>
            </div>
        </div>
    )
}
