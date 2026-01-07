/**
 * Admin Routes - Protected admin API endpoints
 */

const express = require('express');

let query, requireAdmin, getSession, getAuthorizedUsers, getSuperAdmins, updateAuthorizedUsers, getSessionStatus, startSession, stopSession;

function createRouter(deps) {
    query = deps.query;
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
            const streams = await query(`
                SELECT COUNT(*) as total_streams,
                       SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 3600) as total_hours,
                       MAX(peak_viewers) as all_time_peak,
                       SUM(total_chatters) as total_unique_chatters
                FROM twitch_streams
            `);

            const recentStreams = await query(`
                SELECT id, title, game_name, started_at, ended_at, peak_viewers, total_chatters
                FROM twitch_streams
                ORDER BY started_at DESC
                LIMIT 5
            `);

            const stats = streams.rows[0] || {};

            res.json({
                totalStreams: parseInt(stats.total_streams) || 0,
                totalHours: Math.round(parseFloat(stats.total_hours) || 0),
                allTimePeak: parseInt(stats.all_time_peak) || 0,
                totalUniqueChatters: parseInt(stats.total_unique_chatters) || 0,
                recentStreams: recentStreams.rows
            });
        } catch (error) {
            console.error('Admin stream stats error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Get records from database
    router.get('/records', requireAdmin, async (req, res) => {
        try {
            const result = await query(`
                SELECT lang, record_type, value, month, updated_at
                FROM streamer_records
                ORDER BY lang, record_type
            `);

            const records = {
                fr: { alltime: null, monthly: null, monthlyPeriod: null },
                en: { alltime: null, monthly: null, monthlyPeriod: null }
            };

            for (const row of result.rows) {
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

            const currentRecords = await query(`
                SELECT record_type, value FROM streamer_records
                WHERE lang = $1
            `, [lang]);

            let currentAlltime = null;
            let currentMonthly = null;

            for (const row of currentRecords.rows) {
                if (row.record_type === 'alltime') currentAlltime = row.value;
                if (row.record_type === 'monthly') currentMonthly = row.value;
            }

            const updates = [];

            if (currentAlltime === null || newValue < currentAlltime) {
                const updateResult = await query(`
                    UPDATE streamer_records 
                    SET value = $2, updated_at = NOW()
                    WHERE lang = $1 AND record_type = 'alltime'
                `, [lang, newValue]);

                if (updateResult.rowCount === 0) {
                    await query(`
                        INSERT INTO streamer_records (lang, record_type, value, updated_at)
                        VALUES ($1, 'alltime', $2, NOW())
                    `, [lang, newValue]);
                }
                updates.push({ type: 'alltime', old: currentAlltime, new: newValue });
            }

            if (currentMonthly === null || newValue < currentMonthly) {
                const updateResult = await query(`
                    UPDATE streamer_records 
                    SET value = $2, month = $3, updated_at = NOW()
                    WHERE lang = $1 AND record_type = 'monthly'
                `, [lang, newValue, currentMonth]);

                if (updateResult.rowCount === 0) {
                    await query(`
                        INSERT INTO streamer_records (lang, record_type, value, month, updated_at)
                        VALUES ($1, 'monthly', $2, $3, NOW())
                    `, [lang, newValue, currentMonth]);
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
            // Get users from database for accurate data
            const result = await query('SELECT username, is_super_admin FROM authorized_users ORDER BY is_super_admin DESC, username');
            const users = result.rows.map(r => r.username);
            const superAdmins = result.rows.filter(r => r.is_super_admin).map(r => r.username);

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

            // Insert into database
            await query(
                'INSERT INTO authorized_users (username, is_super_admin) VALUES ($1, FALSE) ON CONFLICT (username) DO NOTHING',
                [lowerUsername]
            );

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
            const checkResult = await query('SELECT is_super_admin FROM authorized_users WHERE username = $1', [username]);
            if (checkResult.rows[0]?.is_super_admin) {
                return res.status(400).json({ error: 'Impossible de supprimer un super admin' });
            }

            // Delete from database
            await query('DELETE FROM authorized_users WHERE username = $1 AND is_super_admin = FALSE', [username]);

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
