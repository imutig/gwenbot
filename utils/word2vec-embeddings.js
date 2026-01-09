/**
 * Module pour charger les word embeddings au format binaire word2vec
 * pour le jeu Cemantig (similarité sémantique)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// URL to download embeddings if not present (set via environment variable)
const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL || 'https://github.com/imutig/gwenbot/releases/download/v1.0.0/frWiki_no_phrase_no_postag_1000_skip_cut100.bin';

class Word2VecEmbeddings {
    constructor() {
        this.embeddings = new Map();
        this.vectorDim = 0;
        this.loaded = false;
        this.loading = false;
    }

    /**
     * Download file from URL
     */
    async downloadFile(url, destPath) {
        return new Promise((resolve, reject) => {
            console.log(`[Embeddings] Téléchargement depuis ${url}...`);
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const file = fs.createWriteStream(destPath);

            const request = (url) => {
                https.get(url, (response) => {
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        console.log(`[Embeddings] Redirection vers ${response.headers.location}`);
                        request(response.headers.location);
                        return;
                    }

                    const totalBytes = parseInt(response.headers['content-length'], 10);
                    let downloadedBytes = 0;
                    let lastLog = 0;

                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        const progress = Math.round((downloadedBytes / totalBytes) * 100);
                        if (progress >= lastLog + 10) {
                            console.log(`[Embeddings] Téléchargement: ${progress}%`);
                            lastLog = progress;
                        }
                    });

                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`[Embeddings] Téléchargement terminé (${Math.round(downloadedBytes / 1024 / 1024)} MB)`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(destPath, () => { });
                    reject(err);
                });
            };

            request(url);
        });
    }

    /**
     * Check if file is a Git LFS pointer (small text file)
     */
    isLfsPointer(filePath) {
        try {
            const stats = fs.statSync(filePath);
            // LFS pointers are typically < 200 bytes
            if (stats.size < 500) {
                const content = fs.readFileSync(filePath, 'utf8');
                return content.includes('version https://git-lfs.github.com/');
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Charge le fichier d'embeddings binaire word2vec en mémoire
     */
    async load(filePath) {
        if (this.loaded || this.loading) return;
        this.loading = true;

        const absolutePath = path.resolve(filePath);

        // Check if file needs to be downloaded
        if (!fs.existsSync(absolutePath) || this.isLfsPointer(absolutePath)) {
            if (this.isLfsPointer(absolutePath)) {
                console.log(`[Embeddings] Fichier LFS pointeur détecté, téléchargement du vrai fichier...`);
            }
            try {
                await this.downloadFile(EMBEDDINGS_URL, absolutePath);
            } catch (err) {
                console.error(`[Embeddings] Erreur de téléchargement:`, err.message);
                this.loading = false;
                throw err;
            }
        }

        console.log(`[Embeddings] Chargement de ${absolutePath}...`);
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const buffer = fs.readFileSync(absolutePath);
            let offset = 0;

            // Read header: "vocab_size vector_dim\n"
            let headerEnd = 0;
            while (buffer[headerEnd] !== 10) headerEnd++; // Find newline
            const header = buffer.slice(0, headerEnd).toString('utf8');
            const [vocabSizeStr, dimStr] = header.split(' ');
            const vocabSize = parseInt(vocabSizeStr);
            this.vectorDim = parseInt(dimStr);
            offset = headerEnd + 1;

            console.log(`[Embeddings] Vocab: ${vocabSize}, Dimension: ${this.vectorDim}`);

            let loadedCount = 0;

            // Read each word + vector
            while (offset < buffer.length && loadedCount < vocabSize) {
                // Read word until space
                let wordEnd = offset;
                while (wordEnd < buffer.length && buffer[wordEnd] !== 32 && buffer[wordEnd] !== 10) {
                    wordEnd++;
                }

                const word = buffer.slice(offset, wordEnd).toString('utf8').toLowerCase();
                offset = wordEnd + 1; // Skip space

                // Read vector (float32 array)
                const vector = new Float32Array(this.vectorDim);
                for (let i = 0; i < this.vectorDim; i++) {
                    vector[i] = buffer.readFloatLE(offset);
                    offset += 4;
                }

                // Skip potential newline
                if (buffer[offset] === 10) offset++;

                // Filter: only keep words that are pure letters (no punctuation, no numbers)
                if (/^[a-zàâäéèêëïîôùûüçœæ]+$/i.test(word)) {
                    this.embeddings.set(word, vector);
                }

                loadedCount++;
                if (loadedCount % 50000 === 0) {
                    console.log(`[Embeddings] Chargé ${loadedCount}/${vocabSize} mots...`);
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[Embeddings] Terminé ! ${this.embeddings.size} mots chargés en ${elapsed}s`);

            this.loaded = true;
            this.loading = false;
            resolve();
        });
    }

    /**
     * Vérifie si un mot existe dans le vocabulaire
     */
    hasWord(word) {
        return this.embeddings.has(word.toLowerCase());
    }

    /**
     * Obtient le vecteur d'un mot
     */
    getVector(word) {
        return this.embeddings.get(word.toLowerCase());
    }

    /**
     * Calcule la similarité cosinus entre deux vecteurs
     */
    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < this.vectorDim; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (norm1 * norm2);
    }

    /**
     * Calcule la similarité entre deux mots (retourne 0-1000)
     * Applique un scaling en racine carrée pour étirer les scores
     */
    getSimilarity(word1, word2) {
        const w1 = word1.toLowerCase().trim();
        const w2 = word2.toLowerCase().trim();

        // Mots identiques
        if (w1 === w2) return 1000;

        const vec1 = this.getVector(w1);
        const vec2 = this.getVector(w2);

        if (!vec1 || !vec2) return -1;

        const rawSimilarity = this.cosineSimilarity(vec1, vec2);

        // Aggressive scaling: normalize by ~0.6 max expected, then sqrt
        // This pushes high similarities (0.5+) into the 900+ range
        // raw 0.55 → 957, raw 0.50 → 913, raw 0.35 → 764, raw 0.15 → 500
        const normalized = Math.min(1, Math.max(0, rawSimilarity) / 0.6);
        const scaledSimilarity = Math.sqrt(normalized);
        return Math.min(999, Math.round(scaledSimilarity * 1000));
    }

    /**
     * Obtient un mot aléatoire du vocabulaire
     */
    getRandomWord() {
        const words = Array.from(this.embeddings.keys());
        const validWords = words.filter(w =>
            w.length >= 4 &&
            w.length <= 12 &&
            /^[a-zàâäéèêëïîôùûüçœæ]+$/.test(w)
        );

        const randomIndex = Math.floor(Math.random() * validWords.length);
        return validWords[randomIndex];
    }

    /**
     * Trouve des mots similaires à un mot donné
     * @param {string} word - Le mot cible
     * @param {number} count - Nombre de mots à retourner
     * @param {number} minSimilarity - Similarité minimum (0-1000)
     * @param {number} maxSimilarity - Similarité maximum (0-1000) pour éviter les mots trop proches
     * @returns {Array<{word: string, similarity: number}>}
     */
    getSimilarWords(word, count = 5, minSimilarity = 400, maxSimilarity = 850) {
        const targetWord = word.toLowerCase().trim();
        const targetVec = this.getVector(targetWord);

        if (!targetVec) return [];

        const similarities = [];

        for (const [w] of this.embeddings.entries()) {
            // Skip the target word itself and words too short/long
            if (w === targetWord) continue;
            if (w.length < 4 || w.length > 12) continue;
            if (!/^[a-zàâäéèêëïîôùûüçœæ]+$/.test(w)) continue;

            const similarity = this.getSimilarity(targetWord, w);

            // Only include words in the desired range
            if (similarity >= minSimilarity && similarity <= maxSimilarity) {
                similarities.push({ word: w, similarity });
            }
        }

        // Sort by similarity (descending) and take top N
        similarities.sort((a, b) => b.similarity - a.similarity);
        return similarities.slice(0, count);
    }

    /**
     * Obtient un indice aléatoire pour un mot (mot similaire)
     * @param {string} word - Le mot secret
     * @returns {{word: string, similarity: number} | null}
     */
    getHint(word) {
        const similarWords = this.getSimilarWords(word, 20, 500, 800);
        if (similarWords.length === 0) return null;

        // Pick a random one from the similar words
        const randomIndex = Math.floor(Math.random() * Math.min(similarWords.length, 10));
        return similarWords[randomIndex];
    }

    get size() {
        return this.embeddings.size;
    }
}

// Singleton instance
const word2vecEmbeddings = new Word2VecEmbeddings();
module.exports = word2vecEmbeddings;

