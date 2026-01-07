/**
 * Twitch Client Module
 * Handles EventSub WebSocket for receiving chat messages
 * and Send Chat Message API for sending messages with bot badge
 */

const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { query } = require('./db');

class TwitchClient extends EventEmitter {
    constructor(config) {
        super();

        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.botUserId = config.botUserId;
        this.broadcasterUserId = config.broadcasterUserId;
        this.channel = config.channel;

        // WebSocket state
        this.ws = null;
        this.sessionId = null;
        this.connected = false;
        this.reconnecting = false;
        this.keepaliveTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        // Token state
        this.appAccessToken = null;
        this.appTokenExpiry = 0;

        // Bot token (gwenbot_) - for sending messages
        this.botAccessToken = null;
        this.botRefreshToken = null;
        this.botTokenExpiry = 0;

        // Broadcaster token (xsgwen) - confirms channel:bot authorization
        this.broadcasterAccessToken = null;
        this.broadcasterRefreshToken = null;
        this.broadcasterTokenExpiry = 0;

        // Message queue for rate limiting
        this.messageQueue = [];
        this.messageInterval = null;
        this.messagesPerSecond = 20; // Mod rate limit
    }

    // ==================== TOKEN MANAGEMENT ====================

    /**
     * Get or refresh App Access Token
     */
    async getAppAccessToken() {
        if (this.appAccessToken && Date.now() < this.appTokenExpiry) {
            return this.appAccessToken;
        }

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                })
            });

            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }

            const data = await response.json();
            this.appAccessToken = data.access_token;
            this.appTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

            console.log('✅ App Access Token obtained');
            return this.appAccessToken;
        } catch (error) {
            console.error('❌ Failed to get App Access Token:', error);
            throw error;
        }
    }

    /**
     * Load Bot Access Token from database (gwenbot_ account)
     */
    async loadBotToken() {
        try {
            const result = await query(
                `SELECT access_token, refresh_token, expires_at, user_id
                 FROM twitch_tokens 
                 WHERE token_type = 'bot'
                 LIMIT 1`
            );

            if (result.rows.length > 0) {
                const token = result.rows[0];
                this.botAccessToken = token.access_token;
                this.botRefreshToken = token.refresh_token;
                this.botTokenExpiry = new Date(token.expires_at).getTime();
                this.botUserId = token.user_id;

                // Check if token needs refresh
                if (Date.now() >= this.botTokenExpiry - 300000) {
                    await this.refreshBotToken();
                }

                console.log(`✅ Bot token loaded for user ID: ${this.botUserId}`);
                return this.botAccessToken;
            }
            console.log('⚠️ No bot token found. Visit /auth/bot-login to authorize.');
            return null;
        } catch (error) {
            console.error('❌ Failed to load bot token:', error);
            return null;
        }
    }

    /**
     * Refresh Bot Access Token
     */
    async refreshBotToken() {
        if (!this.botRefreshToken) {
            console.error('❌ No bot refresh token available');
            return null;
        }

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: this.botRefreshToken
                })
            });

            if (!response.ok) {
                throw new Error(`Bot token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            this.botAccessToken = data.access_token;
            this.botRefreshToken = data.refresh_token;
            this.botTokenExpiry = Date.now() + (data.expires_in * 1000);

            // Update in database
            await query(
                `UPDATE twitch_tokens 
                 SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
                 WHERE token_type = 'bot'`,
                [data.access_token, data.refresh_token, new Date(this.botTokenExpiry)]
            );

            console.log('✅ Bot token refreshed');
            return this.botAccessToken;
        } catch (error) {
            console.error('❌ Failed to refresh bot token:', error);
            throw error;
        }
    }

    /**
     * Load Broadcaster Access Token from database (xsgwen account)
     */
    async loadBroadcasterToken() {
        try {
            const result = await query(
                `SELECT access_token, refresh_token, expires_at, user_id
                 FROM twitch_tokens 
                 WHERE token_type = 'broadcaster'
                 LIMIT 1`
            );

            if (result.rows.length > 0) {
                const token = result.rows[0];
                this.broadcasterAccessToken = token.access_token;
                this.broadcasterRefreshToken = token.refresh_token;
                this.broadcasterTokenExpiry = new Date(token.expires_at).getTime();
                this.broadcasterUserId = token.user_id;

                // Check if token needs refresh
                if (Date.now() >= this.broadcasterTokenExpiry - 300000) {
                    await this.refreshBroadcasterToken();
                }

                console.log(`✅ Broadcaster token loaded for user ID: ${this.broadcasterUserId}`);
                return this.broadcasterAccessToken;
            }
            console.log('⚠️ No broadcaster token found. Broadcaster should visit /auth/bot-authorize');
            return null;
        } catch (error) {
            console.error('❌ Failed to load broadcaster token:', error);
            return null;
        }
    }

    /**
     * Refresh Broadcaster Access Token
     */
    async refreshBroadcasterToken() {
        if (!this.broadcasterRefreshToken) {
            console.error('❌ No broadcaster refresh token available');
            return null;
        }

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: this.broadcasterRefreshToken
                })
            });

            if (!response.ok) {
                throw new Error(`Broadcaster token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            this.broadcasterAccessToken = data.access_token;
            this.broadcasterRefreshToken = data.refresh_token;
            this.broadcasterTokenExpiry = Date.now() + (data.expires_in * 1000);

            // Update in database
            await query(
                `UPDATE twitch_tokens 
                 SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
                 WHERE token_type = 'broadcaster'`,
                [data.access_token, data.refresh_token, new Date(this.broadcasterTokenExpiry)]
            );

            console.log('✅ Broadcaster token refreshed');
            return this.broadcasterAccessToken;
        } catch (error) {
            console.error('❌ Failed to refresh broadcaster token:', error);
            throw error;
        }
    }

    // ==================== EVENTSUB WEBSOCKET ====================

    /**
     * Connect to EventSub WebSocket
     */
    async connect() {
        if (this.connected) {
            console.log('⚠️ Already connected to EventSub');
            return;
        }

        // Get tokens first
        await this.getAppAccessToken();
        await this.loadBotToken();
        await this.loadBroadcasterToken();

        if (!this.botAccessToken) {
            console.log('⚠️ No bot token found. Bot account needs to authorize.');
            console.log('   Step 1: Visit /auth/bot-login (login as gwenbot_)');
        }

        if (!this.broadcasterAccessToken) {
            console.log('⚠️ No broadcaster token found. Broadcaster needs to authorize.');
            console.log('   Step 2: Visit /auth/bot-authorize (login as xsgwen)');
        }

        if (!this.botAccessToken || !this.broadcasterAccessToken) {
            console.log('⚠️ Bot will start but cannot send messages until both authorizations are complete.');
        }

        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to EventSub WebSocket...');

            this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

            this.ws.on('open', () => {
                console.log('✅ EventSub WebSocket connected');
                this.connected = true;
                this.reconnecting = false;
                this.reconnectAttempts = 0;
            });

            this.ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleWebSocketMessage(message);

                    if (message.metadata?.message_type === 'session_welcome') {
                        resolve();
                    }
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`⚠️ EventSub WebSocket closed: ${code} - ${reason}`);
                this.connected = false;
                this.sessionId = null;
                clearTimeout(this.keepaliveTimeout);

                if (!this.reconnecting && code !== 1000) {
                    this.attemptReconnect();
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ EventSub WebSocket error:', error);
                reject(error);
            });

            // Timeout for initial connection
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleWebSocketMessage(message) {
        const messageType = message.metadata?.message_type;

        switch (messageType) {
            case 'session_welcome':
                this.sessionId = message.payload.session.id;
                console.log(`✅ EventSub session established: ${this.sessionId}`);
                this.resetKeepalive(message.payload.session.keepalive_timeout_seconds);
                await this.subscribeToEvents();
                break;

            case 'session_keepalive':
                this.resetKeepalive(10);
                break;

            case 'notification':
                await this.handleNotification(message.payload);
                break;

            case 'session_reconnect':
                console.log('🔄 EventSub requesting reconnect...');
                const reconnectUrl = message.payload.session.reconnect_url;
                await this.handleReconnect(reconnectUrl);
                break;

            case 'revocation':
                console.log('⚠️ Subscription revoked:', message.payload.subscription);
                break;

            default:
                console.log('📨 Unknown message type:', messageType);
        }
    }

    /**
     * Reset keepalive timeout
     */
    resetKeepalive(timeoutSeconds) {
        clearTimeout(this.keepaliveTimeout);
        this.keepaliveTimeout = setTimeout(() => {
            console.log('⚠️ Keepalive timeout - reconnecting...');
            this.ws?.close();
            this.attemptReconnect();
        }, (timeoutSeconds + 10) * 1000);
    }

    /**
     * Subscribe to chat message events
     */
    async subscribeToEvents() {
        if (!this.sessionId) {
            console.error('❌ Cannot subscribe: no session ID');
            return;
        }

        // WebSocket transport requires User Access Token, not App Access Token
        if (!this.botAccessToken) {
            console.error('❌ Cannot subscribe: no bot token. Visit /auth/bot-login');
            return;
        }

        // Subscribe to channel.chat.message
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.botAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'channel.chat.message',
                    version: '1',
                    condition: {
                        broadcaster_user_id: this.broadcasterUserId,
                        user_id: this.botUserId
                    },
                    transport: {
                        method: 'websocket',
                        session_id: this.sessionId
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Subscribed to channel.chat.message');
            } else {
                console.error('❌ Failed to subscribe:', data);
            }
        } catch (error) {
            console.error('❌ Subscription error:', error);
        }
    }

    /**
     * Handle EventSub notifications
     */
    async handleNotification(payload) {
        const eventType = payload.subscription?.type;

        if (eventType === 'channel.chat.message') {
            const event = payload.event;

            // Emit event in TMI.js-compatible format
            this.emit('message', {
                channel: `#${event.broadcaster_user_login}`,
                username: event.chatter_user_login,
                displayName: event.chatter_user_name,
                userId: event.chatter_user_id,
                message: event.message.text,
                messageId: event.message_id,
                badges: event.badges || [],
                isMod: event.badges?.some(b => b.set_id === 'moderator') || false,
                isBroadcaster: event.chatter_user_id === event.broadcaster_user_id,
                isVip: event.badges?.some(b => b.set_id === 'vip') || false,
                fragments: event.message.fragments || [],
                color: event.color,
                self: event.chatter_user_id === this.botUserId
            });
        }
    }

    /**
     * Handle reconnection request
     */
    async handleReconnect(reconnectUrl) {
        this.reconnecting = true;
        const oldWs = this.ws;

        this.ws = new WebSocket(reconnectUrl);

        this.ws.on('open', () => {
            console.log('✅ Reconnected to new EventSub endpoint');
            oldWs.close();
        });

        this.ws.on('message', async (data) => {
            const message = JSON.parse(data.toString());
            await this.handleWebSocketMessage(message);
        });
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnect attempts reached');
            this.emit('disconnected');
            return;
        }

        this.reconnecting = true;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                console.error('❌ Reconnection failed:', error);
                this.attemptReconnect();
            }
        }, delay);
    }

    // ==================== SEND CHAT MESSAGE ====================

    /**
     * Send a chat message using the Helix API
     * Uses App Access Token for bot badge display
     */
    async say(channel, message) {
        // Queue the message
        this.messageQueue.push({ channel, message });

        // Start processing queue if not already running
        if (!this.messageInterval) {
            this.processMessageQueue();
        }
    }

    /**
     * Process message queue with rate limiting
     */
    processMessageQueue() {
        this.messageInterval = setInterval(async () => {
            if (this.messageQueue.length === 0) {
                clearInterval(this.messageInterval);
                this.messageInterval = null;
                return;
            }

            const { channel, message } = this.messageQueue.shift();
            await this.sendMessage(message);
        }, 1000 / this.messagesPerSecond);
    }

    /**
     * Actually send the message via API
     */
    async sendMessage(message, replyToMessageId = null) {
        try {
            const token = await this.getAppAccessToken();

            const body = {
                broadcaster_id: this.broadcasterUserId,
                sender_id: this.botUserId,
                message: message
            };

            if (replyToMessageId) {
                body.reply_parent_message_id = replyToMessageId;
            }

            const response = await fetch('https://api.twitch.tv/helix/chat/messages', {
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to send message:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Error sending message:', error);
            return false;
        }
    }

    /**
     * Send a chat announcement (highlighted message)
     * @param {string} message - The announcement text (max 500 chars)
     * @param {string} color - Color: blue, green, orange, purple, or primary (default)
     */
    async sendAnnouncement(message, color = 'primary') {
        if (!this.botAccessToken) {
            console.error('❌ Cannot send announcement: no bot token');
            return false;
        }

        try {
            const response = await fetch(
                `https://api.twitch.tv/helix/chat/announcements?broadcaster_id=${this.broadcasterUserId}&moderator_id=${this.botUserId}`,
                {
                    method: 'POST',
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${this.botAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message.substring(0, 500), // Max 500 chars
                        color: color
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to send announcement:', error);
                return false;
            }

            console.log(`📢 Announcement sent: ${message.substring(0, 50)}...`);
            return true;
        } catch (error) {
            console.error('❌ Error sending announcement:', error);
            return false;
        }
    }

    /**
     * Create a clip from the broadcaster's stream
     * @param {string} title - Optional title for the clip
     * @returns {Object|null} { id, editUrl } or null if failed
     */
    async createClip(title = null) {
        if (!this.botAccessToken) {
            console.error('❌ Cannot create clip: no bot token');
            return null;
        }

        try {
            let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${this.broadcasterUserId}`;
            if (title) {
                url += `&title=${encodeURIComponent(title)}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.botAccessToken}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to create clip:', error);
                return null;
            }

            const data = await response.json();
            const clip = data.data?.[0];

            if (clip) {
                console.log(`🎬 Clip created: ${clip.id}`);
                return {
                    id: clip.id,
                    editUrl: clip.edit_url
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error creating clip:', error);
            return null;
        }
    }

    // ==================== POLLS METHODS ====================

    /**
     * Get polls for the broadcaster's channel
     * @returns {Array} List of polls
     */
    async getPolls() {
        if (!this.broadcasterAccessToken) {
            console.error('❌ Cannot get polls: no broadcaster token');
            return [];
        }

        try {
            const response = await fetch(
                `https://api.twitch.tv/helix/polls?broadcaster_id=${this.broadcasterUserId}`,
                {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${this.broadcasterAccessToken}`
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to get polls:', error);
                return [];
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('❌ Error getting polls:', error);
            return [];
        }
    }

    /**
     * Create a poll
     * @param {string} title - Poll question (max 60 chars)
     * @param {Array<string>} choices - Array of choice titles (2-5 choices, max 25 chars each)
     * @param {number} duration - Duration in seconds (15-1800)
     * @returns {Object|null} Created poll or null
     */
    async createPoll(title, choices, duration = 60) {
        if (!this.broadcasterAccessToken) {
            console.error('❌ Cannot create poll: no broadcaster token');
            return null;
        }

        try {
            const response = await fetch('https://api.twitch.tv/helix/polls', {
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.broadcasterAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    broadcaster_id: this.broadcasterUserId,
                    title: title.substring(0, 60),
                    choices: choices.slice(0, 5).map(c => ({ title: c.substring(0, 25) })),
                    duration: Math.min(Math.max(duration, 15), 1800)
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to create poll:', error);
                return null;
            }

            const data = await response.json();
            const poll = data.data?.[0];

            if (poll) {
                console.log(`📊 Poll created: ${poll.title}`);
                return poll;
            }

            return null;
        } catch (error) {
            console.error('❌ Error creating poll:', error);
            return null;
        }
    }

    /**
     * End a poll
     * @param {string} pollId - ID of the poll to end
     * @param {boolean} archive - If true, archives the poll (hides it)
     * @returns {Object|null} Ended poll or null
     */
    async endPoll(pollId, archive = false) {
        if (!this.broadcasterAccessToken) {
            console.error('❌ Cannot end poll: no broadcaster token');
            return null;
        }

        try {
            const response = await fetch('https://api.twitch.tv/helix/polls', {
                method: 'PATCH',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.broadcasterAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    broadcaster_id: this.broadcasterUserId,
                    id: pollId,
                    status: archive ? 'ARCHIVED' : 'TERMINATED'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to end poll:', error);
                return null;
            }

            const data = await response.json();
            const poll = data.data?.[0];

            if (poll) {
                console.log(`📊 Poll ended: ${poll.title}`);
                return poll;
            }

            return null;
        } catch (error) {
            console.error('❌ Error ending poll:', error);
            return null;
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get list of users connected to the broadcaster's chat
     * Requires moderator:read:chatters scope (from broadcaster token)
     * @returns {Array} List of {user_id, user_login, user_name}
     */
    async getChatters() {
        if (!this.broadcasterAccessToken) {
            console.error('❌ Cannot get chatters: no broadcaster token');
            return [];
        }

        try {
            const allChatters = [];
            let cursor = null;

            do {
                let url = `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${this.broadcasterUserId}&moderator_id=${this.broadcasterUserId}&first=1000`;
                if (cursor) {
                    url += `&after=${cursor}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${this.broadcasterAccessToken}`
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('❌ Failed to get chatters:', error);
                    return allChatters;
                }

                const data = await response.json();
                allChatters.push(...data.data);
                cursor = data.pagination?.cursor || null;

            } while (cursor);

            return allChatters;
        } catch (error) {
            console.error('❌ Error getting chatters:', error);
            return [];
        }
    }

    /**
     * Get the broadcaster's custom emotes (subscriber, follower, bits tier)
     * @returns {Array} List of emote names
     */
    async getChannelEmotes() {
        try {
            const token = await this.getAppAccessToken();

            const response = await fetch(
                `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${this.broadcasterUserId}`,
                {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to get channel emotes:', error);
                return [];
            }

            const data = await response.json();

            // Extract just the emote names for easy matching
            const emoteNames = data.data.map(emote => emote.name);

            console.log(`😀 Loaded ${emoteNames.length} channel emotes`);
            return emoteNames;
        } catch (error) {
            console.error('❌ Error getting channel emotes:', error);
            return [];
        }
    }

    /**
     * Get broadcaster user ID from login
     */
    async getUserId(login) {
        try {
            const token = await this.getAppAccessToken();

            const response = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data.data?.[0]?.id || null;
        } catch (error) {
            console.error('❌ Failed to get user ID:', error);
            return null;
        }
    }

    /**
     * Disconnect from EventSub
     */
    disconnect() {
        clearTimeout(this.keepaliveTimeout);
        clearInterval(this.messageInterval);

        if (this.ws) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }

        this.connected = false;
        this.sessionId = null;
        console.log('🔌 Disconnected from EventSub');
    }
}

module.exports = { TwitchClient };
