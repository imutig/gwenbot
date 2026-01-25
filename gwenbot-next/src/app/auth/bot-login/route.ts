import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Bot Login Route - Bot account logs in
 * Redirects to Twitch OAuth with all necessary scopes for bot
 */
export async function GET(request: NextRequest) {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    if (!TWITCH_CLIENT_ID) {
        return NextResponse.json({ error: 'TWITCH_CLIENT_ID not configured' }, { status: 500 })
    }

    const state = crypto.randomBytes(16).toString('hex')

    // All scopes for bot account
    const scopes = [
        // Chat & Messaging
        'user:bot',                         // Send messages as bot
        'user:read:chat',                   // Read chat messages
        'user:write:chat',                  // Write chat messages
        'chat:read',                        // Read chat (IRC style)
        'chat:edit',                        // Send chat (IRC style)
        'whispers:read',                    // Read whispers
        'whispers:edit',                    // Send whispers
        'user:manage:whispers',             // Manage whispers
        // Moderation
        'moderator:manage:chat_messages',   // Delete messages
        'moderator:manage:banned_users',    // Ban/unban users
        'moderator:manage:announcements',   // Send announcements
        'moderator:manage:automod',         // Manage AutoMod held messages
        'moderator:manage:blocked_terms',   // Manage blocked terms
        'moderator:manage:chat_settings',   // Manage chat settings
        'moderator:manage:shoutouts',       // Send shoutouts
        'moderator:manage:warnings',        // Warn users
        'moderator:read:chatters',          // Read chatters list
        'moderator:read:followers',         // Read followers
        'moderator:read:automod_settings',  // Read AutoMod settings
        'moderator:read:blocked_terms',     // Read blocked terms
        'moderator:read:chat_settings',     // Read chat settings
        'moderator:read:moderators',        // Read moderators list
        'moderator:read:vips',              // Read VIPs list
        'moderator:read:shield_mode',       // Read Shield Mode status
        'moderator:read:shoutouts',         // Read shoutouts
        'moderator:read:suspicious_users',  // Read suspicious users
        'moderator:read:unban_requests',    // Read unban requests
        // Clips & Content
        'clips:edit',                       // Create clips
        // User
        'user:read:email',                  // Read email
        'user:read:blocked_users',          // Read blocked users
        'user:manage:blocked_users',        // Manage blocked users
        'user:read:follows',                // Read follows
        'user:read:subscriptions',          // Read subscriptions
    ].join(' ')

    const redirectUri = `${baseUrl}/auth/bot-login-callback`

    const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
        `client_id=${TWITCH_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}`

    // Store state in cookie for verification
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('bot_login_state', state, {
        httpOnly: true,
        maxAge: 300,
        secure: process.env.NODE_ENV === 'production'
    })

    return response
}
