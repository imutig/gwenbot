/**
 * Twitch Routes - Twitch API integration
 */

const express = require('express');

const TWITCH_BROADCASTER_LOGIN = 'xsgwen';

let TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET;
let twitchAccessToken = null;
let twitchTokenExpiry = 0;
let twitchBroadcasterId = null;

async function getTwitchToken() {
    if (twitchAccessToken && Date.now() < twitchTokenExpiry) {
        return twitchAccessToken;
    }

    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: TWITCH_CLIENT_ID,
                client_secret: TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        });

        const data = await response.json();
        twitchAccessToken = data.access_token;
        twitchTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        return twitchAccessToken;
    } catch (error) {
        console.error('Twitch token error:', error);
        return null;
    }
}

async function getBroadcasterId() {
    if (twitchBroadcasterId) return twitchBroadcasterId;

    const token = await getTwitchToken();
    if (!token) return null;

    try {
        const response = await fetch(`https://api.twitch.tv/helix/users?login=${TWITCH_BROADCASTER_LOGIN}`, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            twitchBroadcasterId = data.data[0].id;
            return twitchBroadcasterId;
        }
    } catch (error) {
        console.error('Broadcaster ID error:', error);
    }
    return null;
}

function createRouter(deps) {
    TWITCH_CLIENT_ID = deps.TWITCH_CLIENT_ID;
    TWITCH_CLIENT_SECRET = deps.TWITCH_CLIENT_SECRET;

    const router = express.Router();

    // Clips API
    router.get('/clips', async (req, res) => {
        const token = await getTwitchToken();
        const broadcasterId = await getBroadcasterId();

        if (!token || !broadcasterId) {
            return res.json({ clips: [], error: 'Twitch API not configured' });
        }

        try {
            const response = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=12`, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            const clips = (data.data || []).map(clip => ({
                id: clip.id,
                title: clip.title,
                url: clip.url,
                embed_url: clip.embed_url,
                thumbnail_url: clip.thumbnail_url,
                creator_name: clip.creator_name,
                view_count: clip.view_count,
                created_at: clip.created_at,
                duration: clip.duration
            }));

            res.json({ clips });
        } catch (error) {
            console.error('Clips API error:', error);
            res.json({ clips: [], error: 'Failed to fetch clips' });
        }
    });

    // Live status API
    router.get('/live', async (req, res) => {
        const token = await getTwitchToken();
        const broadcasterId = await getBroadcasterId();

        if (!token || !broadcasterId) {
            return res.json({ isLive: false });
        }

        try {
            const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            const isLive = data.data && data.data.length > 0;
            const stream = isLive ? data.data[0] : null;

            res.json({
                isLive,
                stream: stream ? {
                    title: stream.title,
                    game_name: stream.game_name,
                    viewer_count: stream.viewer_count,
                    started_at: stream.started_at,
                    thumbnail_url: stream.thumbnail_url
                } : null
            });
        } catch (error) {
            console.error('Live status error:', error);
            res.json({ isLive: false });
        }
    });

    // Followers count API
    router.get('/followers', async (req, res) => {
        const token = await getTwitchToken();
        const broadcasterId = await getBroadcasterId();

        if (!token || !broadcasterId) {
            return res.json({ followers: 0 });
        }

        try {
            const response = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            res.json({ followers: data.total || 0 });
        } catch (error) {
            console.error('Followers API error:', error);
            res.json({ followers: 0 });
        }
    });

    return router;
}

module.exports = { createRouter };
