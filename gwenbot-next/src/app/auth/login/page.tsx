import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function LoginPage() {
    const supabase = await createClient()

    if (!supabase) {
        return (
            <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Configuration requise</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Les variables Supabase ne sont pas configurées.</p>
                </div>
            </div>
        )
    }

    // Check if already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        redirect('/')
    }

    return (
        <div className="animate-slideIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Connexion</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Connecte-toi avec ton compte Twitch</p>

                <form action="/auth/login/twitch" method="POST">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            background: '#9146FF'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                        </svg>
                        Se connecter avec Twitch
                    </button>
                </form>
            </div>
        </div>
    )
}
