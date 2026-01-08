// Test similarity with new Word2Vec embeddings
const embeddings = require('./utils/word2vec-embeddings');
const path = require('path');

async function test() {
    await embeddings.load(path.join(__dirname, 'data', 'frWiki_no_phrase_no_postag_1000_skip_cut100.bin'));

    const testPairs = [
        ['voiture', 'roue'],
        ['voiture', 'automobile'],
        ['voiture', 'véhicule'],
        ['voiture', 'pneu'],
        ['voiture', 'maison'],
        ['chat', 'chien'],
        ['roi', 'reine'],
        ['france', 'paris'],
        ['soleil', 'lune'],
        ['homme', 'femme'],
    ];

    console.log('\n=== Test de similarité (Word2Vec Wikipedia) ===\n');

    for (const [w1, w2] of testPairs) {
        if (!embeddings.hasWord(w1)) {
            console.log(`"${w1}" non trouvé`);
            continue;
        }
        if (!embeddings.hasWord(w2)) {
            console.log(`"${w2}" non trouvé`);
            continue;
        }

        const similarity = embeddings.getSimilarity(w1, w2);
        const vec1 = embeddings.getVector(w1);
        const vec2 = embeddings.getVector(w2);
        const rawSim = embeddings.cosineSimilarity(vec1, vec2);

        console.log(`${w1} <-> ${w2}: ${similarity}/1000 (raw: ${rawSim.toFixed(4)})`);
    }
}

test();
