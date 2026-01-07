/**
 * Sudoku Routes and WebSocket Manager
 * Handles 1v1 Sudoku games with real-time sync
 */

const express = require('express');
const router = express.Router();
const { WebSocketServer } = require('ws');
const SudokuEngine = require('../sudoku-engine');
const { query, getOrCreatePlayer } = require('../db');

// Active game state (in-memory for speed)
let currentGame = null;
let challengerQueue = [];

// WebSocket clients
const wsClients = new Map(); // Map<sessionId, {ws, user}>

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
function initWebSocket(server) {
    const wss = new WebSocketServer({ server, path: '/ws/sudoku' });

    wss.on('connection', (ws, req) => {
        console.log('🧩 Sudoku WebSocket connected');

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await handleMessage(ws, message);
            } catch (e) {
                console.error('WS message error:', e);
            }
        });

        ws.on('close', () => {
            // Remove from clients and queue
            for (const [sessionId, client] of wsClients.entries()) {
                if (client.ws === ws) {
                    wsClients.delete(sessionId);
                    // Remove from queue if in queue
                    if (client.user) {
                        challengerQueue = challengerQueue.filter(c => c.username !== client.user.display_name);
                        broadcastQueueUpdate();
                    }
                    break;
                }
            }
        });
    });

    // Heartbeat to keep connections alive
    setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    console.log('🧩 Sudoku WebSocket server initialized');
    return wss;
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(ws, message) {
    const { type, payload, sessionId, user } = message;

    switch (type) {
        case 'auth':
            // Register client with session
            wsClients.set(sessionId, { ws, user });
            // Send current game state
            ws.send(JSON.stringify({
                type: 'game_state',
                payload: getGameState(user)
            }));
            break;

        case 'join_queue':
            if (user && currentGame && currentGame.status === 'waiting' && currentGame.mode === 'multi') {
                // Add to queue if not already there and not host
                if (!challengerQueue.find(c => c.username === user.display_name) &&
                    user.display_name.toLowerCase() !== 'xsgwen') {
                    challengerQueue.push({
                        username: user.display_name,
                        joinedAt: new Date()
                    });
                    broadcastQueueUpdate();
                }
            }
            break;

        case 'leave_queue':
            if (user) {
                challengerQueue = challengerQueue.filter(c => c.username !== user.display_name);
                broadcastQueueUpdate();
            }
            break;

        case 'select_challenger':
            // Only host can select
            if (user && user.display_name.toLowerCase() === 'xsgwen' && currentGame && currentGame.status === 'waiting') {
                const { username } = payload;
                await selectChallenger(username);
            }
            break;

        case 'random_challenger':
            // Pick random from queue
            if (user && user.display_name.toLowerCase() === 'xsgwen' && currentGame && challengerQueue.length > 0) {
                const random = challengerQueue[Math.floor(Math.random() * challengerQueue.length)];
                await selectChallenger(random.username);
            }
            break;

        case 'cell_update':
            // Player updates a cell
            if (user && currentGame && currentGame.status === 'playing') {
                const { index, value } = payload;
                await updateCell(user.display_name, index, value);
            }
            break;

        case 'start_solo':
            // Host starts solo game
            if (user && user.display_name.toLowerCase() === 'xsgwen' && currentGame && currentGame.status === 'waiting') {
                await startGame();
            }
            break;
    }
}

/**
 * Create a new game
 */
async function createGame(mode, difficulty, hostId) {
    const { puzzle, solution } = SudokuEngine.generatePuzzle(difficulty);

    const result = await query(
        `INSERT INTO sudoku_games (mode, difficulty, puzzle, solution, status)
         VALUES ($1, $2, $3, $4, 'waiting')
         RETURNING id`,
        [mode, difficulty, puzzle, solution]
    );

    const gameId = result.rows[0].id;

    // Add host as player
    await query(
        `INSERT INTO sudoku_players (game_id, player_id, role, progress)
         VALUES ($1, $2, 'host', $3)`,
        [gameId, hostId, puzzle]
    );

    currentGame = {
        id: gameId,
        mode,
        difficulty,
        puzzle,
        solution,
        status: 'waiting',
        hostId,
        hostProgress: puzzle,
        challengerId: null,
        challengerProgress: null,
        startedAt: null
    };

    challengerQueue = [];
    broadcastGameState();

    return currentGame;
}

