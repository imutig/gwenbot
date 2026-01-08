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
    id: string // Unique ID for queue management
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
    const [notificationQueue, setNotificationQueue] = useState<BestGuess[]>([])
    const [currentNotification, setCurrentNotification] = useState<BestGuess | null>(null)
    const [isHiding, setIsHiding] = useState(false)
    const bestSimilarityRef = useRef<number>(0)
    const isShowingRef = useRef<boolean>(false)

    // Process queue - show next notification when current one finishes
    const processQueue = useCallback(() => {
        if (isShowingRef.current) return

        setNotificationQueue(prev => {
            if (prev.length === 0) return prev

            const [next, ...rest] = prev
            isShowingRef.current = true
            setCurrentNotification(next)
            setIsHiding(false)

            // Hide after 3 seconds
            setTimeout(() => {
                setIsHiding(true)
                setTimeout(() => {
                    setCurrentNotification(null)
                    isShowingRef.current = false
                    // Process next in queue
                    if (rest.length > 0) {
                        setTimeout(() => processQueue(), 300)
                    }
                }, 400)
            }, 3000)

            return rest
        })
    }, [])

    // Watch queue changes
    useEffect(() => {
        if (notificationQueue.length > 0 && !isShowingRef.current) {
            processQueue()
        }
    }, [notificationQueue, processQueue])

    // Fetch current best guess on mount and periodically to detect session changes
    const fetchBestGuess = useCallback(async () => {
        try {
            const res = await fetch('/api/cemantig/best-guess')
            const data = await res.json()

            if (!data.sessionActive) {
                // No active session - reset to 0
                console.log('[Overlay] No active session, resetting best to 0')
                bestSimilarityRef.current = 0
            } else if (data.bestGuess) {
                bestSimilarityRef.current = data.bestGuess.similarity
                console.log('[Overlay] Session active, best guess:', data.bestGuess.similarity)
            } else {
                // Session active but no guesses yet - reset to 0
                console.log('[Overlay] Session active but no guesses, resetting best to 0')
                bestSimilarityRef.current = 0
            }
        } catch (error) {
            console.error('[Overlay] Error fetching best guess:', error)
        }
    }, [])

    useEffect(() => {
        fetchBestGuess()

        // Poll every 10 seconds to detect session changes
        const interval = setInterval(fetchBestGuess, 10000)
        return () => clearInterval(interval)
    }, [fetchBestGuess])

    // Force transparent background for OBS Browser Source
    useEffect(() => {
        document.body.style.background = 'transparent'
        document.body.style.backgroundColor = 'transparent'
        document.documentElement.style.background = 'transparent'
        document.documentElement.style.backgroundColor = 'transparent'

        return () => {
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

                const guess = payload.payload as Omit<BestGuess, 'id'>

                console.log('[Overlay] Current best:', bestSimilarityRef.current, 'New guess:', guess.similarity)

                // Check if this is a new best guess
                if (guess.similarity > bestSimilarityRef.current) {
                    console.log('[Overlay] NEW BEST GUESS!', guess)

                    bestSimilarityRef.current = guess.similarity

                    // Add to queue with unique ID
                    const newNotification: BestGuess = {
                        ...guess,
                        id: `${Date.now()}-${Math.random()}`
                    }

                    setNotificationQueue(prev => [...prev, newNotification])
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

    const isWinner = currentNotification?.similarity === 1000

    return (
        <>
            <style>{`
                @keyframes slideIn {
                    0% {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    100% {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    0% {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                .notification-container {
                    position: fixed;
                    bottom: 40px;
                    right: 40px;
                    z-index: 9999;
                }
                
                .notification {
                    background: rgba(255, 240, 243, 0.98);
                    backdrop-filter: blur(16px);
                    border-radius: 20px;
                    padding: 24px 32px;
                    min-width: 380px;
                    box-shadow: 0 12px 48px rgba(139, 69, 88, 0.2);
                    border: 2px solid rgba(255, 182, 193, 0.6);
                    animation: slideIn 0.4s ease-out forwards;
                }
                
                .notification.hiding {
                    animation: slideOut 0.4s ease-in forwards;
                }
                
                .notification.winner {
                    background: rgba(255, 250, 230, 0.98);
                    border: 2px solid rgba(251, 191, 36, 0.6);
                }
                
                .notification-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 14px;
                }
                
                .notification-badge {
                    background: rgba(255, 133, 192, 0.25);
                    padding: 6px 14px;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #be185d;
                }
                
                .notification.winner .notification-badge {
                    background: rgba(251, 191, 36, 0.25);
                    color: #b45309;
                }
                
                .notification-emoji {
                    font-size: 28px;
                }
                
                .notification-content {
                    color: #8B4558;
                }
                
                .notification-username {
                    font-size: 16px;
                    font-weight: 500;
                    opacity: 0.7;
                    margin-bottom: 4px;
                }
                
                .notification-word {
                    font-size: 32px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 10px;
                    color: #8B4558;
                }
                
                .notification-score {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 18px;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                }
                
                .temperature {
                    padding: 5px 12px;
                    border-radius: 8px;
                    background: rgba(255, 133, 192, 0.15);
                }
                
                .similarity-value {
                    opacity: 0.5;
                    font-size: 16px;
                    color: #8B4558;
                }
            `}</style>

            <div className="notification-container">
                {currentNotification && (
                    <div className={`notification ${isWinner ? 'winner' : ''} ${isHiding ? 'hiding' : ''}`}>
                        <div className="notification-header">
                            <span className="notification-badge">
                                {isWinner ? '🏆 Trouvé !' : '📈 Nouveau record'}
                            </span>
                            <span className="notification-emoji">
                                {getSimilarityEmoji(currentNotification.similarity)}
                            </span>
                        </div>
                        <div className="notification-content">
                            <div className="notification-username">
                                {currentNotification.username}
                            </div>
                            <div className="notification-word">
                                {currentNotification.word}
                            </div>
                            <div className="notification-score">
                                <span className="temperature" style={{ color: getSimilarityColor(currentNotification.similarity) }}>
                                    {formatTemperature(currentNotification.similarity)}
                                </span>
                                <span className="similarity-value">
                                    {currentNotification.similarity}/1000
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
