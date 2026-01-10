'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

interface CoinFlipEvent {
    username: string
    result: 'pile' | 'face'
    resultText: string
    id: string
}

// SVG Icons
const CrownIcon = ({ size = '50%' }: { size?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size, height: size }}>
        <path d="M2.5 18.5l2-8 5 4 3.5-7 3.5 7 5-4 2 8h-21z" />
        <path d="M4 19h16v2H4z" />
    </svg>
)

const EagleIcon = ({ size = '50%' }: { size?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size, height: size }}>
        <path d="M12 2C8.5 2 5.5 4 4 7c0 0 2 1 4 1 1.5 0 2.5-.5 4-1.5 1.5 1 2.5 1.5 4 1.5 2 0 4-1 4-1-1.5-3-4.5-5-8-5z" />
        <path d="M12 9c-2 0-4 1.5-5 3l5 10 5-10c-1-1.5-3-3-5-3z" />
        <circle cx="10" cy="6" r="1" />
        <circle cx="14" cy="6" r="1" />
    </svg>
)

export default function CoinFlipOverlayPage() {
    const [currentFlip, setCurrentFlip] = useState<CoinFlipEvent | null>(null)
    const [isFlipping, setIsFlipping] = useState(false)
    const [showResult, setShowResult] = useState(false)
    const [flipQueue, setFlipQueue] = useState<CoinFlipEvent[]>([])
    const processingRef = useRef(false)

    // Process queue
    useEffect(() => {
        if (processingRef.current || flipQueue.length === 0) return

        processingRef.current = true
        const [next, ...rest] = flipQueue

        console.log('[CoinFlip] Starting flip for:', next.username)
        setCurrentFlip(next)
        setFlipQueue(rest)
        setIsFlipping(true)
        setShowResult(false)

        // Show result after flip animation (2.5s)
        setTimeout(() => {
            setShowResult(true)

            // Hide after showing result (4s)
            setTimeout(() => {
                setCurrentFlip(null)
                setIsFlipping(false)
                setShowResult(false)
                processingRef.current = false
            }, 4000)
        }, 2500)
    }, [flipQueue, currentFlip])

    // Force transparent background
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

    // Subscribe to coin flip events
    useEffect(() => {
        if (!supabase) {
            console.log('[CoinFlip] Supabase not available')
            return
        }

        console.log('[CoinFlip] Setting up broadcast subscription...')

        const channel = supabase
            .channel('coinflip-broadcast')
            .on('broadcast', { event: 'coinflip' }, (payload) => {
                console.log('[CoinFlip] Event received:', payload)

                const event = payload.payload as Omit<CoinFlipEvent, 'id'>
                const newFlip: CoinFlipEvent = {
                    ...event,
                    id: `${Date.now()}-${Math.random()}`
                }

                setFlipQueue(prev => [...prev, newFlip])
            })
            .subscribe((status) => {
                console.log('[CoinFlip] Subscription status:', status)
            })

        return () => {
            console.log('[CoinFlip] Cleaning up subscription')
            supabase.removeChannel(channel)
        }
    }, [])

    return (
        <>
            <style>{`
                @keyframes coinFlip {
                    0% {
                        transform: rotateY(0deg) translateY(50px) scale(0.5);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                        transform: rotateY(180deg) translateY(0) scale(1);
                    }
                    30% {
                        transform: rotateY(540deg) translateY(-30px) scale(1);
                    }
                    50% {
                        transform: rotateY(900deg) translateY(-15px) scale(1);
                    }
                    70% {
                        transform: rotateY(1260deg) translateY(-5px) scale(1);
                    }
                    90% {
                        transform: rotateY(1620deg) translateY(0) scale(1);
                    }
                    100% {
                        transform: rotateY(1800deg) translateY(0) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes coinFlipFace {
                    0% {
                        transform: rotateY(0deg) translateY(50px) scale(0.5);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                        transform: rotateY(180deg) translateY(0) scale(1);
                    }
                    30% {
                        transform: rotateY(540deg) translateY(-30px) scale(1);
                    }
                    50% {
                        transform: rotateY(900deg) translateY(-15px) scale(1);
                    }
                    70% {
                        transform: rotateY(1260deg) translateY(-5px) scale(1);
                    }
                    90% {
                        transform: rotateY(1620deg) translateY(0) scale(1);
                    }
                    100% {
                        transform: rotateY(1980deg) translateY(0) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeInUp {
                    0% {
                        opacity: 0;
                        transform: translateY(15px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .overlay-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 9999;
                }
                
                .coin-container {
                    perspective: 800px;
                    width: 120px;
                    height: 120px;
                }
                
                .coin {
                    width: 120px;
                    height: 120px;
                    position: relative;
                    transform-style: preserve-3d;
                }
                
                .coin.flipping-pile {
                    animation: coinFlip 2.5s ease-out forwards;
                }
                
                .coin.flipping-face {
                    animation: coinFlipFace 2.5s ease-out forwards;
                }
                
                .coin-side {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backface-visibility: hidden;
                    box-shadow: 
                        0 4px 16px rgba(139, 69, 88, 0.3),
                        inset 0 0 20px rgba(255, 255, 255, 0.4);
                }
                
                .coin-front {
                    background: linear-gradient(135deg, #ffc1e3 0%, #ff85c0 50%, #ffc1e3 100%);
                    border: 3px solid #be185d;
                    color: #8B4558;
                }
                
                .coin-back {
                    background: linear-gradient(135deg, #fff0f3 0%, #ffc1e3 50%, #fff0f3 100%);
                    border: 3px solid #be185d;
                    color: #8B4558;
                    transform: rotateY(180deg);
                }
                
                .result-container {
                    margin-top: 20px;
                    text-align: center;
                    animation: fadeInUp 0.3s ease-out;
                }
                
                .result-card {
                    background: rgba(255, 240, 243, 0.95);
                    backdrop-filter: blur(12px);
                    border-radius: 12px;
                    padding: 12px 24px;
                    border: 1px solid rgba(255, 182, 193, 0.5);
                    box-shadow: 0 4px 20px rgba(139, 69, 88, 0.15);
                }
                
                .username {
                    font-size: 14px;
                    font-weight: 500;
                    color: #8B4558;
                    opacity: 0.8;
                    margin-bottom: 4px;
                }
                
                .result-text {
                    font-size: 20px;
                    font-weight: 700;
                    color: #be185d;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                
                .result-icon {
                    width: 20px;
                    height: 20px;
                    color: #be185d;
                }
            `}</style>

            <div className="overlay-container">
                {currentFlip && (
                    <>
                        <div className="coin-container">
                            <div className={`coin ${isFlipping ? (currentFlip.result === 'pile' ? 'flipping-pile' : 'flipping-face') : ''}`}>
                                <div className="coin-side coin-front">
                                    <CrownIcon size="55%" />
                                </div>
                                <div className="coin-side coin-back">
                                    <EagleIcon size="55%" />
                                </div>
                            </div>
                        </div>

                        {showResult && (
                            <div className="result-container">
                                <div className="result-card">
                                    <div className="username">@{currentFlip.username}</div>
                                    <div className="result-text">
                                        <span className="result-icon">
                                            {currentFlip.result === 'pile' ? <CrownIcon size="100%" /> : <EagleIcon size="100%" />}
                                        </span>
                                        {currentFlip.result === 'pile' ? 'Pile' : 'Face'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}
