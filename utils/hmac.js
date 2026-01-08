const crypto = require('crypto');

/**
 * HMAC signing utility for bot-to-API communication
 * Replaces plain x-bot-secret header with cryptographically signed requests
 */

/**
 * Sign a request payload with HMAC-SHA256
 * @param {object} payload - The request body to sign
 * @param {string} secret - The shared secret (BOT_SECRET)
 * @returns {{ timestamp: number, signature: string }}
 */
function signRequest(payload, secret) {
    const timestamp = Date.now();
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    return { timestamp, signature };
}

/**
 * Verify an HMAC signature
 * @param {object} body - The request body that was signed
 * @param {string|number} timestamp - The timestamp from the request header
 * @param {string} signature - The signature from the request header
 * @param {string} secret - The shared secret (BOT_SECRET)
 * @param {number} maxAgeMs - Maximum age of the request in milliseconds (default: 60 seconds)
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(body, timestamp, signature, secret, maxAgeMs = 60000) {
    // Check that timestamp is not too old (prevents replay attacks)
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(ts) || Date.now() - ts > maxAgeMs) {
        console.warn('[HMAC] Request timestamp too old or invalid:', timestamp);
        return false;
    }

    // Compute expected signature
    const message = `${ts}.${JSON.stringify(body)}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expected, 'hex')
        );
    } catch {
        // If buffers have different lengths, timingSafeEqual throws
        return false;
    }
}

module.exports = { signRequest, verifySignature };
