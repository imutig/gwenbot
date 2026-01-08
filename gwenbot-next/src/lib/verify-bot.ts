import crypto from 'crypto'

const BOT_SECRET = process.env.BOT_SECRET || ''

interface VerificationResult {
    valid: boolean
    error?: string
}

/**
 * Verify an HMAC-signed request from the bot
 * @param body - The request body
 * @param timestamp - The x-timestamp header value
 * @param signature - The x-signature header value
 * @returns Verification result with valid flag and optional error
 */
export function verifyBotRequest(
    body: object,
    timestamp: string | null,
    signature: string | null
): VerificationResult {
    if (!BOT_SECRET) {
        return { valid: false, error: 'BOT_SECRET not configured' }
    }

    if (!timestamp || !signature) {
        return { valid: false, error: 'Missing signature headers' }
    }

    const ts = parseInt(timestamp, 10)
    if (isNaN(ts)) {
        return { valid: false, error: 'Invalid timestamp' }
    }

    // Check timestamp is not too old (60 seconds max)
    const maxAge = 60000
    if (Date.now() - ts > maxAge) {
        return { valid: false, error: 'Request expired' }
    }

    // Compute expected signature
    const message = `${ts}.${JSON.stringify(body)}`
    const expected = crypto
        .createHmac('sha256', BOT_SECRET)
        .update(message)
        .digest('hex')

    // Timing-safe comparison
    try {
        const valid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expected, 'hex')
        )
        return { valid }
    } catch {
        return { valid: false, error: 'Signature mismatch' }
    }
}

/**
 * Helper to verify request and return appropriate response
 * Use in API routes that need bot authentication
 */
export function requireBotAuth(
    body: object,
    headers: Headers
): VerificationResult {
    const timestamp = headers.get('x-timestamp')
    const signature = headers.get('x-signature')

    // Also accept legacy x-bot-secret during migration
    const legacySecret = headers.get('x-bot-secret')
    if (legacySecret === BOT_SECRET && BOT_SECRET) {
        console.warn('[Auth] Legacy x-bot-secret used - please migrate to HMAC')
        return { valid: true }
    }

    return verifyBotRequest(body, timestamp, signature)
}
