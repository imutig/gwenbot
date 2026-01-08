import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminPage() {
    const supabase = await createClient()

    if (!supabase) {
        return (
            <div className="animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Configuration requise</h1>
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Les variables Supabase ne sont pas configurées.</p>
                </div>
            </div>
        )
    }

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/login')
    }

    // Check if admin
    // Twitch stores username in different metadata fields depending on OAuth config
    const twitchUsername = (
        user.user_metadata?.preferred_username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        ''
    ).toLowerCase()

    console.log('[Admin] Checking user:', twitchUsername, 'Raw metadata:', JSON.stringify(user.user_metadata))

    const { data: adminUser } = await supabase
        .from('authorized_users')
        .select('username, is_super_admin')
        .eq('username', twitchUsername)
        .single()

    if (!adminUser) {
        console.log('[Admin] User not found in authorized_users, redirecting')
        redirect('/')
    }

    return (
        <div className="animate-slideIn">
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Administration
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Connecté en tant que <strong>{user.user_metadata?.user_name}</strong>
                {adminUser.is_super_admin && <span style={{ marginLeft: '0.5rem', background: 'var(--pink-accent)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>Super Admin</span>}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Authorized Users */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Utilisateurs autorisés
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Gérer les admins et modérateurs
                    </p>
                    <button className="btn btn-primary" style={{ width: '100%' }}>
                        Gérer
                    </button>
                </div>

                {/* Cemantix Records */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path d="M4 22h16" />
                            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                        Records Cemantix
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Modifier les records FR/EN
                    </p>
                    <button className="btn btn-secondary" style={{ width: '100%' }}>
                        Modifier
                    </button>
                </div>

                {/* Leaderboard */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                            <line x1="18" x2="18" y1="20" y2="10" />
                            <line x1="12" x2="12" y1="20" y2="4" />
                            <line x1="6" x2="6" y1="20" y2="14" />
                        </svg>
                        Leaderboard
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Réinitialiser ou modifier
                    </p>
                    <button className="btn btn-secondary" style={{ width: '100%' }}>
                        Gérer
                    </button>
                </div>

                {/* Bot Status */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                            <rect width="18" height="10" x="3" y="11" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <line x1="8" x2="8" y1="16" y2="16" />
                            <line x1="16" x2="16" y1="16" y2="16" />
                        </svg>
                        Bot Status
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Statut et commandes du bot
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80' }}>
                        <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%' }}></span>
                        En ligne
                    </div>
                </div>
            </div>
        </div>
    )
}
