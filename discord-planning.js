/**
 * Discord Planning Module — Interactive Components V2
 *
 * Single `/planning` command opens an interactive panel:
 *   Image preview + buttons → select menus → modals
 *
 * Flow:
 *   /planning          → Panel (image + ➕ Ajouter · 🗑️ Retirer · 🧹 Vider · 📌 Publier)
 *   ➕ Ajouter         → Day select menu → Modal (heure, fin, jeu, note) → refresh panel
 *   🗑️ Retirer         → Day select menu (only days with streams) → refresh panel
 *   🧹 Vider           → Confirmation buttons → refresh panel
 *   📌 Publier         → Posts/edits the image in the public planning channel
 */

const {
    SlashCommandBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');

const { supabase } = require('./db');
const {
    generatePlanningImage,
    getCurrentWeekMonday,
    DAY_NAMES_FULL,
} = require('./planning-image');

// Channel where the public planning image is posted
const PLANNING_CHANNEL_ID = process.env.DISCORD_PLANNING_CHANNEL_ID || null;

// ID of the last public planning message (edit instead of re-posting)
let planningMessageId = null;

// Custom ID prefixes — used for routing interactions
const ID = {
    BTN_ADD: 'plan_add',
    BTN_REMOVE: 'plan_remove',
    BTN_CLEAR: 'plan_clear',
    BTN_PUBLISH: 'plan_publish',
    BTN_CLEAR_YES: 'plan_clear_yes',
    BTN_CLEAR_NO: 'plan_clear_no',
    SELECT_ADD_DAY: 'plan_select_add_day',
    SELECT_REMOVE_DAY: 'plan_select_remove_day',
    MODAL_ADD: 'plan_modal_add_',       // + dayIndex
};

function getMissingChannelPermissions(channel) {
    if (!channel || !channel.guild || !channel.guild.members || !channel.permissionsFor) {
        return [];
    }

    const me = channel.guild.members.me;
    if (!me) return [];

    const required = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
    ];

    const missing = [];
    const perms = channel.permissionsFor(me);

    if (!perms) return ['Unknown'];
    if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push('ViewChannel');
    if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push('SendMessages');
    if (!perms.has(PermissionFlagsBits.AttachFiles)) missing.push('AttachFiles');
    if (!perms.has(PermissionFlagsBits.ReadMessageHistory)) missing.push('ReadMessageHistory');

    return missing;
}

// ==================== DATABASE HELPERS ====================

async function getWeekStreams() {
    const weekStart = getCurrentWeekMonday();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data, error } = await supabase
        .from('discord_planning')
        .select('*')
        .gte('stream_date', weekStart.toISOString().split('T')[0])
        .lte('stream_date', weekEnd.toISOString().split('T')[0])
        .order('stream_date', { ascending: true });

    if (error) {
        console.error('❌ Error fetching planning:', error);
        return [];
    }
    return data || [];
}

function rowsToStreams(rows) {
    const weekStart = getCurrentWeekMonday();
    return rows.map(row => {
        const streamDate = new Date(row.stream_date + 'T00:00:00');
        const diffDays = Math.round((streamDate - weekStart) / (1000 * 60 * 60 * 24));
        return {
            dayIndex: diffDays,
            time: row.start_time || '22h',
            endTime: row.end_time || null,
            game: row.game || null,
            note: row.note || null,
        };
    }).filter(s => s.dayIndex >= 0 && s.dayIndex <= 6);
}

async function addStream(dayIndex, time, endTime, game, note) {
    const weekStart = getCurrentWeekMonday();
    const streamDate = new Date(weekStart);
    streamDate.setDate(streamDate.getDate() + dayIndex);
    const dateStr = streamDate.toISOString().split('T')[0];

    const { error } = await supabase
        .from('discord_planning')
        .upsert({
            stream_date: dateStr,
            start_time: time,
            end_time: endTime || null,
            game: game || null,
            note: note || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'stream_date' });

    if (error) {
        console.error('❌ Error adding stream:', error);
        return false;
    }
    return true;
}

