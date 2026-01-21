'use client'

import { useState, useMemo, useEffect } from 'react'
import { GENSHIN_CHARACTERS, GenshinCharacter, GenshinElement, GenshinWeapon, GenshinRegion, getCharacterIconUrl, ELEMENT_COLORS } from '@/data/genshin-characters'
import { ELEMENT_ICONS, WEAPON_ICONS, REGION_ICONS } from '@/data/genshin-icons'

const styles = `
    .gwenshin-container {
        max-width: 900px;
        margin: 0 auto;
    }
    .search-container {
        position: relative;
        margin-bottom: 1.5rem;
    }
    .search-input {
        width: 100%;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        border: 2px solid var(--border-color);
        background: var(--bg-card);
        color: var(--text-primary);
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }
    .search-input:focus {
        border-color: var(--pink-accent);
    }
    .autocomplete-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        margin-top: 4px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 100;
    }
    .autocomplete-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: background 0.15s;
    }
    .autocomplete-item:hover {
        background: var(--bg-input);
    }
    .autocomplete-item img {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
    }
    .guess-row {
        display: grid;
        grid-template-columns: 70px repeat(5, 1fr);
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .guess-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border-radius: 10px;
        background: var(--bg-card);
        border: 2px solid var(--border-color);
        min-height: 70px;
        opacity: 0;
        transform: rotateY(90deg);
    }
    .guess-cell.revealed {
        animation: flipReveal 0.5s ease forwards;
    }
    .guess-cell.correct {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border-color: #15803d;
    }
    .guess-cell.header {
        background: transparent;
        border: none;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        opacity: 1;
        transform: none;
        min-height: 30px;
    }
    @keyframes flipReveal {
        0% { opacity: 0; transform: rotateY(90deg); }
        50% { opacity: 1; }
        100% { opacity: 1; transform: rotateY(0deg); }
    }
    .character-avatar {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        object-fit: cover;
    }
    .icon-img {
        width: 36px;
        height: 36px;
        object-fit: contain;
    }
    .cell-label {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.8);
        margin-top: 2px;
        text-align: center;
    }
    .collected-info {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
    }
    .collected-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        color: white;
    }
    .collected-item img {
        width: 18px;
        height: 18px;
    }
    .victory-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    .victory-content {
        background: var(--bg-card);
        border-radius: 20px;
        padding: 2rem;
        text-align: center;
        max-width: 400px;
        width: 90%;
        animation: scaleIn 0.4s ease;
    }
    @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    .victory-character {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        margin: 0 auto 1rem;
        border: 4px solid var(--pink-accent);
    }
    .star-icon {
        width: 18px;
        height: 18px;
    }
    @media (max-width: 768px) {
        .guess-row {
            grid-template-columns: 55px repeat(5, 1fr);
            gap: 0.25rem;
        }
        .guess-cell {
            padding: 0.4rem 0.2rem;
            min-height: 60px;
        }
        .character-avatar {
            width: 40px;
            height: 40px;
        }
        .icon-img {
            width: 28px;
            height: 28px;
        }
        .cell-label {
            font-size: 0.55rem;
        }
    }
`

// Star icon for rarity
const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? '#FFD700' : '#555'} className="star-icon">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
)

interface Guess {
    character: GenshinCharacter
    results: {
        name: boolean
        element: boolean
        weapon: boolean
        region: boolean
        rarity: boolean
        version: boolean
    }
    versionDirection: 'correct' | 'earlier' | 'later'
}