/**
 * Select a challenger from queue
 */
async function selectChallenger(username) {
    if (!currentGame) return;

    const playerId = await getOrCreatePlayer(username);

    // Add challenger to database
    await query(
        `INSERT INTO sudoku_players (game_id, player_id, role, progress)
         VALUES ($1, $2, 'challenger', $3)`,
        [currentGame.id, playerId, currentGame.puzzle]
    );

    currentGame.challengerId = playerId;
    currentGame.challengerProgress = currentGame.puzzle;
    currentGame.challengerName = username;

    // Clear queue
    challengerQueue = [];

    // Start the game
    await startGame();
}

/**
 * Start the game
 */
async function startGame() {
    if (!currentGame) return;

    currentGame.status = 'playing';
    currentGame.startedAt = new Date();

    await query(
        `UPDATE sudoku_games SET status = 'playing', started_at = NOW() WHERE id = $1`,
        [currentGame.id]
    );

    broadcastGameState();
}

/**
 * Update a cell
 */
async function updateCell(username, index, value) {
    if (!currentGame || currentGame.status !== 'playing') return;

    const isHost = username.toLowerCase() === 'xsgwen';
    const progressKey = isHost ? 'hostProgress' : 'challengerProgress';

    // Update progress
    const progress = currentGame[progressKey].split('');
    progress[index] = value.toString();
    currentGame[progressKey] = progress.join('');

    // Update database
    const playerId = await getOrCreatePlayer(username);
    const cellsFilled = SudokuEngine.countFilled(currentGame[progressKey]);

    await query(
        `UPDATE sudoku_players SET progress = $1, cells_filled = $2 WHERE game_id = $3 AND player_id = $4`,
        [currentGame[progressKey], cellsFilled, currentGame.id, playerId]
    );

    // Check if complete
    if (SudokuEngine.validateSolution(currentGame[progressKey], currentGame.solution)) {
        await finishGame(playerId, username);
    } else {
        // Broadcast progress update (not full state, just cell counts)
        broadcastProgress();
    }
}

/**
 * Finish game with winner
 */
async function finishGame(winnerId, winnerName) {
    if (!currentGame) return;

    currentGame.status = 'finished';
    currentGame.winnerId = winnerId;
    currentGame.winnerName = winnerName;

    await query(
        `UPDATE sudoku_games SET status = 'finished', finished_at = NOW(), winner_id = $1 WHERE id = $2`,
        [winnerId, currentGame.id]
    );

    await query(
        `UPDATE sudoku_players SET finished_at = NOW() WHERE game_id = $1 AND player_id = $2`,
        [currentGame.id, winnerId]
    );

    broadcastGameState();

    // Clear game after a delay
    setTimeout(() => {
        currentGame = null;
        broadcastGameState();
    }, 10000);
}

/**
 * Cancel current game
 */
async function cancelGame() {
    if (!currentGame) return;

    await query(
        `UPDATE sudoku_games SET status = 'cancelled' WHERE id = $1`,
        [currentGame.id]
    );

    currentGame = null;
    challengerQueue = [];
    broadcastGameState();
}

/**
 * Get game state for a specific user
 */
function getGameState(user) {
    if (!currentGame) {
        return { active: false };
    }

    const isHost = user && user.display_name.toLowerCase() === 'xsgwen';
    const isChallenger = user && currentGame.challengerName &&
        user.display_name.toLowerCase() === currentGame.challengerName.toLowerCase();

    return {
        active: true,
        id: currentGame.id,
        mode: currentGame.mode,
        difficulty: currentGame.difficulty,
        status: currentGame.status,
        puzzle: currentGame.puzzle,
        startedAt: currentGame.startedAt,
        isHost,
        isChallenger,
        isPlayer: isHost || isChallenger,
        // My progress (full grid)
        myProgress: isHost ? currentGame.hostProgress :
            isChallenger ? currentGame.challengerProgress : null,
        // Opponent progress (only cell count)
        opponentCells: isHost ?
            (currentGame.challengerProgress ? SudokuEngine.countFilled(currentGame.challengerProgress) : null) :
            SudokuEngine.countFilled(currentGame.hostProgress),
        opponentName: isHost ? currentGame.challengerName : 'xsgwen',
        // Queue (only for host in waiting state)
        queue: isHost && currentGame.status === 'waiting' ? challengerQueue : [],
        // Winner
        winner: currentGame.winnerName
    };
}

