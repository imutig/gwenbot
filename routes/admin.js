/**
 * Admin Routes - Protected admin API endpoints
 */

const express = require('express');
const { supabase } = require('../db');

let requireAdmin, getSession, getAuthorizedUsers, getSuperAdmins, updateAuthorizedUsers, getSessionStatus, startSession, stopSession;

function createRouter(deps) {
    requireAdmin = deps.requireAdmin;
    getSession = deps.getSession;
    getAuthorizedUsers = deps.getAuthorizedUsers;
    getSuperAdmins = deps.getSuperAdmins;
    updateAuthorizedUsers = deps.updateAuthorizedUsers;
    getSessionStatus = deps.getSessionStatus;
    startSession = deps.startSession;
    stopSession = deps.stopSession;

    const router = express.Router();

    // Get bot config
    router.get('/config', requireAdmin, async (req, res) => {
        try {
            const emotes = ['xsgwenLove', 'xsgwenOuin', 'xsgwenWow', 'xsgwenSip', 'xsgwenLol', 'xsgwenHype', 'xsgwenHug'];
            res.json({
                emotes,
                botEnabled: true,
                cemantixEnabled: true
            });
        } catch (error) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Get stream stats
    router.get('/stream-stats', requireAdmin, async (req, res) => {
        try {
            // Get all streams for aggregation
            const { data: streams } = await supabase
                .from('twitch_streams')
                .select('id, title, game_name, started_at, ended_at, peak_viewers, total_chatters')
                .order('started_at', { ascending: false });

            // Calculate aggregates
            let totalHours = 0;
            let allTimePeak = 0;
            let totalUniqueChatters = 0;

            for (const stream of streams || []) {
                const start = new Date(stream.started_at);
                const end = stream.ended_at ? new Date(stream.ended_at) : new Date();
                totalHours += (end - start) / (1000 * 60 * 60);
                if (stream.peak_viewers > allTimePeak) allTimePeak = stream.peak_viewers;
                totalUniqueChatters += stream.total_chatters || 0;
            }

            res.json({
                totalStreams: streams?.length || 0,
                totalHours: Math.round(totalHours),
                allTimePeak,
                totalUniqueChatters,
                recentStreams: (streams || []).slice(0, 5)
            });
        } catch (error) {
            console.error('Admin stream stats error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Get records from database
    router.get('/records', requireAdmin, async (req, res) => {
        try {
            const { data: result } = await supabase
                .from('streamer_records')
                .select('lang, record_type, value, month, updated_at')
                .order('lang')
                .order('record_type');

            const records = {
                fr: { alltime: null, monthly: null, monthlyPeriod: null },
                en: { alltime: null, monthly: null, monthlyPeriod: null }
            };

            for (const row of result || []) {
                if (records[row.lang]) {
                    if (row.record_type === 'alltime') {
                        records[row.lang].alltime = row.value;
                    } else if (row.record_type === 'monthly') {
                        records[row.lang].monthly = row.value;
                        records[row.lang].monthlyPeriod = row.month;
                    }
                }
            }

            res.json(records);
        } catch (error) {
            console.error('Get records error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Submit new record
    router.post('/records', requireAdmin, async (req, res) => {
        try {
            const { lang, value } = req.body;

            if (!lang || value === undefined || isNaN(value)) {
                return res.status(400).json({ error: 'Paramètres invalides' });
            }

            const newValue = parseInt(value);
            const currentMonth = new Date().toISOString().slice(0, 7);

            const { data: currentRecords } = await supabase
                .from('streamer_records')
                .select('record_type, value')
                .eq('lang', lang);

            let currentAlltime = null;
            let currentMonthly = null;

            for (const row of currentRecords || []) {
                if (row.record_type === 'alltime') currentAlltime = row.value;
                if (row.record_type === 'monthly') currentMonthly = row.value;
            }

            const updates = [];

            if (currentAlltime === null || newValue < currentAlltime) {
                const { data: existing } = await supabase
                    .from('streamer_records')
                    .select('id')
                    .eq('lang', lang)
                    .eq('record_type', 'alltime')
                    .single();

                if (existing) {
                    await supabase
                        .from('streamer_records')
                        .update({ value: newValue, updated_at: new Date().toISOString() })
                        .eq('lang', lang)
                        .eq('record_type', 'alltime');
                } else {
                    await supabase
                        .from('streamer_records')
                        .insert({ lang, record_type: 'alltime', value: newValue, updated_at: new Date().toISOString() });
                }
                updates.push({ type: 'alltime', old: currentAlltime, new: newValue });
            }

            if (currentMonthly === null || newValue < currentMonthly) {
                const { data: existing } = await supabase
                    .from('streamer_records')
                    .select('id')
                    .eq('lang', lang)
                    .eq('record_type', 'monthly')
                    .single();

                if (existing) {
                    await supabase
                        .from('streamer_records')
                        .update({ value: newValue, month: currentMonth, updated_at: new Date().toISOString() })
                        .eq('lang', lang)
                        .eq('record_type', 'monthly');
                } else {
                    await supabase
                        .from('streamer_records')
                        .insert({ lang, record_type: 'monthly', value: newValue, month: currentMonth, updated_at: new Date().toISOString() });
                }
                updates.push({ type: 'monthly', old: currentMonthly, new: newValue, month: currentMonth });
            }

            if (updates.length > 0) {
                res.json({
                    success: true,
                    updated: true,
                    updates,
                    message: `Record(s) mis à jour !`
                });
            } else {
                res.json({
                    success: true,
                    updated: false,
                    message: `Le score ${newValue} n'est pas meilleur que les records actuels`
                });
            }
        } catch (error) {
            console.error('Update record error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Cemantix session control
    router.get('/cemantix/status', requireAdmin, async (req, res) => {
        res.json(getSessionStatus());
    });

    router.post('/cemantix/start', requireAdmin, async (req, res) => {
        const { lang } = req.body;
        const result = await startSession(lang || 'fr');
        res.json(result);
    });

    router.post('/cemantix/stop', requireAdmin, async (req, res) => {
        const result = await stopSession();
        res.json(result);
    });

    // User management
    router.get('/users', requireAdmin, async (req, res) => {
        try {
            const { data: result } = await supabase
                .from('authorized_users')
                .select('username, is_super_admin')
                .order('is_super_admin', { ascending: false })
                .order('username');

            const users = (result || []).map(r => r.username);
            const superAdmins = (result || []).filter(r => r.is_super_admin).map(r => r.username);

            const session = getSession(req);
            const userLogin = session?.user?.login?.toLowerCase();
            const isSuperAdmin = superAdmins.map(s => s.toLowerCase()).includes(userLogin);

            res.json({
                users,
                canManage: isSuperAdmin,
                superAdmins
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.post('/users', requireAdmin, async (req, res) => {
        try {
            const session = getSession(req);
            const userLogin = session?.user?.login?.toLowerCase();
            const superAdmins = getSuperAdmins();
            if (!superAdmins.includes(userLogin)) {
                return res.status(403).json({ error: 'Seul un super admin peut ajouter des utilisateurs' });
            }

            const { username } = req.body;
            if (!username) {
                return res.status(400).json({ error: 'Pseudo requis' });
            }

            const lowerUsername = username.toLowerCase().trim();

            // Insert into database (upsert)
            await supabase
                .from('authorized_users')
                .upsert({ username: lowerUsername, is_super_admin: false }, { onConflict: 'username' });

            // Update memory cache
            const currentUsers = getAuthorizedUsers();
            if (!currentUsers.includes(lowerUsername)) {
                currentUsers.push(lowerUsername);
                updateAuthorizedUsers(currentUsers);
            }

            res.json({ success: true, users: getAuthorizedUsers() });
        } catch (error) {
            console.error('Add user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    router.delete('/users/:username', requireAdmin, async (req, res) => {
        try {
            const session = getSession(req);
            const userLogin = session?.user?.login?.toLowerCase();
            const superAdmins = getSuperAdmins();
            if (!superAdmins.includes(userLogin)) {
                return res.status(403).json({ error: 'Seul un super admin peut supprimer des utilisateurs' });
            }

            const username = req.params.username.toLowerCase();

            // Check if super admin in database
            const { data: checkResult } = await supabase
                .from('authorized_users')
                .select('is_super_admin')
                .eq('username', username)
                .single();

            if (checkResult?.is_super_admin) {
                return res.status(400).json({ error: 'Impossible de supprimer un super admin' });
            }

            // Delete from database
            await supabase
                .from('authorized_users')
                .delete()
                .eq('username', username)
                .eq('is_super_admin', false);

            // Update memory cache
            const currentUsers = getAuthorizedUsers();
            const index = currentUsers.indexOf(username);
            if (index > -1) {
                currentUsers.splice(index, 1);
                updateAuthorizedUsers(currentUsers);
            }

            res.json({ success: true, users: getAuthorizedUsers() });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
}

module.exports = { createRouter };
