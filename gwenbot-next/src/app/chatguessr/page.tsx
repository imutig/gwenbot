'use client'

import { useState, useEffect, useCallback } from 'react'
import FancyButton from '@/components/ui/fancy-button'
import { useToast } from '@/components/toast-context'

// SVG Icons
const MessageSquareIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
)

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
    </svg>
)

const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
        <polygon points="5,3 19,12 5,21" />
    </svg>
)

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
)

// Gear/Cog icon for settings
const CogIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

interface Message {
    id: number
    fakeUsername: string
    fakeColor: string
    content: string
    position: number
}

interface RealPlayer {
    id: number
    username: string
}

interface GameResult {
    fake: string
    fakeColor: string
    guessed: string
    actual: string
    correct: boolean
}

interface GameState {
    active: boolean
    game: {
        id: number
        status: string
        totalPlayers: number
    } | null
    messages: Message[]
    realPlayers: RealPlayer[]
}

// CSS Keyframes - VERY SLOW animations
const animationStyles = `
    @keyframes chatguessr-slideInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes chatguessr-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes chatguessr-scaleIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes chatguessr-popIn {
        0% {
            opacity: 0;
            transform: scale(0.5);
        }
        70% {
            transform: scale(1.05);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes chatguessr-messageIn {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes chatguessr-playerIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes chatguessr-scoreReveal {
        0% {
            opacity: 0;
            transform: scale(0.3) rotate(-5deg);
        }
        60% {
            transform: scale(1.15) rotate(2deg);
        }
        100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
    }
    
    @keyframes chatguessr-matchFlash {
        0% { background: rgba(255, 133, 192, 0.6); }
        100% { background: rgba(255, 133, 192, 0.1); }
    }
    
    @keyframes chatguessr-clickPop {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .chatguessr-matched {
        animation: chatguessr-matchFlash 0.8s ease-out;
    }
    
    .chatguessr-pop {
        animation: chatguessr-clickPop 0.25s ease-out;
    }
`

