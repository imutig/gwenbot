'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'

interface Badge {
    set_id: string
    id: string
}

interface ChatMessage {
    id: string
    username: string
    displayName: string
    message: string
    color: string
    badges: Badge[]
    timestamp: Date
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

function ChatContent() {
    const searchParams = useSearchParams()
    const isTransparent = searchParams.get('transparent') === 'true'
    const hideAlerts = searchParams.get('alerts') === 'false'

    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    // Load initial data on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load recent messages
                const messagesRes = await fetch('/api/chat/history?limit=50')
                if (messagesRes.ok) {
                    const data = await messagesRes.json()
                    setMessages(data.messages || [])
                }

                // Load recent alerts
                const alertsRes = await fetch('/api/chat/alerts?limit=20')
                if (alertsRes.ok) {
                    const data = await alertsRes.json()
                    setAlerts(data.alerts || [])
                }
            } catch (e) {
                console.error('Failed to load initial data:', e)
            } finally {
                setIsLoading(false)
            }
        }

        loadInitialData()
    }, [])

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
                            timestamp: new Date()
                        }

                        setMessages(prev => {
                            const updated = [...prev, newMessage]
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
                            const updated = [newAlert, ...prev]
                            return updated.slice(0, 20)
                        })
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
    const getBadgeIcon = (badge: Badge | string) => {
        const badgeId = typeof badge === 'string' ? badge : badge.set_id
        switch (badgeId) {
            case 'broadcaster':
                return { icon: '👑', label: 'Broadcaster', className: styles.badgeBroadcaster }
            case 'moderator':
                return { icon: '🗡️', label: 'Mod', className: styles.badgeMod }
            case 'vip':
                return { icon: '💎', label: 'VIP', className: styles.badgeVip }
            case 'subscriber':
                return { icon: '⭐', label: 'Sub', className: styles.badgeSub }
            case 'founder':
                return { icon: '🏆', label: 'Founder', className: styles.badgeFounder }
            default:
                return null
        }
    }

    // Get alert icon and message
    const getAlertContent = (alert: Alert) => {
        switch (alert.type) {
            case 'sub':
                return { icon: '⭐', text: `${alert.username} s'est abonné(e)`, color: '#ffd700' }
            case 'resub':
                return { icon: '🌟', text: `${alert.username} (${alert.amount} mois)`, color: '#ffd700' }
            case 'giftsub':
                return { icon: '🎁', text: `${alert.username} offre ${alert.amount} sub(s)`, color: '#ff69b4' }
            case 'bits':
                return { icon: '💎', text: `${alert.username} - ${alert.amount} bits`, color: '#9146ff' }
            case 'raid':
                return { icon: '🚀', text: `Raid de ${alert.username} (${alert.amount})`, color: '#00ff7f' }
            case 'follow':
                return { icon: '💖', text: `${alert.username} follow`, color: '#ff85c0' }
            default:
                return { icon: '✨', text: alert.message || '', color: '#ff85c0' }
        }
    }

    // Format time
    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }

    if (isLoading) {
        return (
            <div className={`${styles.container} ${isTransparent ? styles.transparent : ''}`}>
                <div className={styles.loading}>Chargement du chat...</div>
            </div>
        )
    }

    return (
        <div className={`${styles.container} ${isTransparent ? styles.transparent : ''}`}>
            <div className={styles.mainLayout}>
                {/* Chat Messages */}
                <div className={styles.chatContainer}>
                    <div className={styles.chatHeader}>
                        <span className={styles.chatTitle}>💬 Chat en direct</span>
                        <div className={styles.connectionStatus}>
                            <div className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                            <span>{messages.length}</span>
                        </div>
                    </div>
                    <div className={styles.messages} ref={messagesContainerRef}>
                        {messages.map(msg => (
                            <div key={msg.id} className={styles.message}>
                                <div className={styles.messageHeader}>
                                    {msg.badges.map((badge, i) => {
                                        const badgeInfo = getBadgeIcon(badge)
                                        return badgeInfo ? (
                                            <span
                                                key={i}
                                                className={`${styles.badge} ${badgeInfo.className || ''}`}
                                                title={badgeInfo.label}
                                            >
                                                {badgeInfo.icon}
                                            </span>
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
                    </div>
                </div>

                {/* Alerts Sidebar */}
                {!hideAlerts && (
                    <div className={styles.alertsSidebar}>
                        <div className={styles.alertsHeader}>
                            <span>📢 Dernières alertes</span>
                        </div>
                        <div className={styles.alertsList}>
                            {alerts.length === 0 ? (
                                <div className={styles.noAlerts}>Aucune alerte récente</div>
                            ) : (
                                alerts.map(alert => {
                                    const content = getAlertContent(alert)
                                    return (
                                        <div
                                            key={alert.id}
                                            className={`${styles.alertItem} ${styles[alert.type]}`}
                                            style={{ borderLeftColor: content.color }}
                                        >
                                            <span className={styles.alertIcon}>{content.icon}</span>
                                            <div className={styles.alertContent}>
                                                <span className={styles.alertText}>{content.text}</span>
                                                <span className={styles.alertTime}>{formatTime(alert.timestamp)}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className={styles.loading}>Chargement...</div>}>
            <ChatContent />
        </Suspense>
    )
}
