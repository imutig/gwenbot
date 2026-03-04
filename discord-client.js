/**
 * Discord Client for Spotify Presence & Planning
 * Connects to Discord to fetch the streamer's currently playing Spotify track
 * and manage interactive stream planning via slash commands.
 */

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const {
    buildPlanningCommand,
    handlePlanningInteraction,
    loadPlanningMessageId,
} = require('./discord-planning');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_STREAMER_ID = process.env.DISCORD_STREAMER_ID;
const DISCORD_APP_ID = process.env.DISCORD_APP_ID;

let discordClient = null;
let isReady = false;

/**
 * Register slash commands with Discord API
 */
async function registerSlashCommands() {
    if (!DISCORD_APP_ID || !DISCORD_GUILD_ID) {
        console.log('⚠️ DISCORD_APP_ID or DISCORD_GUILD_ID not set, skipping slash command registration');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

    const commands = [
        buildPlanningCommand().toJSON(),
    ];

    try {
        await rest.put(
            Routes.applicationGuildCommands(DISCORD_APP_ID, DISCORD_GUILD_ID),
            { body: commands },
        );
        console.log('📋 Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }
}

/**
 * Initialize the Discord client
 */
async function initDiscordClient() {
    if (!DISCORD_BOT_TOKEN) {
        console.log('⚠️ DISCORD_BOT_TOKEN not set, Discord features disabled');
        return false;
    }

    if (!DISCORD_GUILD_ID || !DISCORD_STREAMER_ID) {
        console.log('⚠️ DISCORD_GUILD_ID or DISCORD_STREAMER_ID not set');
        return false;
    }

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildMembers,
        ]
    });

    discordClient.once('ready', async () => {
        console.log(`🎵 Discord bot connected as ${discordClient.user.tag}`);
        isReady = true;

        // Register slash commands
        await registerSlashCommands();

        // Load saved planning message ID
        await loadPlanningMessageId();
    });

    // Handle all interactions (slash commands, buttons, selects, modals)
    discordClient.on('interactionCreate', async (interaction) => {
        try {
            const handled = await handlePlanningInteraction(interaction);
            if (!handled) {
                // Future: route other commands here
            }
        } catch (error) {
            console.error('❌ Error handling interaction:', error);
            const reply = { content: '❌ Une erreur est survenue.', ephemeral: true };
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(reply);
                } else {
                    await interaction.reply(reply);
                }
            } catch { /* interaction expired */ }
        }
    });

    discordClient.on('error', (error) => {
        console.error('Discord client error:', error);
    });

    try {
        await discordClient.login(DISCORD_BOT_TOKEN);
        return true;
    } catch (error) {
        console.error('Failed to connect to Discord:', error.message);
        return false;
    }
}

/**
 * Get the Spotify activity from the streamer's Discord presence
 * @returns {Object|null} Spotify activity info or null if not listening
 */
async function getSpotifyActivity() {
    if (!isReady || !discordClient) {
        return { error: 'Discord not connected' };
    }

    try {
        const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(DISCORD_STREAMER_ID);

        if (!member || !member.presence) {
            return { error: 'Streamer not found or offline on Discord' };
        }

        // Find Spotify activity (type 2 = Listening)
        const spotifyActivity = member.presence.activities.find(
            activity => activity.type === 2 && activity.name === 'Spotify'
        );

        if (!spotifyActivity) {
            return { notPlaying: true };
        }

        return {
            song: spotifyActivity.details,           // Track name
            artist: spotifyActivity.state,            // Artist(s)
            album: spotifyActivity.assets?.largeText, // Album name
            albumArt: spotifyActivity.assets?.largeImageURL(), // Album cover
            trackId: spotifyActivity.syncId,          // Spotify track ID
            startedAt: spotifyActivity.timestamps?.start,
            endsAt: spotifyActivity.timestamps?.end
        };
    } catch (error) {
        console.error('Error fetching Spotify activity:', error);
        return { error: error.message };
    }
}

/**
 * Check if Discord client is ready
 */
function isDiscordReady() {
    return isReady;
}

/**
 * Start debug polling - logs Spotify activity every 5 seconds
 */
function startDebugPolling() {
    if (!isReady) {
        console.log('⚠️ Discord not ready yet, waiting...');
        setTimeout(startDebugPolling, 2000);
        return;
    }

    console.log('🎵 [DEBUG] Starting Spotify polling every 5 seconds...');

    const poll = async () => {
        const spotify = await getSpotifyActivity();

        if (spotify.error) {
            console.log(`🎵 [DEBUG] Error: ${spotify.error}`);
        } else if (spotify.notPlaying) {
            console.log('🎵 [DEBUG] Pas de musique en cours');
        } else {
            console.log(`🎵 [DEBUG] ${spotify.song} - ${spotify.artist} (${spotify.album || 'N/A'})`);
        }
    };

    poll(); // Initial poll
    setInterval(poll, 5000);
}

module.exports = {
    initDiscordClient,
    getSpotifyActivity,
    isDiscordReady,
    startDebugPolling
};