export default function ChatGuessrPage() {
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [selectedFake, setSelectedFake] = useState<string | null>(null)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [results, setResults] = useState<{ score: number; total: number; results: GameResult[] } | null>(null)
    const [showResults, setShowResults] = useState(false)
    const [revealedResults, setRevealedResults] = useState<number[]>([])
    const [showScore, setShowScore] = useState(false)
    const [justMatched, setJustMatched] = useState<string | null>(null)
    const [clickedFake, setClickedFake] = useState<string | null>(null)
    const [entriesAnimated, setEntriesAnimated] = useState(false)
    const { showToast } = useToast()

    // Configuration state
    const [showConfig, setShowConfig] = useState(false)
    const [messageCount, setMessageCount] = useState(20)
    const [dateFilter, setDateFilter] = useState<'all' | 'recent' | 'old'>('all')

    // Get unique fake usernames from messages
    const uniqueFakes = gameState?.messages
        ? [...new Set(gameState.messages.map(m => m.fakeUsername))]
        : []

    // Check if all matched
    const allMatched = uniqueFakes.length > 0 && Object.keys(answers).length === uniqueFakes.length

    // Fetch game status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/chatguessr/status')
            const data = await res.json()
            setGameState(data)
        } catch (error) {
            console.error('Status fetch error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    // Mark entries as animated after initial delay (based on max messages * delay)
    useEffect(() => {
        if (gameState?.messages?.length && !entriesAnimated) {
            const maxDelay = gameState.messages.length * 100 + 600 // 0.1s per msg + animation duration
            const timer = setTimeout(() => setEntriesAnimated(true), maxDelay)
            return () => clearTimeout(timer)
        }
    }, [gameState?.messages?.length, entriesAnimated])

    // Reveal results one by one (1 SECOND each)
    useEffect(() => {
        if (results && showResults && revealedResults.length < results.results.length) {
            const timer = setTimeout(() => {
                setRevealedResults(prev => [...prev, prev.length])
            }, 1000) // 1 second per result
            return () => clearTimeout(timer)
        } else if (results && showResults && revealedResults.length === results.results.length && !showScore) {
            // Show score AFTER all results revealed (1.5s delay)
            const timer = setTimeout(() => {
                setShowScore(true)
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [results, showResults, revealedResults, showScore])

    // Create new game
    const handleCreateGame = async () => {
        setCreating(true)
        setShowConfig(false)
        try {
            const res = await fetch('/api/chatguessr/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageCount, dateFilter })
            })
            const data = await res.json()

            if (!res.ok) {
                showToast(data.error || 'Erreur lors de la création', 'error')
                return
            }

            showToast(`Partie créée ! ${data.playerCount} joueurs à deviner`, 'success')
            setAnswers({})
            setResults(null)
            setShowResults(false)
            setRevealedResults([])
            setShowScore(false)
            setEntriesAnimated(false)
            await fetchStatus()
        } catch (error) {
            showToast('Erreur réseau', 'error')
        } finally {
            setCreating(false)
        }
    }

    // Handle clicking on a fake username
    const handleFakeClick = (fakeUsername: string) => {
        if (results) return

        // Pop animation - applies to ALL messages from same user
        setClickedFake(fakeUsername)
        setTimeout(() => setClickedFake(null), 250)

        setSelectedFake(fakeUsername === selectedFake ? null : fakeUsername)
    }

    // Handle clicking on a real username
    const handleRealClick = (realUsername: string) => {
        if (!selectedFake || results) return

        const existingFake = Object.entries(answers).find(([, real]) => real === realUsername)?.[0]

        if (existingFake && existingFake !== selectedFake) {
            const newAnswers = { ...answers }
            delete newAnswers[existingFake]
            newAnswers[selectedFake] = realUsername
            setAnswers(newAnswers)
        } else {
            setAnswers(prev => ({ ...prev, [selectedFake]: realUsername }))
        }

        // Animate the match
        setJustMatched(selectedFake)
        setTimeout(() => setJustMatched(null), 800)

        setSelectedFake(null)
    }

    // Submit answers with animation delay
    const handleSubmit = async () => {
        if (!allMatched) {
            showToast(`Associez tous les pseudos (${Object.keys(answers).length}/${uniqueFakes.length})`, 'warning')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/chatguessr/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers })
            })
            const data = await res.json()

            if (!res.ok) {
                showToast(data.error || 'Erreur', 'error')
                return
            }

            setResults(data)
            // Delay showing results for dramatic effect
            setTimeout(() => {
                setShowResults(true)
            }, 800)
        } catch (error) {
            showToast('Erreur réseau', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <>
                <style>{animationStyles}</style>
                <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    animation: 'chatguessr-fadeIn 0.8s ease-out'
                }}>
                    <div style={{
                        animation: 'pulse 1.5s infinite',
                        fontSize: '1.2rem'
                    }}>Chargement...</div>
                </div>
            </>
        )
    }

    return (
        <>
            <style>{animationStyles}</style>
            <div style={{ animation: 'chatguessr-slideInUp 0.7s ease-out' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.5rem',
                    animation: 'chatguessr-fadeIn 0.8s ease-out'
                }}>
                    <MessageSquareIcon />
                    <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>ChatGuessr</h1>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Config button - SQUARE */}
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            style={{
                                width: '36px',
                                height: '36px',
                                padding: 0,
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: showConfig ? 'rgba(145, 70, 255, 0.2)' : 'var(--bg-base)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.3s ease',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <CogIcon />
                        </button>
                        {/* Launch button - SMALLER */}
                        <FancyButton
                            onClick={handleCreateGame}
                            disabled={creating}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                            {creating ? '...' : (gameState?.active ? <><RefreshIcon /> Relancer</> : <><PlayIcon /> Lancer</>)}
                        </FancyButton>
                    </div>
                </div>

                {/* Config panel */}
                {showConfig && (
                    <div style={{
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-color)',
                        animation: 'chatguessr-scaleIn 0.4s ease-out'
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                            {/* Message count */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                                    Nombre de messages
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[10, 20, 30].map(count => (
                                        <button
                                            key={count}
                                            onClick={() => setMessageCount(count)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '8px',
                                                border: messageCount === count ? '2px solid var(--pink-main)' : '1px solid var(--border-color)',
                                                background: messageCount === count ? 'rgba(255, 133, 192, 0.15)' : 'transparent',
                                                cursor: 'pointer',
                                                fontWeight: messageCount === count ? 600 : 400,
                                                transition: 'all 0.3s ease',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {count}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date filter */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                                    Période des messages
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[
                                        { value: 'all', label: 'Tous' },
                                        { value: 'recent', label: 'Récents (7j)' },
                                        { value: 'old', label: 'Anciens (+30j)' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setDateFilter(opt.value as typeof dateFilter)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '8px',
                                                border: dateFilter === opt.value ? '2px solid var(--pink-main)' : '1px solid var(--border-color)',
                                                background: dateFilter === opt.value ? 'rgba(255, 133, 192, 0.15)' : 'transparent',
                                                cursor: 'pointer',
                                                fontWeight: dateFilter === opt.value ? 600 : 400,
                                                transition: 'all 0.3s ease',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* No active game */}
                {!gameState?.active && !results && (
                    <div className="glass-card" style={{
                        padding: '3rem',
                        textAlign: 'center',
                        animation: 'chatguessr-scaleIn 0.6s ease-out'
                    }}>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            opacity: 0.5,
                            animation: 'chatguessr-popIn 0.8s ease-out'
                        }}>
                            <MessageSquareIcon />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Aucune partie en cours</h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Cliquez sur "Lancer" pour commencer !
                        </p>
                    </div>
                )}

                {/* Active game or results */}
                {(gameState?.active || results) && gameState?.messages && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
                        {/* Chat area - Twitch style - FIT CONTENT */}
                        <div style={{
                            background: '#18181b',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid #303032',
                            animation: 'chatguessr-scaleIn 0.5s ease-out'
                        }}>
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderBottom: '1px solid #303032',
                                background: '#0e0e10'
                            }}>
                                <span style={{ color: '#efeff1', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Extrait du chat
                                </span>
                                <span style={{ color: '#adadb8', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                    ({gameState.messages.length} messages)
                                </span>
                            </div>

                            {/* Messages with scroll */}
                            <div style={{
                                padding: '0.5rem 0',
                                maxHeight: '400px',
                                overflowY: 'auto'
                            }}>
                                {gameState.messages.map((msg, index) => {
                                    const isSelected = selectedFake === msg.fakeUsername
                                    const isMatched = !!answers[msg.fakeUsername]
                                    const result = results?.results.find(r => r.fake === msg.fakeUsername)
                                    const wasJustMatched = justMatched === msg.fakeUsername
                                    // Click animation applies to ALL messages from same fake username
                                    const isClicked = clickedFake === msg.fakeUsername
                                    // Only show result colors AFTER score is revealed
                                    const showResultColor = result && showScore

                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => handleFakeClick(msg.fakeUsername)}
                                            className={`${wasJustMatched ? 'chatguessr-matched' : ''} ${isClicked ? 'chatguessr-pop' : ''}`}
                                            style={{
                                                padding: '0.4rem 1rem',
                                                color: '#efeff1',
                                                fontSize: '0.9rem',
                                                lineHeight: 1.5,
                                                cursor: results ? 'default' : 'pointer',
                                                background: isSelected
                                                    ? 'rgba(145, 70, 255, 0.25)'
                                                    : showResultColor
                                                        ? result.correct
                                                            ? 'rgba(34, 197, 94, 0.2)'
                                                            : 'rgba(239, 68, 68, 0.2)'
                                                        : isMatched
                                                            ? 'rgba(255, 133, 192, 0.1)'
                                                            : 'transparent',
                                                transition: 'background 0.35s ease, border-left 0.2s ease',
                                                // Only show entry animation if not yet animated
                                                animation: entriesAnimated
                                                    ? undefined
                                                    : `chatguessr-messageIn 0.6s ease-out ${index * 0.1}s both`,
                                                borderLeft: isSelected ? '3px solid #9146FF' : '3px solid transparent'
                                            }}
                                        >
                                            {/* Show guessed name instead of fake name when matched */}
                                            <span
                                                style={{
                                                    color: msg.fakeColor,
                                                    fontWeight: 700,
                                                    marginRight: '0.25rem',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                {isMatched ? answers[msg.fakeUsername] : msg.fakeUsername}
                                            </span>
                                            <span style={{ color: '#adadb8' }}>: </span>
                                            <span>{msg.content}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Right sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Real players to match */}
                            <div className="glass-card" style={{
                                padding: '1rem',
                                animation: 'chatguessr-scaleIn 0.6s ease-out 0.15s both'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Viewers à associer
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        ({Object.keys(answers).length}/{uniqueFakes.length})
                                    </span>
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {gameState.realPlayers.map((player, index) => {
                                        const isAssigned = Object.values(answers).includes(player.username)
                                        const assignedTo = Object.entries(answers).find(([, real]) => real === player.username)?.[0]
                                        const isWaiting = selectedFake && !isAssigned && !results

                                        return (
                                            <div
                                                key={player.id}
                                                onClick={() => handleRealClick(player.username)}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '8px',
                                                    cursor: isWaiting ? 'pointer' : 'default',
                                                    background: isAssigned
                                                        ? 'rgba(255, 133, 192, 0.15)'
                                                        : isWaiting
                                                            ? 'rgba(145, 70, 255, 0.15)'
                                                            : 'var(--bg-base)',
                                                    // FIX: Use consistent 2px border to prevent shift
                                                    border: isWaiting
                                                        ? '2px dashed var(--pink-main)'
                                                        : '2px solid transparent',
                                                    outline: '1px solid var(--border-color)',
                                                    transition: 'all 0.35s ease',
                                                    opacity: isAssigned && !selectedFake ? 0.6 : 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    animation: `chatguessr-playerIn 0.6s ease-out ${index * 0.1}s both`,
                                                    minHeight: '38px',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                <span style={{
                                                    fontWeight: 500,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: isAssigned ? '120px' : '200px'
                                                }}>
                                                    {player.username}
                                                </span>
                                                {isAssigned && assignedTo && !results && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--text-muted)',
                                                        animation: 'chatguessr-fadeIn 0.4s ease-out',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: '100px'
                                                    }}>
                                                        ← {assignedTo}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Instructions */}
                            {!results && (
                                <div style={{
                                    padding: '1rem',
                                    background: 'rgba(145, 70, 255, 0.1)',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)',
                                    animation: 'chatguessr-fadeIn 0.8s ease-out 0.4s both'
                                }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>Comment jouer:</strong>
                                    <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                                        <li>Cliquez sur un <strong>faux pseudo</strong> dans le chat</li>
                                        <li>Cliquez sur le <strong>vrai viewer</strong> correspondant</li>
                                        <li>Répétez pour tous les pseudos</li>
                                    </ol>
                                </div>
                            )}

                            {/* Submit button - FIXED TEXT */}
                            {!results && (
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !allMatched}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: allMatched ? 'var(--pink-main)' : 'rgba(145, 70, 255, 0.3)',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.95rem',
                                        cursor: allMatched ? 'pointer' : 'not-allowed',
                                        opacity: !allMatched ? 0.6 : 1,
                                        animation: 'chatguessr-fadeIn 0.8s ease-out 0.5s both',
                                        transition: 'all 0.4s ease'
                                    }}
                                >
                                    {submitting ? 'Validation...' : allMatched ? '✓ Valider mes réponses' : `Valider (${Object.keys(answers).length}/${uniqueFakes.length})`}
                                </button>
                            )}

                            {/* Results - Score at the END after all lines */}
                            {results && showResults && (
                                <div className="glass-card" style={{
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    animation: 'chatguessr-scaleIn 0.6s ease-out'
                                }}>
                                    {/* Results lines FIRST */}
                                    <div style={{ marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>
                                        {results.results.map((r, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.3rem 0',
                                                    color: r.correct ? '#22c55e' : '#ef4444',
                                                    opacity: revealedResults.includes(i) ? 1 : 0,
                                                    transform: revealedResults.includes(i) ? 'translateX(0)' : 'translateX(-15px)',
                                                    transition: 'all 0.6s ease-out'
                                                }}
                                            >
                                                {r.correct ? <CheckIcon /> : <XIcon />}
                                                <span style={{
                                                    color: r.fakeColor,
                                                    fontWeight: 600,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '90px'
                                                }}>{r.fake}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                <span style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '90px'
                                                }}>{r.actual}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Score LAST */}
                                    {showScore && (
                                        <>
                                            <div style={{
                                                fontSize: '3.5rem',
                                                fontWeight: 700,
                                                color: results.score === results.total ? '#22c55e' : 'var(--pink-main)',
                                                animation: 'chatguessr-scoreReveal 1.2s ease-out'
                                            }}>
                                                {results.score}/{results.total}
                                            </div>
                                            <p style={{
                                                color: 'var(--text-muted)',
                                                marginTop: '0.5rem',
                                                animation: 'chatguessr-fadeIn 0.8s ease-out 0.5s both'
                                            }}>
                                                {results.score === results.total
                                                    ? '🎉 Parfait !'
                                                    : results.score >= results.total / 2
                                                        ? 'Pas mal !'
                                                        : 'Essaie encore !'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
