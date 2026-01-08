import { User } from '@supabase/supabase-js'

export function getTwitchUsername(user: User | null): string {
    if (!user) return ''

    return (
        user.user_metadata?.preferred_username ||
        user.user_metadata?.user_name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        ''
    ).toLowerCase()
}
