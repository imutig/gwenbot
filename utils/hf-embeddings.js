/**
 * Module pour utiliser Hugging Face sentence-transformers API
 * pour des embeddings sémantiques de haute qualité
 */

const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';

class HuggingFaceEmbeddings {
    constructor() {
        this.apiToken = process.env.HUGGINGFACE_API_TOKEN || '';
        this.cache = new Map(); // Cache embeddings to reduce API calls
        this.ready = true;
    }

    /**
     * Get embedding vector for a word/phrase
     */
    async getEmbedding(text) {
        const key = text.toLowerCase().trim();

        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            const response = await fetch(HF_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: key,
                    options: { wait_for_model: true }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('[HF Embeddings] API error:', error);
                return null;
            }

            const embedding = await response.json();

            // Cache the result
            this.cache.set(key, embedding);

            return embedding;
        } catch (error) {
            console.error('[HF Embeddings] Error:', error.message);
            return null;
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
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
     * Get similarity between two words (returns 0-1000)
     */
    async getSimilarity(word1, word2) {
        const w1 = word1.toLowerCase().trim();
        const w2 = word2.toLowerCase().trim();

        // Identical words
        if (w1 === w2) return 1000;

        // Get embeddings for both words
        const [vec1, vec2] = await Promise.all([
            this.getEmbedding(w1),
            this.getEmbedding(w2)
        ]);

        if (!vec1 || !vec2) return -1; // API error

        const similarity = this.cosineSimilarity(vec1, vec2);

        // Convert to 0-1000 scale
        // sentence-transformers gives values typically between 0.3-0.95 for related words
        return Math.round(Math.max(0, similarity) * 1000);
    }

    /**
     * Check if API is configured
     */
    isConfigured() {
        return !!this.apiToken;
    }

    /**
     * Get cache size
     */
    get cacheSize() {
        return this.cache.size;
    }
}

// Export singleton
const hfEmbeddings = new HuggingFaceEmbeddings();
module.exports = hfEmbeddings;
