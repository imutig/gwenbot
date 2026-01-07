/**
 * Test script for Cemantix API
 * Run with: node test-api.js
 */

const { checkWord, getDayNumber, calculatePoints } = require('./cemantix-api');

async function testAPI() {
    console.log('=== Cemantix API Test ===\n');

    // Get today's day number
    const dayFR = getDayNumber('fr');
    const dayEN = getDayNumber('en');
    console.log(`📅 Cemantix (FR) day: ${dayFR}`);
    console.log(`📅 Cemantle (EN) day: ${dayEN}\n`);

    // Test words in French
    const testWords = ['maison', 'chat', 'fondateur', 'xyz123'];

    console.log('Testing French words:\n');
    for (const word of testWords) {
        console.log(`Testing "${word}"...`);
        const result = await checkWord(word, 'fr');

        if (result.error) {
            console.log(`  ❌ Error: ${result.error}`);
        } else {
            const scorePercent = Math.round(result.score * 100);
            const points = calculatePoints(result.score, result.score >= 0.9999);
            const emoji = result.score >= 0.9999 ? '🏆' : (scorePercent >= 50 ? '🔥' : '❄️');
            console.log(`  ${emoji} Score: ${scorePercent}% | Points: ${points} | Validations: ${result.validations}`);
        }
        console.log('');

        // Small delay to not overwhelm API
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('=== Test Complete ===');
}

testAPI().catch(console.error);
