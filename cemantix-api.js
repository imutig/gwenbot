/**
 * Cemantix API Service
 * Interacts with Cemantix (FR) and Cemantle (EN) APIs
 */

const CEMANTIX_BASE = 'https://cemantix.certitudes.org';
const CEMANTLE_BASE = 'https://cemantle.certitudes.org';

// Reference dates for day calculation
const CEMANTIX_START = new Date('2022-03-02');
const CEMANTLE_START = new Date('2022-04-04');

/**
 * Calculate the day number for Cemantix or Cemantle
 * @param {string} lang - 'fr' for Cemantix, 'en' for Cemantle
 * @returns {number} Day number
 */
function getDayNumber(lang = 'fr') {
    // Get current date in the appropriate timezone
    const timezone = lang === 'en' ? 'America/Los_Angeles' : 'Europe/Paris';
    const now = new Date();

    // Get date string in target timezone and parse it
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    // Reference dates
    const startDate = lang === 'en'
        ? new Date(2022, 3, 4)  // April 4, 2022 for Cemantle
        : new Date(2022, 2, 2); // March 2, 2022 for Cemantix

    const diffTime = localDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Check a word against Cemantix/Cemantle API
 * @param {string} word - The word to check
 * @param {string} lang - 'fr' or 'en'
 * @returns {Promise<{score: number|null, error: string|null, validations: number|null}>}
 */
async function checkWord(word, lang = 'fr') {
    const baseUrl = lang === 'en' ? CEMANTLE_BASE : CEMANTIX_BASE;
    const dayNumber = getDayNumber(lang);
    const url = `${baseUrl}/score?n=${dayNumber}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Origin': baseUrl,
                'Referer': `${baseUrl}/`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `word=${encodeURIComponent(word.toLowerCase().trim())}`
        });

        if (!response.ok) {
            return { score: null, error: 'API_ERROR', validations: null };
        }

        const data = await response.json();

        // Check for errors in response
        if ('r' in data) {
            return { score: null, error: 'INVALID_DAY', validations: null };
        }
        if ('e' in data) {
            return { score: null, error: 'INVALID_WORD', validations: null };
        }

        // Success - return score (0-1) and validations count
        return {
            score: parseFloat(data.s),
            error: null,
            validations: parseInt(data.v)
        };
    } catch (error) {
        console.error('Cemantix API error:', error);
        return { score: null, error: 'NETWORK_ERROR', validations: null };
    }
}

/**
 * Calculate points from a score
 * @param {number} score - Score between -1 and 1 (cosine similarity)
 * @param {boolean} isWinner - Whether this guess found the word
 * @returns {number} Points earned (0-100, or 150 for winner)
 */
function calculatePoints(score, isWinner = false) {
    // Convert to "degree" (-100 to 100)
    const degree = Math.round(score * 100);
    // Points = positive degree only (0-100)
    const basePoints = Math.max(0, degree);
    // Winner bonus: x1.5 (so 150 points max)
    return isWinner ? Math.round(basePoints * 1.5) : basePoints;
}

module.exports = {
    getDayNumber,
    checkWord,
    calculatePoints
};
