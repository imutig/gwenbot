// Pool of fake Twitch-style usernames for ChatGuessr
// Mix of common Twitch naming patterns

export const FAKE_USERNAMES = [
    // Animal themes
    "JennieLover99",
    "ShadowFox99",
    "CosmicPanda",
    "NeonKitty",
    "PixelBunny",
    "GhostlyOwl",
    "ElectricTiger",
    "SilentRaven",
    "FrozenBear",
    "JennieLpb",
    "StealthyEagle",
    "MidnightDragon",
    "CrypticShark",
    "WildFalcon",
    "DreamyDolphin",

    // Gaming themes
    "ProGamerX",
    "NinjaStreamer",
    "GwenFan234",
    "LegendaryNoob",
    "CriticalHit",
    "RespawnKing",
    "FragMaster",
    "HeadshotHero",
    "BossSlayer",
    "LootGoblin",
    "SpeedRunner",
    "GlitchHunter",
    "AFK_Andy",
    "CrevetteMariee",
    "SaltLord",

    // Fantasy themes
    "DarkWizard",
    "FireMage99",
    "IceQueen",
    "ShadowKnight",
    "MysticElf",
    "CursedPaladin",
    "BloodHunter",
    "ManuLaDisquette",
    "DoomBringer",
    "HolyPriest",
    "YusurLaGoat",
    "DragonSlayer",
    "RuneMaster",
    "VoidWalker",
    "ChaosLord",

    // Cute/Kawaii themes
    "PinkCloud",
    "StarryDream",
    "CupcakeCutie",
    "BubbleGum",
    "SparkleFairy",
    "SweetPeach",
    "MoonlightAngel",
    "RainbowMochi",
    "FluffyUnicorn",
    "CherryBlossom",
    "CottonCandy",
    "SunshineGirl",
    "GlitterQueen",
    "DreamerHeart",
    "LovelyPetals",

    // Tech/Cyber themes
    "CyberNinja",
    "HackerMan",
    "ByteCode",
    "PixelPunk",
    "NeonGhost",
    "DigitalDemon",
    "MatrixRunner",
    "CodeBreaker",
    "SynthWave",
    "VirtualAgent",
    "BinaryBoss",
    "TechWizard",
    "CipherKing",
    "DataMiner",
    "AlgorithmX",

    // Random cool names
    "ChillVibes",
    "NightOwl",
    "StormChaser",
    "ZenMaster",
    "PhantomX",
    "BlazingFury",
    "ArcticWind",
    "SoulReaper",
    "TimeTraveler",
    "VoidWatcher",
    "DuskRider",
    "SkyPilot",
    "OceanDrifter",
    "DesertNomad",
    "JungleKing"
];

// Twitch-style username colors
export const TWITCH_COLORS = [
    "#FF0000", // Red
    "#0000FF", // Blue
    "#008000", // Green
    "#B22222", // FireBrick
    "#FF7F50", // Coral
    "#9ACD32", // YellowGreen
    "#FF4500", // OrangeRed
    "#2E8B57", // SeaGreen
    "#DAA520", // GoldenRod
    "#D2691E", // Chocolate
    "#5F9EA0", // CadetBlue
    "#1E90FF", // DodgerBlue
    "#FF69B4", // HotPink
    "#8A2BE2", // BlueViolet
    "#00FF7F", // SpringGreen
];

/**
 * Get a random subset of fake usernames
 * @param count Number of usernames needed
 * @returns Array of unique fake usernames
 */
export function getRandomFakeUsernames(count: number): string[] {
    const shuffled = [...FAKE_USERNAMES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Get a random Twitch color
 */
export function getRandomTwitchColor(): string {
    return TWITCH_COLORS[Math.floor(Math.random() * TWITCH_COLORS.length)];
}


