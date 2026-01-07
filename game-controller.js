/**
 * Game Controller - Shared module for Cemantix game control
 * Allows both the bot and web server to control game sessions
 */

const { query } = require('./db');

// Game session state (shared between bot and server)
const gameSession = {
    active: false,
    lang: 'fr',
    sessionId: null,
    guessedWords: new Set(),
    startTime: null,
    found: false,
    winner: null,
    winningWord: null,
    playerScores: {}
};

// Get current session status
function getSessionStatus() {
    return {
        active: gameSession.active,
        lang: gameSession.lang,
        sessionId: gameSession.sessionId,
        guessCount: gameSession.guessedWords.size,
        startTime: gameSession.startTime,
        found: gameSession.found,
        winner: gameSession.winner,
        duration: gameSession.startTime ? Math.floor((Date.now() - gameSession.startTime) / 1000) : 0
    };
}

// Start a new session
async function startSession(lang = 'fr') {
    if (gameSession.active) {
        return { success: false, error: 'Une session est déjà en cours' };
    }

    try {
        const sessionResult = await query(`
            INSERT INTO game_sessions (lang, started_at)
            VALUES ($1, NOW())
            RETURNING id
        `, [lang]);

        const sessionId = sessionResult.rows[0].id;

        gameSession.active = true;
        gameSession.lang = lang;
        gameSession.sessionId = sessionId;
        gameSession.guessedWords = new Set();
        gameSession.startTime = Date.now();
        gameSession.found = false;
        gameSession.winner = null;
        gameSession.winningWord = null;
        gameSession.playerScores = {};

        const gameName = lang === 'en' ? 'Cemantle' : 'Cémantix';
        return { success: true, sessionId, gameName, lang };
    } catch (error) {
        console.error('Error starting session:', error);
        return { success: false, error: 'Erreur lors du démarrage' };
    }
}

// Stop current session
async function stopSession() {
    if (!gameSession.active) {
        return { success: false, error: 'Aucune session en cours' };
    }

    const duration = Math.floor((Date.now() - gameSession.startTime) / 1000);
    const guessCount = gameSession.guessedWords.size;
    const winner = gameSession.winner;
    const winningWord = gameSession.winningWord;
    const gameName = gameSession.lang === 'en' ? 'Cemantle' : 'Cémantix';

    try {
        await query(`
            UPDATE game_sessions
            SET ended_at = NOW(), duration = $2, guess_count = $3
            WHERE id = $1
        `, [gameSession.sessionId, duration, guessCount]);

        // Get top players
        const sortedPlayers = Object.entries(gameSession.playerScores || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Reset session state
        gameSession.active = false;
        gameSession.sessionId = null;
        gameSession.guessedWords = new Set();
        gameSession.found = false;
        gameSession.winner = null;
        gameSession.winningWord = null;
        gameSession.playerScores = {};

        return {
            success: true,
            duration,
            guessCount,
            winner,
            winningWord,
            gameName,
            topPlayers: sortedPlayers
        };
    } catch (error) {
        console.error('Error stopping session:', error);
        return { success: false, error: 'Erreur lors de l\'arrêt' };
    }
}

module.exports = {
    gameSession,
    getSessionStatus,
    startSession,
    stopSession
};
