/**
 * Twitch Client Module
 * Handles EventSub WebSocket for receiving chat messages
 * and Send Chat Message API for sending messages with bot badge
 */

const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { supabase } = require('./db');

class TwitchClient extends EventEmitter {
    constructor(config) {
        super();

        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.botUserId = config.botUserId;
        this.broadcasterUserId = config.broadcasterUserId;
        this.channel = config.channel;

        // WebSocket state (bot connection - for chat messages)
        this.ws = null;
        this.sessionId = null;
        this.connected = false;
        this.reconnecting = false;
        this.keepaliveTimeout = null;
        this.keepaliveTimeoutSeconds = 10;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;

        // Broadcaster WebSocket (for sub/follow/raid/cheer events)
        this.broadcasterWs = null;
        this.broadcasterSessionId = null;
        this.broadcasterConnected = false;
        this.broadcasterReconnecting = false;
        this.broadcasterKeepaliveTimeout = null;
        this.broadcasterKeepaliveTimeoutSeconds = 10;
        this.broadcasterReconnectAttempts = 0;

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
            const { data: token, error } = await supabase
                .from('twitch_tokens')
                .select('access_token, refresh_token, expires_at, user_id')
                .eq('token_type', 'bot')
                .single();

            if (error || !token) {
                console.log('⚠️ No bot token found. Visit /auth/bot-login to authorize.');
                return null;
            }

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
            await supabase
                .from('twitch_tokens')
                .update({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_at: new Date(this.botTokenExpiry).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('token_type', 'bot');

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
            // Use the broadcasterUserId from config to ensure we get the correct token
            const targetUserId = this.broadcasterUserId || process.env.TWITCH_BROADCASTER_ID;

            const { data: token, error } = await supabase
                .from('twitch_tokens')
                .select('access_token, refresh_token, expires_at, user_id')
                .eq('token_type', 'broadcaster')
                .eq('user_id', targetUserId)
                .single();

            if (error || !token) {
                // Fallback: try to get any broadcaster token
                const { data: fallbackToken } = await supabase
                    .from('twitch_tokens')
                    .select('access_token, refresh_token, expires_at, user_id')
                    .eq('token_type', 'broadcaster')
                    .single();

                if (!fallbackToken) {
                    console.log('⚠️ No broadcaster token found. Broadcaster should visit /auth/bot-authorize');
                    return null;
                }

                this.broadcasterAccessToken = fallbackToken.access_token;
                this.broadcasterRefreshToken = fallbackToken.refresh_token;
                this.broadcasterTokenExpiry = new Date(fallbackToken.expires_at).getTime();
                this.broadcasterUserId = fallbackToken.user_id;
            } else {
                this.broadcasterAccessToken = token.access_token;
                this.broadcasterRefreshToken = token.refresh_token;
                this.broadcasterTokenExpiry = new Date(token.expires_at).getTime();
                this.broadcasterUserId = token.user_id;
            }

            // Check if token needs refresh
            if (Date.now() >= this.broadcasterTokenExpiry - 300000) {
                await this.refreshBroadcasterToken();
            }

            console.log(`✅ Broadcaster token loaded for user ID: ${this.broadcasterUserId}`);
            return this.broadcasterAccessToken;
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
            await supabase
                .from('twitch_tokens')
                .update({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_at: new Date(this.broadcasterTokenExpiry).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('token_type', 'broadcaster');

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

        // Connect bot WebSocket (for chat messages)
        await this.connectBotWebSocket();

        // Connect broadcaster WebSocket (for subs/follows/raids/cheers)
        if (this.broadcasterAccessToken) {
            await this.connectBroadcasterWebSocket();
        }
    }

    /**
     * Connect the bot WebSocket (for channel.chat.message)
     */
    async connectBotWebSocket() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to EventSub WebSocket (bot)...');

            this.ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

            this.ws.on('open', () => {
                console.log('✅ EventSub WebSocket connected (bot)');
                this.connected = true;
                this.reconnecting = false;
                this.reconnectAttempts = 0;
            });

            this.ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleBotWebSocketMessage(message);

                    if (message.metadata?.message_type === 'session_welcome') {
                        resolve();
                    }
                } catch (error) {
                    console.error('❌ Error parsing bot WebSocket message:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`⚠️ Bot WebSocket closed: ${code} - ${reason}`);
                this.connected = false;
                this.sessionId = null;
                clearTimeout(this.keepaliveTimeout);

                if (!this.reconnecting) {
                    this.attemptReconnect('bot');
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ Bot WebSocket error:', error);
                reject(error);
            });

            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Bot connection timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Connect the broadcaster WebSocket (for subs, follows, raids, cheers)
     */
    async connectBroadcasterWebSocket() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to EventSub WebSocket (broadcaster)...');

            this.broadcasterWs = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

            this.broadcasterWs.on('open', () => {
                console.log('✅ EventSub WebSocket connected (broadcaster)');
                this.broadcasterConnected = true;
                this.broadcasterReconnecting = false;
                this.broadcasterReconnectAttempts = 0;
            });

            this.broadcasterWs.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleBroadcasterWebSocketMessage(message);

                    if (message.metadata?.message_type === 'session_welcome') {
                        resolve();
                    }
                } catch (error) {
                    console.error('❌ Error parsing broadcaster WebSocket message:', error);
                }
            });

            this.broadcasterWs.on('close', (code, reason) => {
                console.log(`⚠️ Broadcaster WebSocket closed: ${code} - ${reason}`);
                this.broadcasterConnected = false;
                this.broadcasterSessionId = null;
                clearTimeout(this.broadcasterKeepaliveTimeout);

                if (!this.broadcasterReconnecting) {
                    this.attemptReconnect('broadcaster');
                }
            });

            this.broadcasterWs.on('error', (error) => {
                console.error('❌ Broadcaster WebSocket error:', error);
                reject(error);
            });

            setTimeout(() => {
                if (!this.broadcasterConnected) {
                    reject(new Error('Broadcaster connection timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    /**
     * Handle incoming bot WebSocket messages
     */
    async handleBotWebSocketMessage(message) {
        const messageType = message.metadata?.message_type;

        switch (messageType) {
            case 'session_welcome':
                this.sessionId = message.payload.session.id;
                this.keepaliveTimeoutSeconds = message.payload.session.keepalive_timeout_seconds || 10;
                console.log(`✅ Bot EventSub session established: ${this.sessionId} (keepalive: ${this.keepaliveTimeoutSeconds}s)`);
                this.resetKeepalive('bot');
                await this.subscribeToBotEvents();
                break;

            case 'session_keepalive':
                this.resetKeepalive('bot');
                break;

            case 'notification':
                await this.handleNotification(message.payload);
                break;

            case 'session_reconnect':
                console.log('🔄 Bot EventSub requesting reconnect...');
                const reconnectUrl = message.payload.session.reconnect_url;
                await this.handleReconnect(reconnectUrl, 'bot');
                break;

            case 'revocation':
                console.log('⚠️ Bot subscription revoked:', message.payload.subscription);
                break;
        }
    }

    /**
     * Handle incoming broadcaster WebSocket messages
     */
    async handleBroadcasterWebSocketMessage(message) {
        const messageType = message.metadata?.message_type;

        switch (messageType) {
            case 'session_welcome':
                this.broadcasterSessionId = message.payload.session.id;
                this.broadcasterKeepaliveTimeoutSeconds = message.payload.session.keepalive_timeout_seconds || 10;
                console.log(`✅ Broadcaster EventSub session established: ${this.broadcasterSessionId} (keepalive: ${this.broadcasterKeepaliveTimeoutSeconds}s)`);
                this.resetKeepalive('broadcaster');
                await this.subscribeToBroadcasterEvents();
                break;

            case 'session_keepalive':
                this.resetKeepalive('broadcaster');
                break;

            case 'notification':
                await this.handleNotification(message.payload);
                break;

            case 'session_reconnect':
                console.log('🔄 Broadcaster EventSub requesting reconnect...');
                const bReconnectUrl = message.payload.session.reconnect_url;
                await this.handleReconnect(bReconnectUrl, 'broadcaster');
                break;

            case 'revocation':
                console.log('⚠️ Broadcaster subscription revoked:', message.payload.subscription);
                break;
        }
    }

    /**
     * Reset keepalive timeout for a specific connection
     */
    resetKeepalive(type) {
        if (type === 'bot') {
            clearTimeout(this.keepaliveTimeout);
            this.keepaliveTimeout = setTimeout(() => {
                console.log('⚠️ Bot keepalive timeout - reconnecting...');
                this.ws?.close();
                this.attemptReconnect('bot');
            }, (this.keepaliveTimeoutSeconds + 10) * 1000);
        } else {
            clearTimeout(this.broadcasterKeepaliveTimeout);
            this.broadcasterKeepaliveTimeout = setTimeout(() => {
                console.log('⚠️ Broadcaster keepalive timeout - reconnecting...');
                this.broadcasterWs?.close();
                this.attemptReconnect('broadcaster');
            }, (this.broadcasterKeepaliveTimeoutSeconds + 10) * 1000);
        }
    }

    /**
     * Subscribe to chat message events
     */
    /**
     * Subscribe bot events (chat messages only - uses bot token + bot session)
     */
    async subscribeToBotEvents() {
        if (!this.sessionId || !this.botAccessToken) {
            console.error('❌ Cannot subscribe bot events: missing session or token');
            return;
        }

        await this.createSubscription({
            type: 'channel.chat.message',
            version: '1',
            condition: {
                broadcaster_user_id: this.broadcasterUserId,
                user_id: this.botUserId
            }
        }, this.botAccessToken, this.sessionId);
    }

    /**
     * Subscribe broadcaster events (subs, follows, raids, cheers - uses broadcaster token + broadcaster session)
     */
    async subscribeToBroadcasterEvents() {
        if (!this.broadcasterSessionId || !this.broadcasterAccessToken) {
            console.error('❌ Cannot subscribe broadcaster events: missing session or token');
            return;
        }

        const subscriptions = [
            { type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: this.broadcasterUserId } },
            { type: 'channel.subscription.message', version: '1', condition: { broadcaster_user_id: this.broadcasterUserId } },
            { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: this.broadcasterUserId } },
            { type: 'channel.cheer', version: '1', condition: { broadcaster_user_id: this.broadcasterUserId } },
            { type: 'channel.raid', version: '1', condition: { to_broadcaster_user_id: this.broadcasterUserId } },
            { type: 'channel.follow', version: '2', condition: { broadcaster_user_id: this.broadcasterUserId, moderator_user_id: this.broadcasterUserId } }
        ];

        for (const sub of subscriptions) {
            await this.createSubscription(sub, this.broadcasterAccessToken, this.broadcasterSessionId);
        }
    }

    /**
     * Create a single EventSub subscription
     */
    async createSubscription(sub, token, sessionId) {
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: sub.type,
                    version: sub.version,
                    condition: sub.condition,
                    transport: {
                        method: 'websocket',
                        session_id: sessionId
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ Subscribed to ${sub.type}`);
            } else {
                if (data.message?.includes('scope')) {
                    console.log(`⚠️ Missing scope for ${sub.type}`);
                } else {
                    console.error(`❌ Failed to subscribe to ${sub.type}:`, data.message || data);
                }
            }
        } catch (error) {
            console.error(`❌ Subscription error for ${sub.type}:`, error);
        }
    }

    /**
     * Handle EventSub notifications
     */
    async handleNotification(payload) {
        const eventType = payload.subscription?.type;
        const event = payload.event;

        switch (eventType) {
            case 'channel.chat.message':
                // Emit event in TMI.js-compatible format
                this.emit('message', {
                    channel: `#${event.broadcaster_user_login}`,
                    username: event.chatter_user_login,
                    displayName: event.chatter_user_name,
                    userId: event.chatter_user_id,
                    message: event.message.text,
                    messageId: event.message_id,
                    badges: event.badges || [],
                    isMod: event.badges?.some(b => b.set_id === 'moderator' || b.set_id === 'lead_moderator') || false,
                    isBroadcaster: event.chatter_user_id === event.broadcaster_user_id,
                    isVip: event.badges?.some(b => b.set_id === 'vip') || false,
                    fragments: event.message.fragments || [],
                    color: event.color,
                    self: event.chatter_user_id === this.botUserId
                });
                break;

            case 'channel.subscribe':
                this.emit('alert', {
                    type: 'sub',
                    username: event.user_name,
                    userId: event.user_id,
                    tier: event.tier,
                    isGift: event.is_gift
                });
                console.log(`⭐ New sub: ${event.user_name} (Tier ${event.tier})`);
                break;

            case 'channel.subscription.message':
                this.emit('alert', {
                    type: 'resub',
                    username: event.user_name,
                    userId: event.user_id,
                    tier: event.tier,
                    months: event.cumulative_months,
                    streak: event.streak_months,
                    message: event.message?.text || ''
                });
                console.log(`🌟 Resub: ${event.user_name} (${event.cumulative_months} months)`);
                break;

            case 'channel.subscription.gift':
                this.emit('alert', {
                    type: 'giftsub',
                    username: event.user_name || 'Anonymous',
                    userId: event.user_id,
                    tier: event.tier,
                    total: event.total,
                    cumulativeTotal: event.cumulative_total
                });
                console.log(`🎁 Gift subs: ${event.user_name || 'Anonymous'} gifted ${event.total} subs`);
                break;

            case 'channel.cheer':
                this.emit('alert', {
                    type: 'bits',
                    username: event.user_name || 'Anonymous',
                    userId: event.user_id,
                    bits: event.bits,
                    message: event.message || ''
                });
                console.log(`💎 Bits: ${event.user_name || 'Anonymous'} cheered ${event.bits} bits`);
                break;

            case 'channel.raid':
                this.emit('alert', {
                    type: 'raid',
                    username: event.from_broadcaster_user_name,
                    userId: event.from_broadcaster_user_id,
                    viewers: event.viewers
                });
                console.log(`🚀 Raid: ${event.from_broadcaster_user_name} with ${event.viewers} viewers`);
                break;

            case 'channel.follow':
                this.emit('alert', {
                    type: 'follow',
                    username: event.user_name,
                    userId: event.user_id
                });
                console.log(`💖 Follow: ${event.user_name}`);
                break;
        }
    }
    /**
     * Handle reconnection request from Twitch
     */
    async handleReconnect(reconnectUrl, type = 'bot') {
        console.log(`🔄 Reconnecting ${type} to:`, reconnectUrl);

        if (type === 'bot') {
            this.reconnecting = true;
            const oldWs = this.ws;
            this.ws = new WebSocket(reconnectUrl);
            this.ws.on('open', () => {
                console.log('✅ Reconnected bot to new EventSub endpoint');
                oldWs.close();
            });
            this.ws.on('message', async (data) => {
                const message = JSON.parse(data.toString());
                await this.handleBotWebSocketMessage(message);
            });
        } else {
            this.broadcasterReconnecting = true;
            const oldWs = this.broadcasterWs;
            this.broadcasterWs = new WebSocket(reconnectUrl);
            this.broadcasterWs.on('open', () => {
                console.log('✅ Reconnected broadcaster to new EventSub endpoint');
                oldWs.close();
            });
            this.broadcasterWs.on('message', async (data) => {
                const message = JSON.parse(data.toString());
                await this.handleBroadcasterWebSocketMessage(message);
            });
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect(type = 'bot') {
        if (type === 'bot') {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('❌ Max bot reconnect attempts reached');
                this.emit('disconnected');
                return;
            }
            this.reconnecting = true;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting bot in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
            setTimeout(async () => {
                try {
                    await this.connectBotWebSocket();
                } catch (error) {
                    console.error('❌ Bot reconnection failed:', error);
                    this.attemptReconnect('bot');
                }
            }, delay);
        } else {
            if (this.broadcasterReconnectAttempts >= this.maxReconnectAttempts) {
                console.error('❌ Max broadcaster reconnect attempts reached');
                return;
            }
            this.broadcasterReconnecting = true;
            const delay = Math.min(1000 * Math.pow(2, this.broadcasterReconnectAttempts), 30000);
            this.broadcasterReconnectAttempts++;
            console.log(`🔄 Reconnecting broadcaster in ${delay / 1000}s (attempt ${this.broadcasterReconnectAttempts})...`);
            setTimeout(async () => {
                try {
                    await this.connectBroadcasterWebSocket();
                } catch (error) {
                    console.error('❌ Broadcaster reconnection failed:', error);
                    this.attemptReconnect('broadcaster');
                }
            }, delay);
        }
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


    // ==================== CHANNEL MANAGEMENT ====================

    /**
     * Update channel information (title and/or game)
     * @param {string|null} title - New stream title (max 140 chars)
     * @param {string|null} gameId - Game/category ID
     * @returns {boolean} Success
     */
    async updateChannelInfo(title = null, gameId = null) {
        if (!this.broadcasterAccessToken) {
            console.error('❌ Cannot update channel: no broadcaster token');
            return false;
        }

        const body = {};
        if (title !== null) body.title = title.substring(0, 140);
        if (gameId !== null) body.game_id = gameId;

        if (Object.keys(body).length === 0) {
            console.log('⚠️ No changes to update');
            return false;
        }

        try {
            const response = await fetch(
                `https://api.twitch.tv/helix/channels?broadcaster_id=${this.broadcasterUserId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${this.broadcasterAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to update channel:', error);
                return false;
            }

            if (title) console.log(`📝 Title updated: ${title}`);
            if (gameId) console.log(`🎮 Game updated: ${gameId}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating channel:', error);
            return false;
        }
    }

    /**
     * Search for game categories
     * @param {string} query - Search query
     * @returns {Array} List of matching categories [{id, name, box_art_url}]
     */
    async searchCategories(query) {
        try {
            const token = await this.getAppAccessToken();

            const response = await fetch(
                `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=10`,
                {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Failed to search categories:', error);
                return [];
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('❌ Error searching categories:', error);
            return [];
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

            // Use the correct endpoint for channel-specific emotes
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
            const emoteNames = data.data ? data.data.map(emote => emote.name) : [];

            if (emoteNames.length > 0) {
                console.log(`😀 Loaded ${emoteNames.length} channel emotes`);
                console.log(`😀 Channel emotes: ${emoteNames.slice(0, 5).join(', ')}${emoteNames.length > 5 ? '...' : ''}`);
            } else {
                console.log(`😀 Loaded 0 channel emotes (broadcaster_id: ${this.broadcasterUserId})`);
            }
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
