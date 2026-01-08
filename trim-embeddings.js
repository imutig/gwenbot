/**
 * Script pour trimmer le fichier FastText aux N premiers mots
 * Usage: node trim-embeddings.js
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'data', 'cc.fr.300.vec');
const OUTPUT_FILE = path.join(__dirname, 'data', 'fr-100k.vec');
const MAX_WORDS = 100000;

async function trimEmbeddings() {
    console.log(`Lecture de ${INPUT_FILE}...`);
    console.log(`Extraction des ${MAX_WORDS} premiers mots...`);

    const inputStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' });
    const outputStream = fs.createWriteStream(OUTPUT_FILE);

    const rl = readline.createInterface({
        input: inputStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let wordCount = 0;
    let headerWritten = false;

    for await (const line of rl) {
        lineCount++;

        // First line is header (vocab_size, vector_dim)
        if (lineCount === 1) {
            // Write new header with reduced vocab size
            const parts = line.split(' ');
            const vectorDim = parts[1];
            outputStream.write(`${MAX_WORDS} ${vectorDim}\n`);
            headerWritten = true;
            console.log(`Dimension des vecteurs: ${vectorDim}`);
            continue;
        }

        // Write word vectors
        outputStream.write(line + '\n');
        wordCount++;

        if (wordCount % 10000 === 0) {
            console.log(`Progression: ${wordCount}/${MAX_WORDS} mots...`);
        }

        if (wordCount >= MAX_WORDS) {
            break;
        }
    }

    outputStream.end();

    console.log(`\nTerminé !`);
    console.log(`Fichier créé: ${OUTPUT_FILE}`);
    console.log(`Mots extraits: ${wordCount}`);

    // Get file size
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Taille du fichier: ${fileSizeMB} MB`);
}

trimEmbeddings().catch(console.error);
