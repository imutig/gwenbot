'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'

interface ChatMessage {
    id: string
    username: string
    displayName: string
    message: string
    color: string
    badges: string[]
    timestamp: Date
    emotes?: { id: string, name: string, positions: string }[]
}

interface Alert {
    id: string
    type: 'sub' | 'resub' | 'giftsub' | 'bits' | 'raid' | 'follow'
    username: string
    message?: string
    amount?: number
    tier?: string
    timestamp: Date
}

export default function ChatPage() {
    const searchParams = useSearchParams()
    const isTransparent = searchParams.get('transparent') === 'true'
    const showAlerts = searchParams.get('alerts') !== 'false'

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Connect to SSE for real-time messages
    useEffect(() => {
        const connectSSE = () => {
            const eventSource = new EventSource('/api/chat/stream')
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                setIsConnected(true)
                console.log('Connected to chat stream')
            }

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)

                    if (data.type === 'message') {
                        const newMessage: ChatMessage = {
                            id: data.id || crypto.randomUUID(),
                            username: data.username,
                            displayName: data.displayName || data.username,
                            message: data.message,
                            color: data.color || '#ff85c0',
                            badges: data.badges || [],
                            timestamp: new Date(),
                            emotes: data.emotes
                        }

                        setMessages(prev => {
                            const updated = [...prev, newMessage]
                            // Keep only last 100 messages
                            return updated.slice(-100)
                        })
                    } else if (data.type === 'alert') {
                        const newAlert: Alert = {
                            id: crypto.randomUUID(),
                            type: data.alertType,
                            username: data.username,
                            message: data.message,
                            amount: data.amount,
                            tier: data.tier,
                            timestamp: new Date()
                        }

                        setAlerts(prev => {
                            const updated = [...prev, newAlert]
                            // Keep only last 10 alerts
                            return updated.slice(-10)
                        })

                        // Remove alert after 10 seconds
                        setTimeout(() => {
                            setAlerts(prev => prev.filter(a => a.id !== newAlert.id))
                        }, 10000)
                    }
                } catch (e) {
                    console.error('Failed to parse SSE message:', e)
                }
            }

            eventSource.onerror = () => {
                setIsConnected(false)
                console.log('SSE connection lost, reconnecting...')
                eventSource.close()
                setTimeout(connectSSE, 3000)
            }
        }

        connectSSE()

        return () => {
            eventSourceRef.current?.close()
        }
    }, [])

    // Get badge icon
    const getBadgeIcon = (badge: string) => {
        switch (badge) {
            case 'broadcaster':
                return '👑'
            case 'moderator':
                return '🗡️'
            case 'vip':
                return '💎'
            case 'subscriber':
                return '⭐'
            default:
                return null
        }
    }

    // Get alert icon and message
    const getAlertContent = (alert: Alert) => {
        switch (alert.type) {
            case 'sub':
                return { icon: '⭐', text: `${alert.username} s'est abonné(e) !` }
            case 'resub':
                return { icon: '🌟', text: `${alert.username} se réabonne (${alert.amount} mois) !` }
            case 'giftsub':
                return { icon: '🎁', text: `${alert.username} offre ${alert.amount} sub(s) !` }
            case 'bits':
                return { icon: '💎', text: `${alert.username} donne ${alert.amount} bits !` }
            case 'raid':
                return { icon: '🚀', text: `Raid de ${alert.username} avec ${alert.amount} viewers !` }
            case 'follow':
                return { icon: '💖', text: `${alert.username} follow !` }
            default:
                return { icon: '✨', text: alert.message || '' }
        }
    }

    return (
        <div className={`${styles.container} ${isTransparent ? styles.transparent : ''}`}>
            {/* Alerts Section */}
            {showAlerts && alerts.length > 0 && (
                <div className={styles.alertsContainer}>
                    {alerts.map(alert => {
                        const content = getAlertContent(alert)
                        return (
                            <div key={alert.id} className={`${styles.alert} ${styles[alert.type]}`}>
                                <span className={styles.alertIcon}>{content.icon}</span>
                                <span className={styles.alertText}>{content.text}</span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Chat Messages */}
            <div className={styles.chatContainer}>
                <div className={styles.messages}>
                    {messages.map(msg => (
                        <div key={msg.id} className={styles.message}>
                            <div className={styles.messageHeader}>
                                {msg.badges.map((badge, i) => {
                                    const icon = getBadgeIcon(badge)
                                    return icon ? (
                                        <span key={i} className={styles.badge}>{icon}</span>
                                    ) : null
                                })}
                                <span
                                    className={styles.username}
                                    style={{ color: msg.color }}
                                >
                                    {msg.displayName}
                                </span>
                            </div>
                            <span className={styles.messageText}>{msg.message}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Connection Status (only in non-transparent mode) */}
            {!isTransparent && (
                <div className={styles.statusBar}>
                    <div className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                    <span>{isConnected ? 'Connecté' : 'Déconnecté'}</span>
                    <span className={styles.messageCount}>{messages.length} messages</span>
                </div>
            )}
        </div>
    )
}