export default function GwenshinPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [guesses, setGuesses] = useState<Guess[]>([])
    const [gameWon, setGameWon] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set())
    const [isLoaded, setIsLoaded] = useState(false)

    // Get today's date key for localStorage
    const getTodayKey = () => {
        const today = new Date()
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    }

    // Get today's character
    const todayCharacter = useMemo(() => {
        const today = new Date()
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
        const index = seed % GENSHIN_CHARACTERS.length
        return GENSHIN_CHARACTERS[index]
    }, [])

    // Load saved game state on mount
    useEffect(() => {
        const savedData = localStorage.getItem('gwenshin-game-v2')
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData)
                // Check if saved data is from today
                if (parsed.date === getTodayKey()) {
                    setGuesses(parsed.guesses || [])
                    setGameWon(parsed.gameWon || false)
                    // Reveal all cells for loaded guesses
                    const allCells = new Set<string>()
                    parsed.guesses?.forEach((_: Guess, i: number) => {
                        ['name', 'element', 'weapon', 'region', 'rarity', 'version'].forEach(type => {
                            allCells.add(`${i}-${type}`)
                        })
                    })
                    setRevealedCells(allCells)
                } else {
                    // Clear old data
                    localStorage.removeItem('gwenshin-game-v2')
                }
            } catch (e) {
                localStorage.removeItem('gwenshin-game-v2')
            }
        }
        setIsLoaded(true)
    }, [])

    // Save game state when guesses or gameWon changes
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('gwenshin-game-v2', JSON.stringify({
                date: getTodayKey(),
                guesses,
                gameWon
            }))
        }
    }, [guesses, gameWon, isLoaded])

    // Collected info (all correct guesses)
    const collectedInfo = useMemo(() => {
        const info: { element?: GenshinElement; weapon?: GenshinWeapon; region?: GenshinRegion; rarity?: number; version?: string } = {}
        for (const guess of guesses) {
            if (guess.results.element) info.element = guess.character.element
            if (guess.results.weapon) info.weapon = guess.character.weapon
            if (guess.results.region) info.region = guess.character.region
            if (guess.results.rarity) info.rarity = guess.character.rarity
            if (guess.results.version) info.version = guess.character.version
        }
        return info
    }, [guesses])

    // Filter characters for autocomplete
    const filteredCharacters = useMemo(() => {
        if (!searchTerm.trim()) return []
        const term = searchTerm.toLowerCase()
        const guessedIds = new Set(guesses.map(g => g.character.id))
        return GENSHIN_CHARACTERS
            .filter(c => c.name.toLowerCase().includes(term) && !guessedIds.has(c.id))
            .slice(0, 8)
    }, [searchTerm, guesses])

    // Compare versions
    const compareVersions = (guessVersion: string, targetVersion: string): 'correct' | 'earlier' | 'later' => {
        const [gMajor, gMinor] = guessVersion.split('.').map(Number)
        const [tMajor, tMinor] = targetVersion.split('.').map(Number)
        if (gMajor === tMajor && gMinor === tMinor) return 'correct'
        if (gMajor < tMajor || (gMajor === tMajor && gMinor < tMinor)) return 'later'
        return 'earlier'
    }

    // Make a guess
    const makeGuess = (character: GenshinCharacter) => {
        const versionDir = compareVersions(character.version, todayCharacter.version)
        const results = {
            name: character.id === todayCharacter.id,
            element: character.element === todayCharacter.element,
            weapon: character.weapon === todayCharacter.weapon,
            region: character.region === todayCharacter.region,
            rarity: character.rarity === todayCharacter.rarity,
            version: versionDir === 'correct'
        }

        const guessIndex = guesses.length
        setGuesses(prev => [{ character, results, versionDirection: versionDir }, ...prev])
        setSearchTerm('')
        setShowDropdown(false)

        // Reveal cells one by one
        const cellTypes = ['name', 'element', 'weapon', 'region', 'rarity', 'version']
        cellTypes.forEach((type, i) => {
            setTimeout(() => {
                setRevealedCells(prev => new Set([...prev, `${guessIndex}-${type}`]))
            }, i * 200)
        })

        if (character.id === todayCharacter.id) {
            setTimeout(() => setGameWon(true), cellTypes.length * 200 + 500)
        }
    }

    return (
        <>
            <style>{styles}</style>
            <div className="gwenshin-container animate-slideIn">
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--pink-accent)" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                        <circle cx="12" cy="12" r="4" />
                    </svg>
                    Gwenshin
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Devine le personnage Genshin du jour !
                </p>

                {/* Collected Info Summary */}
                {Object.keys(collectedInfo).length > 0 && (
                    <div className="collected-info">
                        {collectedInfo.element && (
                            <div className="collected-item">
                                <img src={ELEMENT_ICONS[collectedInfo.element]} alt={collectedInfo.element} />
                                {collectedInfo.element}
                            </div>
                        )}
                        {collectedInfo.weapon && (
                            <div className="collected-item">
                                <img src={WEAPON_ICONS[collectedInfo.weapon]} alt={collectedInfo.weapon} />
                                {collectedInfo.weapon}
                            </div>
                        )}
                        {collectedInfo.region && (
                            <div className="collected-item">
                                <img src={REGION_ICONS[collectedInfo.region]} alt={collectedInfo.region} />
                                {collectedInfo.region}
                            </div>
                        )}
                        {collectedInfo.rarity && (
                            <div className="collected-item">
                                {[...Array(collectedInfo.rarity)].map((_, i) => (
                                    <StarIcon key={i} filled={true} />
                                ))}
                            </div>
                        )}
                        {collectedInfo.version && (
                            <div className="collected-item">
                                v{collectedInfo.version}
                            </div>
                        )}
                    </div>
                )}

                {/* Search */}
                {!gameWon && (
                    <div className="search-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Tape le nom d'un personnage..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true) }}
                            onFocus={() => setShowDropdown(true)}
                        />
                        {showDropdown && filteredCharacters.length > 0 && (
                            <div className="autocomplete-dropdown">
                                {filteredCharacters.map(char => (
                                    <div
                                        key={char.id}
                                        className="autocomplete-item"
                                        onClick={() => makeGuess(char)}
                                    >
                                        <img src={getCharacterIconUrl(char.icon)} alt={char.name} />
                                        <span style={{ fontWeight: 500 }}>{char.name}</span>
                                        <img src={ELEMENT_ICONS[char.element]} alt={char.element} style={{ width: '20px', height: '20px', marginLeft: 'auto' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Guess count */}
                {guesses.length > 0 && (
                    <p style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                        {guesses.length} essai{guesses.length > 1 ? 's' : ''}
                    </p>
                )}

                {/* Guesses Grid */}
                {guesses.length > 0 && (
                    <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
                        {/* Header */}
                        <div className="guess-row">
                            <div className="guess-cell header">Perso</div>
                            <div className="guess-cell header">Vision</div>
                            <div className="guess-cell header">Arme</div>
                            <div className="guess-cell header">Région</div>
                            <div className="guess-cell header">Rareté</div>
                            <div className="guess-cell header">Version</div>
                        </div>

                        {/* Guesses */}
                        {guesses.map((guess, rowIndex) => {
                            const actualIndex = guesses.length - 1 - rowIndex
                            return (
                                <div key={rowIndex} className="guess-row">
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-name`) ? 'revealed' : ''} ${guess.results.name ? 'correct' : ''}`}>
                                        <img
                                            src={getCharacterIconUrl(guess.character.icon)}
                                            alt={guess.character.name}
                                            className="character-avatar"
                                        />
                                    </div>
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-element`) ? 'revealed' : ''} ${guess.results.element ? 'correct' : ''}`}>
                                        <img src={ELEMENT_ICONS[guess.character.element]} alt={guess.character.element} className="icon-img" />
                                        <span className="cell-label">{guess.character.element}</span>
                                    </div>
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-weapon`) ? 'revealed' : ''} ${guess.results.weapon ? 'correct' : ''}`}>
                                        <img src={WEAPON_ICONS[guess.character.weapon]} alt={guess.character.weapon} className="icon-img" />
                                        <span className="cell-label">{guess.character.weapon}</span>
                                    </div>
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-region`) ? 'revealed' : ''} ${guess.results.region ? 'correct' : ''}`}>
                                        <img src={REGION_ICONS[guess.character.region]} alt={guess.character.region} className="icon-img" />
                                        <span className="cell-label">{guess.character.region}</span>
                                    </div>
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-rarity`) ? 'revealed' : ''} ${guess.results.rarity ? 'correct' : ''}`}>
                                        <div style={{ display: 'flex', gap: '1px' }}>
                                            {[...Array(guess.character.rarity)].map((_, i) => (
                                                <StarIcon key={i} filled={true} />
                                            ))}
                                        </div>
                                        <span className="cell-label">{guess.character.rarity} étoiles</span>
                                    </div>
                                    <div className={`guess-cell ${revealedCells.has(`${actualIndex}-version`) ? 'revealed' : ''} ${guess.results.version ? 'correct' : ''}`}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{guess.character.version}</span>
                                            {!guess.results.version && (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: '16px', height: '16px' }}>
                                                    {guess.versionDirection === 'later' ? (
                                                        <path d="M12 5v14M5 12l7 7 7-7" />
                                                    ) : (
                                                        <path d="M12 19V5M5 12l7-7 7 7" />
                                                    )}
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Empty state */}
                {guesses.length === 0 && !gameWon && (
                    <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ width: '64px', height: '64px', margin: '0 auto 1rem', opacity: 0.5 }}>
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Commence à taper le nom d'un personnage pour deviner !
                        </p>
                    </div>
                )}

                {/* Legend */}
                <div className="glass-card" style={{ padding: '1rem', marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Légende</h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '20px', height: '20px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '4px' }}></div>
                            <span>Correct</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '20px', height: '20px', background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: '4px' }}></div>
                            <span>Incorrect</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Victory Modal */}
            {gameWon && (
                <div className="victory-modal">
                    <div className="victory-content">
                        <img
                            src={getCharacterIconUrl(todayCharacter.icon)}
                            alt={todayCharacter.name}
                            className="victory-character"
                        />
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                            Bravo !
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Tu as trouvé <strong style={{ color: ELEMENT_COLORS[todayCharacter.element] }}>{todayCharacter.name}</strong> en {guesses.length} essai{guesses.length > 1 ? 's' : ''} !
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <img src={ELEMENT_ICONS[todayCharacter.element]} alt={todayCharacter.element} style={{ width: '32px', height: '32px' }} />
                            <img src={WEAPON_ICONS[todayCharacter.weapon]} alt={todayCharacter.weapon} style={{ width: '32px', height: '32px' }} />
                            <img src={REGION_ICONS[todayCharacter.region]} alt={todayCharacter.region} style={{ width: '32px', height: '32px' }} />
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Reviens demain pour un nouveau personnage !
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
