/**
 * Test Planning Image — Generate a sample PNG locally
 *
 * Usage:
 *   node test-planning-image.js              → sample data
 *   node test-planning-image.js --empty      → empty planning
 *   node test-planning-image.js --full       → all 7 days
 *
 * Output: test-planning-output.png (opens automatically on Windows)
 */

const { generatePlanningImage } = require('./planning-image');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PRESETS = {
    sample: [
        { dayIndex: 0, time: '22h', endTime: '2h', game: 'Just Chatting', note: null },
        { dayIndex: 2, time: '21h', endTime: '1h', game: 'Genshin Impact', note: null },
        { dayIndex: 3, time: '22h', endTime: '3h', game: 'Valorant', note: 'Ranked grind' },
        { dayIndex: 5, time: '20h', endTime: '0h30', game: 'Soirée chill', note: 'Avec viewers !' },
    ],
    full: [
        { dayIndex: 0, time: '22h', endTime: '2h', game: 'Just Chatting', note: null },
        { dayIndex: 1, time: '21h', endTime: '1h', game: 'Genshin Impact', note: null },
        { dayIndex: 2, time: '22h', endTime: '2h', game: 'Valorant', note: null },
        { dayIndex: 3, time: '20h', endTime: '0h', game: 'Minecraft', note: 'Build session' },
        { dayIndex: 4, time: '22h', endTime: '3h', game: 'League of Legends', note: null },
        { dayIndex: 5, time: '18h', endTime: '0h', game: 'Soirée spéciale', note: 'Anniv stream !' },
        { dayIndex: 6, time: '15h', endTime: '20h', game: 'Just Chatting', note: 'Chill dimanche' },
    ],
    empty: [],
};

const arg = process.argv[2]?.replace('--', '') || 'sample';
const streams = PRESETS[arg] || PRESETS.sample;

async function run() {
    console.log(`🎨 Generating planning image (preset: ${arg}, ${streams.length} streams)...`);

    const buf = await generatePlanningImage(streams);
    const outPath = path.join(__dirname, 'test-planning-output.png');
    fs.writeFileSync(outPath, buf);

    console.log(`✅ Image saved to: ${outPath}`);
    console.log(`   Size: ${(buf.length / 1024).toFixed(1)} KB`);

    // Auto-open on Windows
    exec(`start "" "${outPath}"`);
}

run().catch((error) => {
    console.error('❌ Failed to generate test planning image:', error);
    process.exit(1);
});
