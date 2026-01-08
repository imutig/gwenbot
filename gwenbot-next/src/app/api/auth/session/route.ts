import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ authenticated: false, user: null })
    }

    try {
        const cookieStore = await cookies()

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Server Component context
                    }
                },
            },
        })

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ authenticated: false, user: null })
        }

        // Get user metadata from Twitch
        const userMetadata = user.user_metadata || {}

        return NextResponse.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                display_name: userMetadata.full_name || userMetadata.name || userMetadata.preferred_username || user.email,
                avatar_url: userMetadata.avatar_url || userMetadata.picture,
                provider: user.app_metadata?.provider || 'unknown'
            }
        })
    } catch (error) {
        console.error('Session check error:', error)
        return NextResponse.json({ authenticated: false, user: null })
    }
}
