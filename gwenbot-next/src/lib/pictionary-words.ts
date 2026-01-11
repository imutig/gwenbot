// Pictionary word bank - French words organized by category
export const wordBank = {
    animaux: [
        'chat', 'chien', 'éléphant', 'girafe', 'lion', 'serpent', 'papillon',
        'dauphin', 'requin', 'araignée', 'abeille', 'ours', 'lapin', 'tortue',
        'pingouin', 'singe', 'crocodile', 'hibou', 'aigle', 'kangourou'
    ],
    objets: [
        'voiture', 'téléphone', 'ordinateur', 'parapluie', 'lunettes', 'montre',
        'clé', 'chaise', 'table', 'lampe', 'télévision', 'réfrigérateur',
        'guitare', 'piano', 'vélo', 'avion', 'bateau', 'train', 'fusée', 'robot'
    ],
    nourriture: [
        'pizza', 'hamburger', 'spaghetti', 'croissant', 'baguette', 'fromage',
        'pomme', 'banane', 'fraise', 'glace', 'gâteau', 'chocolat', 'café',
        'sushi', 'taco', 'hot-dog', 'salade', 'soupe', 'sandwich', 'crêpe'
    ],
    actions: [
        'dormir', 'danser', 'courir', 'nager', 'voler', 'sauter', 'pleurer',
        'rire', 'chanter', 'cuisiner', 'conduire', 'lire', 'écrire', 'peindre',
        'photographier', 'jardiner', 'pêcher', 'skier', 'surfer', 'boxer'
    ],
    lieux: [
        'plage', 'montagne', 'forêt', 'désert', 'île', 'château', 'église',
        'hôpital', 'école', 'prison', 'zoo', 'cirque', 'cinéma', 'restaurant',
        'aéroport', 'gare', 'stade', 'piscine', 'parc', 'musée'
    ],
    celebrites: [
        'Pikachu', 'Mario', 'Sonic', 'Mickey Mouse', 'Batman', 'Superman',
        'Spider-Man', 'Shrek', 'Elsa', 'Buzz Lightyear', 'Darth Vader',
        'Harry Potter', 'Homer Simpson', 'Bob l\'éponge', 'Minion', 'Yoda'
    ],
    difficile: [
        'wifi', 'gravité', 'électricité', 'rêve', 'temps', 'musique',
        'photosynthèse', 'démocracy', 'nostalgie', 'karma', 'ironie',
        'évolution', 'infini', 'paradoxe', 'métamorphose', 'écho'
    ]
}

export type WordCategory = keyof typeof wordBank

// Get 3 random words from different categories
export function getRandomWordChoices(): { word: string; category: WordCategory }[] {
    const categories = Object.keys(wordBank) as WordCategory[]
    const shuffled = categories.sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 3)

    return selected.map(category => {
        const words = wordBank[category]
        const word = words[Math.floor(Math.random() * words.length)]
        return { word, category }
    })
}

// Normalize text for comparison (remove accents, lowercase)
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .trim()
}

// Check if guess matches word
export function isCorrectGuess(guess: string, secretWord: string): boolean {
    return normalizeText(guess) === normalizeText(secretWord)
}

// Calculate points based on time remaining
export function calculatePoints(timeRemainingSeconds: number, maxTimeSeconds: number = 180): number {
    const basePoints = 100
    const timeBonusMax = 50
    const timeRatio = timeRemainingSeconds / maxTimeSeconds
    const timeBonus = Math.floor(timeBonusMax * timeRatio)
    return basePoints + timeBonus
}