async function removeStream(dayIndex) {
    const weekStart = getCurrentWeekMonday();
    const streamDate = new Date(weekStart);
    streamDate.setDate(streamDate.getDate() + dayIndex);
    const dateStr = streamDate.toISOString().split('T')[0];

    const { error } = await supabase
        .from('discord_planning')
        .delete()
        .eq('stream_date', dateStr);

    if (error) {
        console.error('❌ Error removing stream:', error);
        return false;
    }
    return true;
}

async function clearWeek() {
    const weekStart = getCurrentWeekMonday();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { error } = await supabase
        .from('discord_planning')
        .delete()
        .gte('stream_date', weekStart.toISOString().split('T')[0])
        .lte('stream_date', weekEnd.toISOString().split('T')[0]);

    if (error) {
        console.error('❌ Error clearing week:', error);
        return false;
    }
    return true;
}

// ==================== PANEL BUILDER ====================

/**
 * Build the interactive planning panel (Components V2)
 * Returns { components, files, flags } ready for reply/editReply
 */
async function buildPlanningPanel(statusText) {
    const rows = await getWeekStreams();
    const streams = rowsToStreams(rows);
    const imageBuffer = await generatePlanningImage(streams);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'planning.png' });

    // Header
    const header = new TextDisplayBuilder()
        .setContent('# 📅 Planning de la semaine');

    // Status line (changes after each action)
    const status = new TextDisplayBuilder()
        .setContent(statusText || '-# Clique sur un bouton pour modifier le planning.');

    // Image
    const gallery = new MediaGalleryBuilder()
        .addItems(new MediaGalleryItemBuilder().setURL('attachment://planning.png'));

    // Action buttons
    const actions = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(ID.BTN_ADD)
                .setLabel('Ajouter')
                .setEmoji('➕')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(ID.BTN_REMOVE)
                .setLabel('Retirer')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(ID.BTN_CLEAR)
                .setLabel('Tout vider')
                .setEmoji('🧹')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(ID.BTN_PUBLISH)
                .setLabel('Publier')
                .setEmoji('📌')
                .setStyle(ButtonStyle.Success),
        );

    const container = new ContainerBuilder()
        .addTextDisplayComponents(header)
        .addMediaGalleryComponents(gallery)
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(status)
        .addActionRowComponents(actions);

    return {
        components: [container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
    };
}

// ==================== SLASH COMMAND ====================

function buildPlanningCommand() {
    return new SlashCommandBuilder()
        .setName('planning')
        .setDescription('Gérer le planning des streams de la semaine')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
}

/**
 * Handle `/planning` — show the interactive panel
 */
async function handlePlanningCommand(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panel = await buildPlanningPanel();
    await interaction.editReply(panel);
}

// ==================== BUTTON HANDLERS ====================

