'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'

type DogState = 'sleeping' | 'jitter' | 'barking'

export default function SleepingDog() {
    const [state, setState] = useState<DogState>('sleeping')
    const [barkFrame, setBarkFrame] = useState<'open' | 'closed'>('closed')
    const clickCountRef = useRef(0)
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null)
    const barkIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const CLICKS_TO_WAKE = 5
    const CLICK_WINDOW_MS = 2000
    const BARK_COUNT = 4
    const BARK_FRAME_MS = 300

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
            if (barkIntervalRef.current) clearInterval(barkIntervalRef.current)
        }
    }, [])

    const startBarking = useCallback(() => {
        setState('barking')
        let barkCount = 0

        barkIntervalRef.current = setInterval(() => {
            setBarkFrame(prev => prev === 'open' ? 'closed' : 'open')
            barkCount++

            if (barkCount >= BARK_COUNT * 2) {
                if (barkIntervalRef.current) clearInterval(barkIntervalRef.current)
                setBarkFrame('closed')
                // Go back to sleep after barking
                setTimeout(() => {
                    setState('sleeping')
                    clickCountRef.current = 0
                }, 300)
            }
        }, BARK_FRAME_MS)
    }, [])

    const handleClick = useCallback(() => {
        if (state === 'barking') return // Don't interrupt barking

        clickCountRef.current++

        // Clear existing reset timer
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current)
        }

        // Set jitter state
        setState('jitter')

        // If enough clicks, wake up and bark
        if (clickCountRef.current >= CLICKS_TO_WAKE) {
            startBarking()
            return
        }

        // Reset click count after window expires
        resetTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0
            setState('sleeping')
        }, CLICK_WINDOW_MS)

        // Remove jitter after short delay
        setTimeout(() => {
            if (clickCountRef.current < CLICKS_TO_WAKE) {
                setState('sleeping')
            }
        }, 100)
    }, [state, startBarking])

    const getImageSrc = () => {
        if (state === 'barking') {
            return barkFrame === 'open'
                ? '/jennie/jennie barking mouth open.png'
                : '/jennie/jennie barking mouth shut.png'
        }
        return '/jennie/jennie sleeping.png'
    }

    const getJitterStyle = (): React.CSSProperties => {
        if (state === 'jitter') {
            return {
                animation: 'dogJitter 0.1s ease-in-out'
            }
        }
        if (state === 'barking') {
            return {
                animation: 'dogBark 0.3s ease-in-out infinite'
            }
        }
        return {}
    }

    return (
        <>
            <style jsx global>{`
                @keyframes dogJitter {
                    0%, 100% { transform: translateX(0) rotate(0deg); }
                    25% { transform: translateX(-3px) rotate(-2deg); }
                    75% { transform: translateX(3px) rotate(2deg); }
                }
                @keyframes dogBark {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-30px); }
                }
            `}</style>
            <div
                style={{
                    position: 'fixed',
                    bottom: '-60px',
                    right: '20px',
                    zIndex: 9999,
                    transition: 'transform 0.2s ease',
                    ...getJitterStyle()
                }}
                title="Jennie dort... 💤"
            >
                <Image
                    onClick={handleClick}
                    src={getImageSrc()}
                    alt="Jennie le chien"
                    width={200}
                    height={200}
                    style={{
                        objectFit: 'contain',
                        cursor: 'pointer',
                        filter: state === 'sleeping' ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'drop-shadow(0 4px 12px rgba(236,72,153,0.4))'
                    }}
                    priority
                />
            </div>
        </>
    )
}
