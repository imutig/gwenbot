/**
 * Auth Routes - OAuth and session management
 */

const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../db');

let sessions, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REDIRECT_URI, AUTHORIZED_USERS, isAdmin;

function createRouter(deps) {
    sessions = deps.sessions;
    TWITCH_CLIENT_ID = deps.TWITCH_CLIENT_ID;
    TWITCH_CLIENT_SECRET = deps.TWITCH_CLIENT_SECRET;
    TWITCH_REDIRECT_URI = deps.TWITCH_REDIRECT_URI;
    AUTHORIZED_USERS = deps.AUTHORIZED_USERS;
    isAdmin = deps.isAdmin;

    const router = express.Router();

    function getSession(req) {
        const sessionId = req.cookies.session_id;
        if (sessionId && sessions.has(sessionId)) {
            return sessions.get(sessionId);
        }
        return null;
    }

    // Start OAuth flow
    router.get('/login', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        const scopes = 'user:read:email';

        const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
            `client_id=${TWITCH_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&state=${state}`;

        res.cookie('oauth_state', state, { httpOnly: true, maxAge: 300000 });
        res.redirect(authUrl);
    });

    // OAuth callback
    router.get('/callback', async (req, res) => {
        const { code, state } = req.query;
        const savedState = req.cookies.oauth_state;

        if (!code || state !== savedState) {
            return res.redirect('http://localhost:3000?error=invalid_state');
        }

        try {
            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: TWITCH_CLIENT_ID,
                    client_secret: TWITCH_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: TWITCH_REDIRECT_URI
                })
            });

            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                return res.redirect('http://localhost:3000?error=token_failed');
            }

            const userResponse = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });

            const userData = await userResponse.json();
            const user = userData.data?.[0];

            if (!user) {
                return res.redirect('http://localhost:3000?error=user_failed');
            }

            const isBroadcaster = AUTHORIZED_USERS.includes(user.login.toLowerCase());

            const sessionId = crypto.randomBytes(32).toString('hex');
            sessions.set(sessionId, {
                user: {
                    id: user.id,
                    login: user.login,
                    display_name: user.display_name,
                    profile_image_url: user.profile_image_url,
                    is_mod: isBroadcaster
                },
                access_token: tokenData.access_token,
                created_at: Date.now()
            });

            res.clearCookie('oauth_state');
            res.cookie('session_id', sessionId, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000,
                secure: process.env.NODE_ENV === 'production'
            });

            res.redirect('http://localhost:3000/cemantig');
        } catch (error) {
            console.error('OAuth error:', error);
            res.redirect('/admin?error=auth_failed');
        }
    });

    // Logout
    router.get('/logout', (req, res) => {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            sessions.delete(sessionId);
        }
        res.clearCookie('session_id');
        res.redirect('/');
    });

    // Get current user
    router.get('/user', async (req, res) => {
        const session = getSession(req);
        if (!session) {
            return res.json({ authenticated: false });
        }

        const admin = await isAdmin(session);
        res.json({
            authenticated: true,
            isAdmin: admin,
            user: {
                login: session.user.login,
                display_name: session.user.display_name,
                profile_image_url: session.user.profile_image_url
            }
        });
    });

    return router;
}