async function handleAddButton(interaction) {
    // Show a select menu to pick the day
    const select = new StringSelectMenuBuilder()
        .setCustomId(ID.SELECT_ADD_DAY)
        .setPlaceholder('Quel jour ?')
        .addOptions(
            DAY_NAMES_FULL.map((day, i) => ({
                label: day,
                value: i.toString(),
            })),
        );

    await interaction.reply({
        content: '📅 **Choisis le jour du stream :**',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveButton(interaction) {
    const rows = await getWeekStreams();
    const streams = rowsToStreams(rows);

    if (streams.length === 0) {
        await interaction.reply({
            content: '📅 Le planning est déjà vide !',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(ID.SELECT_REMOVE_DAY)
        .setPlaceholder('Quel jour retirer ?')
        .addOptions(
            streams.map(s => ({
                label: `${DAY_NAMES_FULL[s.dayIndex]} — ${s.time}${s.game ? ` (${s.game})` : ''}`,
                value: s.dayIndex.toString(),
            })),
        );

    await interaction.reply({
        content: '🗑️ **Choisis le stream à retirer :**',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
    });
}

async function handleClearButton(interaction) {
    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(ID.BTN_CLEAR_YES)
                .setLabel('Oui, tout vider')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(ID.BTN_CLEAR_NO)
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Secondary),
        );

    await interaction.reply({
        content: '⚠️ **Tu es sûr·e de vouloir vider tout le planning de la semaine ?**',
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
    });
}

async function handlePublishButton(interaction) {
    const channelId = PLANNING_CHANNEL_ID;
    if (!channelId) {
        await interaction.reply({
            content: '❌ `DISCORD_PLANNING_CHANNEL_ID` non configuré.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const channel = await interaction.client.channels.fetch(channelId);
        if (!channel) throw new Error('Channel introuvable');

        const published = await postPlanningImage(channel);
        if (!published) {
            throw new Error('Impossible de publier le planning (voir logs permissions)');
        }
        await interaction.editReply({ content: '📌 Planning publié/mis à jour dans le salon !' });
    } catch (error) {
        console.error('❌ Error publishing planning:', error);
        await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
    }
}

// ==================== SELECT MENU HANDLERS ====================

async function handleAddDaySelect(interaction) {
    const dayIndex = interaction.values[0];

    const modal = new ModalBuilder()
        .setCustomId(`${ID.MODAL_ADD}${dayIndex}`)
        .setTitle(`Stream — ${DAY_NAMES_FULL[parseInt(dayIndex)]}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('heure')
                    .setLabel('Heure de début')
                    .setPlaceholder('22h, 20h30...')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(10),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('fin')
                    .setLabel('Heure de fin (optionnel)')
                    .setPlaceholder('2h, 0h30...')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(10),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('jeu')
                    .setLabel('Jeu / Catégorie (optionnel)')
                    .setPlaceholder('Just Chatting, Genshin Impact...')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(60),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('note')
                    .setLabel('Note (optionnel)')
                    .setPlaceholder('Spécial anniversaire, collab...')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(80),
            ),
        );

    await interaction.showModal(modal);
}

async function handleRemoveDaySelect(interaction) {
    const dayIndex = parseInt(interaction.values[0]);
    await interaction.deferUpdate();

    const success = await removeStream(dayIndex);
    if (success) {
        // Refresh the original panel
        await refreshOriginalPanel(interaction, `✅ **${DAY_NAMES_FULL[dayIndex]}** retiré du planning.`);
        await interaction.editReply({ content: `✅ **${DAY_NAMES_FULL[dayIndex]}** retiré !`, components: [] });
        await autoUpdatePlanning(interaction.client);
    } else {
        await interaction.editReply({ content: '❌ Erreur lors de la suppression.', components: [] });
    }
}

// ==================== MODAL HANDLER ====================

async function handleAddModal(interaction) {
    const dayIndex = parseInt(interaction.customId.replace(ID.MODAL_ADD, ''));
    const heure = interaction.fields.getTextInputValue('heure');
    const fin = interaction.fields.getTextInputValue('fin') || null;
    const jeu = interaction.fields.getTextInputValue('jeu') || null;
    const note = interaction.fields.getTextInputValue('note') || null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const success = await addStream(dayIndex, heure, fin, jeu, note);
    if (success) {
        const dayStr = DAY_NAMES_FULL[dayIndex];
        const gameStr = jeu ? ` — *${jeu}*` : '';
        // Send a new refreshed panel as confirmation
        const panel = await buildPlanningPanel(`✅ Stream ajouté : **${dayStr}** à **${heure}**${fin ? ` → ${fin}` : ''}${gameStr}`);
        await interaction.editReply(panel);
        await autoUpdatePlanning(interaction.client);
    } else {
        await interaction.editReply({ content: '❌ Erreur lors de l\'ajout.' });
    }
}

// ==================== CONFIRMATION HANDLERS ====================

async function handleClearConfirm(interaction) {
    await interaction.deferUpdate();

    const success = await clearWeek();
    if (success) {
        await refreshOriginalPanel(interaction, '✅ Planning vidé !');
        await interaction.editReply({ content: '✅ Planning vidé !', components: [] });
        await autoUpdatePlanning(interaction.client);
    } else {
        await interaction.editReply({ content: '❌ Erreur lors du vidage.', components: [] });
    }
}

async function handleClearCancel(interaction) {
    await interaction.deferUpdate();
    await interaction.editReply({ content: '↩️ Annulé.', components: [] });
}

// ==================== PANEL REFRESH ====================

/**
 * Try to update the original /planning panel message after a data change.
 * Uses the interaction.message's reference to trace back to the slash command reply.
 */
async function refreshOriginalPanel(interaction, statusText) {
    // The panel lives on the slash command's ephemeral reply.
    // Buttons/selects that created secondary ephemeral messages can't directly edit it.
    // We auto-update the public channel instead; the user can re-run /planning for a fresh panel.
}

// ==================== PUBLIC CHANNEL ====================

async function postPlanningImage(channel) {
    try {
        const missingPerms = getMissingChannelPermissions(channel);
        if (missingPerms.length > 0) {
            throw new Error(`Permissions Discord manquantes: ${missingPerms.join(', ')}`);
        }

        const rows = await getWeekStreams();
        const streams = rowsToStreams(rows);
        const imageBuffer = await generatePlanningImage(streams);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'planning.png' });

        const messageContent = {
            content: '',
            files: [attachment],
            embeds: [],
            components: [],
        };

        // Try to edit existing message
        if (planningMessageId) {
            try {
                const existingMsg = await channel.messages.fetch(planningMessageId);
                if (existingMsg) {
                    await existingMsg.edit(messageContent);
                    console.log('📅 Planning image updated in Discord');
                    return existingMsg;
                }
            } catch {
                planningMessageId = null;
            }
        }

        // Post new message
        const msg = await channel.send(messageContent);
        planningMessageId = msg.id;

        // Persist message ID across restarts
        await supabase
            .from('counters')
            .upsert({ name: 'discord_planning_message_id', value: 0, text_value: msg.id }, { onConflict: 'name' });

        console.log('📅 Planning image posted in Discord');
        return msg;
    } catch (error) {
        console.error('❌ Error posting planning image:', error.message || error);
        return null;
    }
}

async function autoUpdatePlanning(client) {
    const channelId = PLANNING_CHANNEL_ID;
    if (!channelId || !client) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) await postPlanningImage(channel);
    } catch (error) {
        console.error('❌ Error auto-updating planning:', error);
    }
}

// ==================== STARTUP ====================

async function loadPlanningMessageId() {
    try {
        const { data } = await supabase
            .from('counters')
            .select('text_value')
            .eq('name', 'discord_planning_message_id')
            .single();

        if (data?.text_value) {
            planningMessageId = data.text_value;
            console.log(`📅 Loaded planning message ID: ${planningMessageId}`);
        }
    } catch {
        // No saved message ID yet
    }
}

// ==================== INTERACTION ROUTER ====================

/**
 * Main entry point — routes all planning-related interactions.
 * Called from discord-client.js on interactionCreate.
 * Returns true if handled, false if not a planning interaction.
 */
async function handlePlanningInteraction(interaction) {
    // Slash command
    if (interaction.isChatInputCommand() && interaction.commandName === 'planning') {
        await handlePlanningCommand(interaction);
        return true;
    }

    // Buttons
    if (interaction.isButton()) {
        switch (interaction.customId) {
            case ID.BTN_ADD:       await handleAddButton(interaction); return true;
            case ID.BTN_REMOVE:    await handleRemoveButton(interaction); return true;
            case ID.BTN_CLEAR:     await handleClearButton(interaction); return true;
            case ID.BTN_PUBLISH:   await handlePublishButton(interaction); return true;
            case ID.BTN_CLEAR_YES: await handleClearConfirm(interaction); return true;
            case ID.BTN_CLEAR_NO:  await handleClearCancel(interaction); return true;
        }
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === ID.SELECT_ADD_DAY) {
            await handleAddDaySelect(interaction);
            return true;
        }
        if (interaction.customId === ID.SELECT_REMOVE_DAY) {
            await handleRemoveDaySelect(interaction);
            return true;
        }
    }

    // Modals
    if (interaction.isModalSubmit() && interaction.customId.startsWith(ID.MODAL_ADD)) {
        await handleAddModal(interaction);
        return true;
    }

    return false;
}

module.exports = {
    buildPlanningCommand,
    handlePlanningInteraction,
    postPlanningImage,
    loadPlanningMessageId,
    autoUpdatePlanning,
    getWeekStreams,
};
