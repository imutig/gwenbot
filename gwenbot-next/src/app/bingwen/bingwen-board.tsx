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
            <p className="text-slate-400">Chargement de ta carte...</p>
        </div>
    )

    if (error) return (
        <div className="text-center p-20 max-w-sm mx-auto">
            <p className="text-slate-300 text-lg mb-4">{error}</p>
            <button onClick={fetchCard} className="px-8 py-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 font-bold">
                Réessayer
            </button>
        </div>
    )

    if (!card) return null

    return (
        <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black bg-gradient-to-br from-pink-400 to-rose-600 bg-clip-text text-transparent mb-3 italic tracking-tighter">
                    BINGWEN
                </h1>
                <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    <p className="text-slate-400 text-sm uppercase tracking-widest font-bold opacity-80">Joue en direct avec Gwen !</p>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-10 select-none">
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
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleCell(i)}
                            className={`
                                relative aspect-square flex items-center justify-center p-2 sm:p-3 rounded-2xl text-xs sm:text-sm lg:text-base leading-snug font-bold text-center transition-all duration-200
                                ${cell.isFree ? 'bg-pink-500/20 border-pink-400/40' :
                                    isChecked ? 'bg-pink-500/80 border-pink-200 text-white z-10 shadow-lg' :
                                        'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/60 text-slate-300'}
                                border-2 backdrop-blur-md
                                ${cell.isFree ? '' : isValidated ? 'border-green-500/60' : ''}
                            `}
                        >
                            <span className="relative z-10">
                                {cell.text === '⭐' ? '✨' : cell.text}
                            </span>

                            {/* Validation checkmark - subtle */}
                            <AnimatePresence>
                                {isValidated && !cell.isFree && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className="absolute -top-1.5 -right-1.5 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-black shadow-md z-20 border-2 border-slate-950"
                                    >
                                        ✓
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    )
                })}
            </div>

            <div className="flex flex-col gap-8 max-w-md mx-auto w-full">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={claimBingo}
                    disabled={card.has_bingo || claiming}
                    className={`
                        py-6 rounded-3xl font-black text-2xl tracking-tighter transition-all duration-300
                        ${card.has_bingo ? 'bg-green-500 text-white' :
                            'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-xl hover:shadow-pink-500/30'}
                        disabled:opacity-50 disabled:scale-100
                    `}
                >
                    {card.has_bingo ? '🎉 BINGO GAGNÉ !!!' : claiming ? 'CHARGEMENT...' : 'RÉCLAMER BINGO !'}
                </motion.button>

                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-lg">
                    <p className="text-xs leading-relaxed text-center text-slate-400 uppercase tracking-widest font-black opacity-60">
                        Coche 5 cases en ligne, colonne ou diagonale.<br />
                        Les cases doivent être <span className="text-green-500">validées en live</span> par Gwen.
                    </p>
                </div>
            </div>
        </div>
    )
}