/**
 * Broadcast game state to all clients
 */
function broadcastGameState() {
    for (const [sessionId, client] of wsClients.entries()) {
        if (client.ws.readyState === 1) { // OPEN
            client.ws.send(JSON.stringify({
                type: 'game_state',
                payload: getGameState(client.user)
            }));
        }
    }
}

/**
 * Broadcast queue update
 */
function broadcastQueueUpdate() {
    for (const [sessionId, client] of wsClients.entries()) {
        if (client.ws.readyState === 1 && client.user) {
            const isHost = client.user.display_name.toLowerCase() === 'xsgwen';
            if (isHost) {
                client.ws.send(JSON.stringify({
                    type: 'queue_update',
                    payload: challengerQueue
                }));
            }
        }
    }
}

/**
 * Broadcast progress (cell counts only)
 */
function broadcastProgress() {
    const hostCells = currentGame ? SudokuEngine.countFilled(currentGame.hostProgress) : 0;
    const challengerCells = currentGame && currentGame.challengerProgress ?
        SudokuEngine.countFilled(currentGame.challengerProgress) : 0;

    for (const [sessionId, client] of wsClients.entries()) {
        if (client.ws.readyState === 1 && client.user) {
            const isHost = client.user.display_name.toLowerCase() === 'xsgwen';
            client.ws.send(JSON.stringify({
                type: 'progress_update',
                payload: {
                    myProgress: isHost ? currentGame.hostProgress : currentGame.challengerProgress,
                    opponentCells: isHost ? challengerCells : hostCells
                }
            }));
        }
    }
}

// === HTTP Routes ===

// Get current game status
router.get('/status', (req, res) => {
    const session = req.session || {};
    const user = session.user;
    res.json(getGameState(user));
});

// Create new game (host only)
router.post('/create', async (req, res) => {
    try {
        const session = req.session || {};
        const user = session.user;

        if (!user || user.display_name.toLowerCase() !== 'xsgwen') {
            return res.status(403).json({ error: 'Only xsgwen can create games' });
        }

        if (currentGame && currentGame.status !== 'finished') {
            return res.status(400).json({ error: 'A game is already in progress' });
        }

        const { mode, difficulty } = req.body;
        const hostId = await getOrCreatePlayer(user.display_name);
        const game = await createGame(mode || 'solo', difficulty || 'medium', hostId);

        res.json({ success: true, game: getGameState(user) });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

// Cancel game (host only)
router.post('/cancel', async (req, res) => {
    try {
        const session = req.session || {};
        const user = session.user;

        if (!user || user.display_name.toLowerCase() !== 'xsgwen') {
            return res.status(403).json({ error: 'Only xsgwen can cancel games' });
        }

        await cancelGame();
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling game:', error);
        res.status(500).json({ error: 'Failed to cancel game' });
    }
});

// Get game history
router.get('/history', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                g.id, g.mode, g.difficulty, g.status, g.created_at, g.finished_at,
                p.username as winner_name,
                (SELECT COUNT(*) FROM sudoku_players WHERE game_id = g.id) as player_count
            FROM sudoku_games g
            LEFT JOIN players p ON g.winner_id = p.id
            WHERE g.status IN ('finished', 'cancelled')
            ORDER BY g.created_at DESC
            LIMIT 20
        `);

        res.json({ history: result.rows });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get player stats
router.get('/stats/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE g.winner_id = p.id) as wins,
                COUNT(*) as games_played,
                COUNT(*) FILTER (WHERE g.mode = 'multi') as multi_games
            FROM sudoku_players sp
            JOIN players p ON sp.player_id = p.id
            JOIN sudoku_games g ON sp.game_id = g.id
            WHERE p.username = $1 AND g.status = 'finished'
        `, [username.toLowerCase()]);

        res.json(result.rows[0] || { wins: 0, games_played: 0 });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = { router, initWebSocket };
