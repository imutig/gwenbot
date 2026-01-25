import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Bot Authorization Route - Broadcaster authorizes the bot
 * Redirects to Twitch OAuth with all necessary scopes for broadcaster
 */
export async function GET(request: NextRequest) {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    if (!TWITCH_CLIENT_ID) {
        return NextResponse.json({ error: 'TWITCH_CLIENT_ID not configured' }, { status: 500 })
    }

    const state = crypto.randomBytes(16).toString('hex')

    // All scopes for broadcaster authorization
    const scopes = [
        // Channel Bot Permission
        'channel:bot',                      // Bot badge in channel
        // Channel Read Permissions
        'channel:read:subscriptions',       // See subscribers
        'channel:read:redemptions',         // See point redemptions
        'channel:read:hype_train',          // See hype trains
        'channel:read:predictions',         // See predictions
        'channel:read:polls',               // See polls
        'channel:read:goals',               // See Creator Goals
        'channel:read:charity',             // See charity campaigns
        'channel:read:vips',                // See VIPs list
        'channel:read:editors',             // See editors list
        'channel:read:ads',                 // See ads info
        'channel:read:guest_star',          // See Guest Star
        // Channel Manage Permissions
        'channel:manage:polls',             // Create/manage polls
        'channel:manage:predictions',       // Create/manage predictions
        'channel:manage:redemptions',       // Manage point rewards
        'channel:manage:vips',              // Add/remove VIPs
        'channel:manage:raids',             // Start/cancel raids
        'channel:manage:broadcast',         // Update stream title/game
        'channel:manage:schedule',          // Manage stream schedule
        'channel:manage:videos',            // Manage videos
        'channel:manage:ads',               // Manage ads
        'channel:manage:guest_star',        // Manage Guest Star
        'channel:edit:commercial',          // Run commercials
        // Bits & Analytics
        'bits:read',                        // See bits and leaderboard
        'analytics:read:extensions',        // Extension analytics
        'analytics:read:games',             // Game analytics
        // Moderation Read (as broadcaster)
        'moderator:read:chatters',          // List viewers
        'moderator:read:followers',         // List followers
        'moderator:read:shield_mode',       // Shield Mode status
        'moderator:read:automod_settings',  // AutoMod settings
        'moderation:read',                  // Moderation data
        // User permissions
        'user:read:email',                  // Read email
        'user:edit:broadcast',              // Edit broadcast config
        'user:read:broadcast',              // Read broadcast config
    ].join(' ')

    const redirectUri = `${baseUrl}/auth/bot-authorize-callback`

    const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
        `client_id=${TWITCH_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}`

    // Store state in cookie for verification
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('bot_authorize_state', state, {
        httpOnly: true,
        maxAge: 300,
        secure: process.env.NODE_ENV === 'production'
    })

    return response
}
