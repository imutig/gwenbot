'use client'

import { useState, useEffect } from 'react'
import FancyButton from '@/components/ui/fancy-button'
import Loader from '@/components/ui/loader'

interface User {
    id: string
    username: string
    is_super_admin: boolean
}

export default function UsersAdminPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [newUsername, setNewUsername] = useState('')
    const [message, setMessage] = useState('')

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users')
            const data = await res.json()
            if (data.users) {
                setUsers(data.users)
            }
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newUsername.trim()) return

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername })
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`Utilisateur ${newUsername} ajouté !`)
                setNewUsername('')
                fetchUsers()
            } else {
                setMessage(`Erreur: ${data.error}`)
            }
        } catch (error) {
            console.error('Error adding user:', error)
            setMessage('Erreur lors de l\'ajout')
        }
    }

    const handleRemoveUser = async (username: string) => {
        if (!confirm(`Supprimer ${username} des utilisateurs autorisés ?`)) return

        try {
            const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, {
                method: 'DELETE'
            })
            const data = await res.json()

            if (data.success) {
                setMessage(`Utilisateur ${username} supprimé.`)
                fetchUsers()
            } else {
                setMessage(`Erreur: ${data.error}`)
            }
        } catch (error) {
            console.error('Error removing user:', error)
            setMessage('Erreur lors de la suppression')
        }
    }

    return (
        <div className="animate-slideIn" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <a href="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>←</a>
                Utilisateurs Autorisés
            </h1>

            {/* Add User Form */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Ajouter un administrateur</h3>
                <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Nom d'utilisateur Twitch"
                        className="input-field"
                        style={{ flex: 1 }}
                    />
                    <FancyButton type="submit" size="sm">Ajouter</FancyButton>
                </form>
                {message && <p style={{ marginTop: '0.5rem', color: message.includes('Erreur') ? 'var(--red-400)' : 'var(--green-400)' }}>{message}</p>}
            </div>

            {/* Users List */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Liste des admins</h3>
                {loading ? (
                    <div style={{ textAlign: 'center' }}><Loader /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {users.map(user => (
                            <div key={user.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                background: 'var(--bg-base)',
                                borderRadius: '8px'
                            }}>
                                <span style={{ fontWeight: 500 }}>
                                    {user.username}
                                    {user.is_super_admin && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: 'var(--pink-accent)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Super Admin</span>}
                                </span>
                                {!user.is_super_admin && (
                                    <button
                                        onClick={() => handleRemoveUser(user.username)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '0.25rem'
                                        }}
                                        title="Supprimer"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                                            <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                        {users.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Aucun utilisateur trouvé.</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
