'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

interface BestGuess {
    word: string
    similarity: number
    username: string
}

// Temperature conversion (from cemantig/page.tsx)
const getTemperature = (similarity: number): number => {
    if (similarity === 1000) return 100.00
    if (similarity === 999) return 59.04
    if (similarity >= 990) return 51.03 + (similarity - 990) * 0.89
    if (similarity >= 900) return 42.05 + (similarity - 900) * 0.10
    if (similarity >= 400) return 31.96 + (similarity - 400) * 0.02
    if (similarity >= 150) return 0 + (similarity - 150) * 0.128
    if (similarity >= 1) return -100 + (similarity - 1) * 0.67
    return -100
}

const getSimilarityEmoji = (similarity: number) => {
    if (similarity === 1000) return '🎉'
    if (similarity === 999) return '😲'
    if (similarity >= 990) return '🔥'
    if (similarity >= 900) return '🥵'
    if (similarity >= 400) return '😎'
    if (similarity >= 150) return '🥶'
    return '🧊'
}

const getSimilarityColor = (similarity: number) => {
    if (similarity >= 990) return '#ef4444' // red
    if (similarity >= 900) return '#f97316' // orange
    if (similarity >= 400) return '#eab308' // yellow
    if (similarity >= 150) return '#22c55e' // green
    return '#3b82f6' // blue
}

const formatTemperature = (similarity: number): string => {
    const temp = getTemperature(similarity)
    return temp.toFixed(2) + '°C'
}

export default function CemantigOverlayPage() {
    const [bestGuess, setBestGuess] = useState<BestGuess | null>(null)
    const [showNotification, setShowNotification] = useState(false)
    const [isWinner, setIsWinner] = useState(false)
    const [isHiding, setIsHiding] = useState(false)
    const bestSimilarityRef = useRef<number>(0)

    // Fetch current best guess on mount
    const fetchBestGuess = useCallback(async () => {
        try {
            const res = await fetch('/api/cemantig/best-guess')
            const data = await res.json()
            if (data.bestGuess) {
                bestSimilarityRef.current = data.bestGuess.similarity
            }
        } catch (error) {
            console.error('[Overlay] Error fetching best guess:', error)
        }
    }, [])

    useEffect(() => {
        fetchBestGuess()
    }, [fetchBestGuess])

    // Force transparent background for OBS Browser Source
    useEffect(() => {
        // Force transparent background on body and html
        document.body.style.background = 'transparent'
        document.body.style.backgroundColor = 'transparent'
        document.documentElement.style.background = 'transparent'
        document.documentElement.style.backgroundColor = 'transparent'

        return () => {
            // Cleanup: restore original styles
            document.body.style.background = ''
            document.body.style.backgroundColor = ''
            document.documentElement.style.background = ''
            document.documentElement.style.backgroundColor = ''
        }
    }, [])

    // Subscribe to Realtime updates
    useEffect(() => {
        if (!supabase) {
            console.log('[Overlay] Supabase not available')
            return
        }

        console.log('[Overlay] Setting up broadcast subscription...')

        const channel = supabase
            .channel('cemantig-broadcast')
            .on('broadcast', { event: 'new_guess' }, (payload) => {
                console.log('[Overlay] New guess received:', payload)

                const newGuess = payload.payload as BestGuess

                // Check if this is a new best guess
                if (newGuess.similarity > bestSimilarityRef.current) {
                    console.log('[Overlay] NEW BEST GUESS!', newGuess)

                    bestSimilarityRef.current = newGuess.similarity

                    // Check if winner
                    if (newGuess.similarity === 1000) {
                        setIsWinner(true)
                    } else {
                        setIsWinner(false)
                    }

                    setBestGuess(newGuess)
                    setIsHiding(false)
                    setShowNotification(true)

                    // Start hiding animation after 4 seconds
                    setTimeout(() => {
                        setIsHiding(true)
                        // Remove from DOM after animation
                        setTimeout(() => {
                            setShowNotification(false)
                            setIsHiding(false)
                        }, 500)
                    }, 4000)
                }
            })
            .subscribe((status) => {
                console.log('[Overlay] Subscription status:', status)
            })

        return () => {
            console.log('[Overlay] Cleaning up subscription')
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <>
            <style>{`
                @keyframes slideIn {
                    0% {
                        transform: translateX(100%) scale(0.8);
                        opacity: 0;
                    }
                    100% {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    0% {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(100%) scale(0.8);
                        opacity: 0;
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.5), 0 0 40px rgba(236, 72, 153, 0.3); }
                    50% { box-shadow: 0 0 30px rgba(236, 72, 153, 0.8), 0 0 60px rgba(236, 72, 153, 0.5); }
                }
                
                @keyframes winnerPulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(251, 191, 36, 0.6); }
                    50% { transform: scale(1.02); box-shadow: 0 0 50px rgba(251, 191, 36, 0.9); }
                }
                
                .notification-container {
                    position: fixed;
                    bottom: 40px;
                    right: 40px;
                    z-index: 9999;
                }
                
                .notification {
                    background: linear-gradient(135deg, rgba(236, 72, 153, 0.95), rgba(168, 85, 247, 0.95));
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 20px 28px;
                    min-width: 320px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(236, 72, 153, 0.4);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    animation: slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, glow 2s ease-in-out infinite;
                }
                
                .notification.hiding {
                    animation: slideOut 0.5s ease-in forwards;
                }
                
                .notification.winner {
                    background: linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.95));
                    animation: slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, winnerPulse 0.5s ease-in-out infinite;
                }
                
                .notification.winner.hiding {
                    animation: slideOut 0.5s ease-in forwards;
                }
                
                .notification-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                
                .notification-badge {
                    background: rgba(255, 255, 255, 0.25);
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: white;
                }
                
                .notification-emoji {
                    font-size: 28px;
                    animation: pulse 1s ease-in-out infinite;
                }
                
                .notification-content {
                    color: white;
                }
                
                .notification-username {
                    font-size: 14px;
                    font-weight: 500;
                    opacity: 0.9;
                    margin-bottom: 4px;
                }
                
                .notification-word {
                    font-size: 28px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 8px;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .notification-score {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 18px;
                    font-weight: 700;
                    font-family: 'Courier New', monospace;
                }
                
                .temperature {
                    padding: 4px 12px;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>

            <div className="notification-container">
                {showNotification && bestGuess && (
                    <div className={`notification ${isWinner ? 'winner' : ''} ${isHiding ? 'hiding' : ''}`}>
                        <div className="notification-header">
                            <span className="notification-badge">
                                {isWinner ? '🏆 TROUVÉ !' : '🔥 Nouveau Record'}
                            </span>
                            <span className="notification-emoji">
                                {getSimilarityEmoji(bestGuess.similarity)}
                            </span>
                        </div>
                        <div className="notification-content">
                            <div className="notification-username">
                                {bestGuess.username}
                            </div>
                            <div className="notification-word">
                                {bestGuess.word}
                            </div>
                            <div className="notification-score">
                                <span className="temperature" style={{ color: getSimilarityColor(bestGuess.similarity) }}>
                                    {formatTemperature(bestGuess.similarity)}
                                </span>
                                <span style={{ opacity: 0.7 }}>
                                    ({bestGuess.similarity}/1000)
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
