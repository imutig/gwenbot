import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function PollsPage() {
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
    const { data: adminUser } = await supabase
        .from('authorized_users')
        .select('username')
        .eq('username', user.user_metadata?.user_name?.toLowerCase())
        .single()

    if (!adminUser) {
        redirect('/')
    }

    return (
        <div className="animate-slideIn">
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                    <line x1="18" x2="18" y1="20" y2="10" />
                    <line x1="12" x2="12" y1="20" y2="4" />
                    <line x1="6" x2="6" y1="20" y2="14" />
                </svg>
                Sondages
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Créer et gérer les sondages pour le stream</p>

            {/* Create Poll */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Créer un sondage</h3>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Question</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Quelle est votre question ?"
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Options</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input type="text" className="input" placeholder="Option 1" style={{ width: '100%' }} />
                        <input type="text" className="input" placeholder="Option 2" style={{ width: '100%' }} />
                        <input type="text" className="input" placeholder="Option 3 (optionnel)" style={{ width: '100%' }} />
                        <input type="text" className="input" placeholder="Option 4 (optionnel)" style={{ width: '100%' }} />
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>Durée</label>
                    <select className="input" style={{ width: '100%' }}>
                        <option value="60">1 minute</option>
                        <option value="120">2 minutes</option>
                        <option value="300" selected>5 minutes</option>
                        <option value="600">10 minutes</option>
                    </select>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }}>
                    Créer le sondage
                </button>
            </div>

            {/* Active Polls */}
            <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Sondages actifs</h3>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                    Aucun sondage actif pour le moment
                </p>
            </div>
        </div>
    )
}