// Bot authorization routes
function createBotAuthRouter(deps) {
    const router = express.Router();
    const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REDIRECT_URI, twitchClient } = deps;

    const baseUrl = TWITCH_REDIRECT_URI.replace('/auth/callback', '');

    // =============================================
    // STEP 1: Bot account login (gwenbot_ logs in)
    // Scope: user:bot - allows the app to send messages as the bot
    // =============================================
    router.get('/bot-login', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        // All scopes for bot account
        const scopes = [
            'user:bot',           // Send messages as bot
            'user:read:chat',     // Read chat messages
            'user:write:chat',    // Write chat messages
            'moderator:manage:chat_messages',  // Delete messages
            'moderator:manage:banned_users',   // Ban/unban users
            'moderator:manage:announcements',  // Send announcements
            'clips:edit',                      // Create clips
        ].join(' ');

        const botLoginRedirectUri = `${baseUrl}/auth/bot-login-callback`;

        const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
            `client_id=${TWITCH_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(botLoginRedirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&state=${state}`;

        res.cookie('bot_login_state', state, { httpOnly: true, maxAge: 300000 });
        res.redirect(authUrl);
    });

    // Bot login callback
    router.get('/bot-login-callback', async (req, res) => {
        const { code, state } = req.query;
        const savedState = req.cookies.bot_login_state;

        if (!code || state !== savedState) {
            return res.redirect('/admin?error=invalid_bot_login_state');
        }

        try {
            const botLoginRedirectUri = `${baseUrl}/auth/bot-login-callback`;

            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: TWITCH_CLIENT_ID,
                    client_secret: TWITCH_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: botLoginRedirectUri
                })
            });

            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                console.error('Bot login token exchange failed:', tokenData);
                return res.redirect('/admin?error=bot_login_token_failed');
            }

            const userResponse = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });

            const userData = await userResponse.json();
            const user = userData.data?.[0];

            if (!user) {
                return res.redirect('/admin?error=bot_login_user_failed');
            }

            // Save bot token to database with type 'bot'
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
            const scopes = tokenData.scope || [];

            // Check if exists
            const { data: existing } = await supabase
                .from('twitch_tokens')
                .select('id')
                .eq('token_type', 'bot')
                .eq('user_id', user.id)
                .single();

            if (existing) {
                await supabase
                    .from('twitch_tokens')
                    .update({
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('twitch_tokens')
                    .insert({
                        token_type: 'bot',
                        user_id: user.id,
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes
                    });
            }

            console.log(`✅ Bot account logged in: ${user.display_name} (${user.id})`);

            // Reload bot token in client
            if (twitchClient) {
                await twitchClient.loadBotToken();
            }

            res.clearCookie('bot_login_state');
            res.redirect('/admin?success=bot_logged_in');
        } catch (error) {
            console.error('Bot login OAuth error:', error);
            res.redirect('/admin?error=bot_login_failed');
        }
    });

    // =============================================
    // STEP 2: Broadcaster authorization (xsgwen authorizes)
    // Scope: channel:bot - allows the bot to appear with badge in this channel
    // =============================================
    router.get('/bot-authorize', (req, res) => {
        const state = crypto.randomBytes(16).toString('hex');
        // All scopes for broadcaster authorization
        const scopes = [
            'channel:bot',                    // Bot badge
            'moderator:read:chatters',        // List viewers
            'channel:read:subscriptions',     // See subscribers
            'bits:read',                      // See bits
            'channel:read:redemptions',       // See point redemptions
            'channel:manage:polls',           // Create/manage polls
            'channel:read:predictions',       // See predictions
            'channel:read:hype_train',        // See hype trains
        ].join(' ');

        const botAuthorizeRedirectUri = `${baseUrl}/auth/bot-authorize-callback`;

        const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
            `client_id=${TWITCH_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(botAuthorizeRedirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&state=${state}`;

        res.cookie('bot_authorize_state', state, { httpOnly: true, maxAge: 300000 });
        res.redirect(authUrl);
    });

    // Broadcaster authorization callback
    router.get('/bot-authorize-callback', async (req, res) => {
        const { code, state } = req.query;
        const savedState = req.cookies.bot_authorize_state;

        if (!code || state !== savedState) {
            return res.redirect('/admin?error=invalid_broadcaster_state');
        }

        try {
            const botAuthorizeRedirectUri = `${baseUrl}/auth/bot-authorize-callback`;

            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: TWITCH_CLIENT_ID,
                    client_secret: TWITCH_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: botAuthorizeRedirectUri
                })
            });

            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                console.error('Broadcaster authorization failed:', tokenData);
                return res.redirect('/admin?error=broadcaster_token_failed');
            }

            const userResponse = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });

            const userData = await userResponse.json();
            const user = userData.data?.[0];

            if (!user) {
                return res.redirect('/admin?error=broadcaster_user_failed');
            }

            // Save broadcaster token to database with type 'broadcaster'
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
            const scopes = tokenData.scope || [];

            // Check if exists
            const { data: existing } = await supabase
                .from('twitch_tokens')
                .select('id')
                .eq('token_type', 'broadcaster')
                .eq('user_id', user.id)
                .single();

            if (existing) {
                await supabase
                    .from('twitch_tokens')
                    .update({
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('twitch_tokens')
                    .insert({
                        token_type: 'broadcaster',
                        user_id: user.id,
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expires_at: expiresAt.toISOString(),
                        scopes: scopes
                    });
            }

            console.log(`✅ Broadcaster authorized bot: ${user.display_name} (${user.id})`);

            // Reload broadcaster token in client
            if (twitchClient) {
                await twitchClient.loadBroadcasterToken();
            }

            res.clearCookie('bot_authorize_state');
            res.redirect('/admin?success=broadcaster_authorized');
        } catch (error) {
            console.error('Broadcaster OAuth error:', error);
            res.redirect('/admin?error=broadcaster_auth_failed');
        }
    });

    // Status endpoint to check authorization status
    router.get('/bot-status', async (req, res) => {
        try {
            const { data: botToken } = await supabase
                .from('twitch_tokens')
                .select('user_id, expires_at, scopes')
                .eq('token_type', 'bot')
                .limit(1)
                .single();

            const { data: broadcasterToken } = await supabase
                .from('twitch_tokens')
                .select('user_id, expires_at, scopes')
                .eq('token_type', 'broadcaster')
                .limit(1)
                .single();

            res.json({
                botAuthorized: !!botToken,
                botUserId: botToken?.user_id || null,
                broadcasterAuthorized: !!broadcasterToken,
                broadcasterUserId: broadcasterToken?.user_id || null
            });
        } catch (error) {
            console.error('Error checking bot status:', error);
            res.json({ error: 'Failed to check status' });
        }
    });

    return router;
}

module.exports = { createRouter, createBotAuthRouter };
