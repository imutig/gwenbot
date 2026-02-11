import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import BingoLiveView from './bingo-live-view'

export default async function BingoLivePage() {
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/login')
    }

    const twitchUsername = (
        user.user_metadata?.preferred_username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        ''
    ).toLowerCase()

    const { data: adminUser } = await supabase
        .from('authorized_users')
        .select('username')
        .eq('username', twitchUsername)
        .single()

    if (!adminUser) {
        redirect('/')
    }

    return <BingoLiveView />
}
