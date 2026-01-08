/**
 * Module pour charger et utiliser les word embeddings FastText
 * pour le jeu Cemantig (similarité sémantique)
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

class EmbeddingsManager {
    constructor() {
        this.embeddings = new Map();
        this.vectorDim = 300;
        this.loaded = false;
        this.loading = false;
    }

    /**
     * Charge le fichier d'embeddings en mémoire
     */
    async load(filePath) {
        if (this.loaded || this.loading) return;
        this.loading = true;

        const absolutePath = path.resolve(filePath);
        console.log(`[Embeddings] Chargement de ${absolutePath}...`);
        const startTime = Date.now();

        const fileStream = fs.createReadStream(absolutePath, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let isFirstLine = true;

        for await (const line of rl) {
            if (isFirstLine) {
                // Header: vocab_size vector_dim
                const parts = line.split(' ');
                this.vectorDim = parseInt(parts[1]);
                console.log(`[Embeddings] Dimension: ${this.vectorDim}`);
                isFirstLine = false;
                continue;
            }

            const parts = line.split(' ');
            const word = parts[0].toLowerCase();
            const vector = new Float32Array(this.vectorDim);

            for (let i = 0; i < this.vectorDim; i++) {
                vector[i] = parseFloat(parts[i + 1]) || 0;
            }

            this.embeddings.set(word, vector);
            lineCount++;

            if (lineCount % 25000 === 0) {
                console.log(`[Embeddings] Chargé ${lineCount} mots...`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Embeddings] Terminé ! ${this.embeddings.size} mots chargés en ${elapsed}s`);

        this.loaded = true;
        this.loading = false;
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
     * @param {string} word1 - Premier mot
     * @param {string} word2 - Deuxième mot
     * @returns {number} Score de 0 à 1000 (1000 = identique)
     */
    getSimilarity(word1, word2) {
        const w1 = word1.toLowerCase().trim();
        const w2 = word2.toLowerCase().trim();

        // Mots identiques
        if (w1 === w2) return 1000;

        const vec1 = this.getVector(w1);
        const vec2 = this.getVector(w2);

        if (!vec1 || !vec2) return -1; // Mot inconnu

        const similarity = this.cosineSimilarity(vec1, vec2);

        // Convertir de [-1, 1] à [0, 1000]
        // En pratique, les valeurs négatives sont rares
        return Math.round(Math.max(0, similarity) * 1000);
    }

    /**
     * Obtient un mot aléatoire du vocabulaire
     * Filtres: pas de chiffres, pas trop court, pas de caractères spéciaux
     */
    getRandomWord() {
        const words = Array.from(this.embeddings.keys());
        const validWords = words.filter(w =>
            w.length >= 4 &&
            w.length <= 12 &&
            /^[a-zàâäéèêëïîôùûüç]+$/.test(w) &&
            !/\d/.test(w)
        );

        const randomIndex = Math.floor(Math.random() * validWords.length);
        return validWords[randomIndex];
    }

    /**
     * Nombre de mots chargés
     */
    get size() {
        return this.embeddings.size;
    }
}

// Singleton instance
const embeddingsManager = new EmbeddingsManager();

module.exports = embeddingsManager;
