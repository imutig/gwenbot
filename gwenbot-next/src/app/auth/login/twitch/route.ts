import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export async function POST() {
    const supabase = await createClient()

    if (!supabase) {
        return new Response('Supabase not configured', { status: 500 })
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL('/auth/callback', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString() : 'http://localhost:3000/auth/callback'}`,
            scopes: 'user:read:email',
        },
    })

    if (error) {
        console.error('OAuth error:', error)
        redirect('/auth/login?error=oauth')
    }

    if (data.url) {
        redirect(data.url)
    }

    redirect('/auth/login?error=unknown')
}
