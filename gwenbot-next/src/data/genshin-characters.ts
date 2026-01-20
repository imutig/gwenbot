// Genshin Impact Characters Data for Gwenshin Game
// Data sourced from gi.yatta.moe API

export type GenshinElement = 'Pyro' | 'Hydro' | 'Electro' | 'Cryo' | 'Anemo' | 'Geo' | 'Dendro'
export type GenshinWeapon = 'Sword' | 'Claymore' | 'Polearm' | 'Bow' | 'Catalyst'
export type GenshinRegion = 'Mondstadt' | 'Liyue' | 'Inazuma' | 'Sumeru' | 'Fontaine' | 'Natlan'
export type GenshinRarity = 4 | 5

export interface GenshinCharacter {
    id: number
    name: string
    element: GenshinElement
    weapon: GenshinWeapon
    region: GenshinRegion
    rarity: GenshinRarity
    version: string
    icon: string
}

// Element mapping from API
const elementMap: Record<string, GenshinElement> = {
    'Fire': 'Pyro',
    'Water': 'Hydro',
    'Electric': 'Electro',
    'Ice': 'Cryo',
    'Wind': 'Anemo',
    'Rock': 'Geo',
    'Grass': 'Dendro'
}

// Weapon mapping from API
const weaponMap: Record<string, GenshinWeapon> = {
    'WEAPON_SWORD_ONE_HAND': 'Sword',
    'WEAPON_CLAYMORE': 'Claymore',
    'WEAPON_POLE': 'Polearm',
    'WEAPON_BOW': 'Bow',
    'WEAPON_CATALYST': 'Catalyst'
}

// Region mapping from API
const regionMap: Record<string, GenshinRegion> = {
    'MONDSTADT': 'Mondstadt',
    'LIYUE': 'Liyue',
    'INAZUMA': 'Inazuma',
    'SUMERU': 'Sumeru',
    'FONTAINE': 'Fontaine',
    'NATLAN': 'Natlan'
}

// Version calculation from release timestamp
function getVersionFromTimestamp(timestamp: number): string {
    const releaseDate = new Date(timestamp * 1000)
    const baseDate = new Date('2020-09-28') // 1.0 release
    const daysDiff = Math.floor((releaseDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))

    // Each patch is roughly 42 days (6 weeks)
    const patchNumber = Math.floor(daysDiff / 42)
    const majorVersion = Math.floor(patchNumber / 6) + 1
    const minorVersion = patchNumber % 6

    return `${majorVersion}.${minorVersion}`
}

// All playable characters (excluding Traveler variants)
export const GENSHIN_CHARACTERS: GenshinCharacter[] = [
    // Mondstadt
    { id: 10000003, name: 'Jean', element: 'Anemo', weapon: 'Sword', region: 'Mondstadt', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Qin' },
    { id: 10000006, name: 'Lisa', element: 'Electro', weapon: 'Catalyst', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Lisa' },
    { id: 10000014, name: 'Barbara', element: 'Hydro', weapon: 'Catalyst', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Barbara' },
    { id: 10000015, name: 'Kaeya', element: 'Cryo', weapon: 'Sword', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Kaeya' },
    { id: 10000016, name: 'Diluc', element: 'Pyro', weapon: 'Claymore', region: 'Mondstadt', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Diluc' },
    { id: 10000020, name: 'Razor', element: 'Electro', weapon: 'Claymore', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Razor' },
    { id: 10000021, name: 'Amber', element: 'Pyro', weapon: 'Bow', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Ambor' },
    { id: 10000022, name: 'Venti', element: 'Anemo', weapon: 'Bow', region: 'Mondstadt', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Venti' },
    { id: 10000029, name: 'Klee', element: 'Pyro', weapon: 'Catalyst', region: 'Mondstadt', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Klee' },
    { id: 10000031, name: 'Fischl', element: 'Electro', weapon: 'Bow', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Fischl' },
    { id: 10000032, name: 'Bennett', element: 'Pyro', weapon: 'Sword', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Bennett' },
    { id: 10000034, name: 'Noelle', element: 'Geo', weapon: 'Claymore', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Noel' },
    { id: 10000038, name: 'Albedo', element: 'Geo', weapon: 'Sword', region: 'Mondstadt', rarity: 5, version: '1.2', icon: 'UI_AvatarIcon_Albedo' },
    { id: 10000039, name: 'Diona', element: 'Cryo', weapon: 'Bow', region: 'Mondstadt', rarity: 4, version: '1.1', icon: 'UI_AvatarIcon_Diona' },
    { id: 10000041, name: 'Mona', element: 'Hydro', weapon: 'Catalyst', region: 'Mondstadt', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Mona' },
    { id: 10000043, name: 'Sucrose', element: 'Anemo', weapon: 'Catalyst', region: 'Mondstadt', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Sucrose' },
    { id: 10000045, name: 'Rosaria', element: 'Cryo', weapon: 'Polearm', region: 'Mondstadt', rarity: 4, version: '1.4', icon: 'UI_AvatarIcon_Rosaria' },
    { id: 10000051, name: 'Eula', element: 'Cryo', weapon: 'Claymore', region: 'Mondstadt', rarity: 5, version: '1.5', icon: 'UI_AvatarIcon_Eula' },
    { id: 10000080, name: 'Mika', element: 'Cryo', weapon: 'Polearm', region: 'Mondstadt', rarity: 4, version: '3.5', icon: 'UI_AvatarIcon_Mika' },

    // Liyue
    { id: 10000023, name: 'Xiangling', element: 'Pyro', weapon: 'Polearm', region: 'Liyue', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Xiangling' },
    { id: 10000024, name: 'Beidou', element: 'Electro', weapon: 'Claymore', region: 'Liyue', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Beidou' },
    { id: 10000025, name: 'Xingqiu', element: 'Hydro', weapon: 'Sword', region: 'Liyue', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Xingqiu' },
    { id: 10000026, name: 'Xiao', element: 'Anemo', weapon: 'Polearm', region: 'Liyue', rarity: 5, version: '1.3', icon: 'UI_AvatarIcon_Xiao' },
    { id: 10000027, name: 'Ningguang', element: 'Geo', weapon: 'Catalyst', region: 'Liyue', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Ningguang' },
    { id: 10000030, name: 'Zhongli', element: 'Geo', weapon: 'Polearm', region: 'Liyue', rarity: 5, version: '1.1', icon: 'UI_AvatarIcon_Zhongli' },
    { id: 10000035, name: 'Qiqi', element: 'Cryo', weapon: 'Sword', region: 'Liyue', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Qiqi' },
    { id: 10000036, name: 'Chongyun', element: 'Cryo', weapon: 'Claymore', region: 'Liyue', rarity: 4, version: '1.0', icon: 'UI_AvatarIcon_Chongyun' },
    { id: 10000037, name: 'Ganyu', element: 'Cryo', weapon: 'Bow', region: 'Liyue', rarity: 5, version: '1.2', icon: 'UI_AvatarIcon_Ganyu' },
    { id: 10000042, name: 'Keqing', element: 'Electro', weapon: 'Sword', region: 'Liyue', rarity: 5, version: '1.0', icon: 'UI_AvatarIcon_Keqing' },
    { id: 10000044, name: 'Xinyan', element: 'Pyro', weapon: 'Claymore', region: 'Liyue', rarity: 4, version: '1.1', icon: 'UI_AvatarIcon_Xinyan' },
    { id: 10000046, name: 'Hu Tao', element: 'Pyro', weapon: 'Polearm', region: 'Liyue', rarity: 5, version: '1.3', icon: 'UI_AvatarIcon_Hutao' },
    { id: 10000048, name: 'Yanfei', element: 'Pyro', weapon: 'Catalyst', region: 'Liyue', rarity: 4, version: '1.5', icon: 'UI_AvatarIcon_Feiyan' },
    { id: 10000060, name: 'Yelan', element: 'Hydro', weapon: 'Bow', region: 'Liyue', rarity: 5, version: '2.7', icon: 'UI_AvatarIcon_Yelan' },
    { id: 10000063, name: 'Shenhe', element: 'Cryo', weapon: 'Polearm', region: 'Liyue', rarity: 5, version: '2.4', icon: 'UI_AvatarIcon_Shenhe' },
    { id: 10000064, name: 'Yun Jin', element: 'Geo', weapon: 'Polearm', region: 'Liyue', rarity: 4, version: '2.4', icon: 'UI_AvatarIcon_Yunjin' },
    { id: 10000077, name: 'Yaoyao', element: 'Dendro', weapon: 'Polearm', region: 'Liyue', rarity: 4, version: '3.4', icon: 'UI_AvatarIcon_Yaoyao' },
    { id: 10000082, name: 'Baizhu', element: 'Dendro', weapon: 'Catalyst', region: 'Liyue', rarity: 5, version: '3.6', icon: 'UI_AvatarIcon_Baizhuer' },
    { id: 10000092, name: 'Gaming', element: 'Pyro', weapon: 'Claymore', region: 'Liyue', rarity: 4, version: '4.4', icon: 'UI_AvatarIcon_Gaming' },
    { id: 10000093, name: 'Xianyun', element: 'Anemo', weapon: 'Catalyst', region: 'Liyue', rarity: 5, version: '4.4', icon: 'UI_AvatarIcon_Liuyun' },

    // Inazuma
    { id: 10000002, name: 'Kamisato Ayaka', element: 'Cryo', weapon: 'Sword', region: 'Inazuma', rarity: 5, version: '2.0', icon: 'UI_AvatarIcon_Ayaka' },
    { id: 10000047, name: 'Kaedehara Kazuha', element: 'Anemo', weapon: 'Sword', region: 'Inazuma', rarity: 5, version: '1.6', icon: 'UI_AvatarIcon_Kazuha' },
    { id: 10000049, name: 'Yoimiya', element: 'Pyro', weapon: 'Bow', region: 'Inazuma', rarity: 5, version: '2.0', icon: 'UI_AvatarIcon_Yoimiya' },
    { id: 10000050, name: 'Thoma', element: 'Pyro', weapon: 'Polearm', region: 'Inazuma', rarity: 4, version: '2.2', icon: 'UI_AvatarIcon_Tohma' },
    { id: 10000052, name: 'Raiden Shogun', element: 'Electro', weapon: 'Polearm', region: 'Inazuma', rarity: 5, version: '2.1', icon: 'UI_AvatarIcon_Shougun' },
    { id: 10000053, name: 'Sayu', element: 'Anemo', weapon: 'Claymore', region: 'Inazuma', rarity: 4, version: '2.0', icon: 'UI_AvatarIcon_Sayu' },
    { id: 10000054, name: 'Sangonomiya Kokomi', element: 'Hydro', weapon: 'Catalyst', region: 'Inazuma', rarity: 5, version: '2.1', icon: 'UI_AvatarIcon_Kokomi' },
    { id: 10000055, name: 'Gorou', element: 'Geo', weapon: 'Bow', region: 'Inazuma', rarity: 4, version: '2.3', icon: 'UI_AvatarIcon_Gorou' },
    { id: 10000056, name: 'Kujou Sara', element: 'Electro', weapon: 'Bow', region: 'Inazuma', rarity: 4, version: '2.1', icon: 'UI_AvatarIcon_Sara' },
    { id: 10000057, name: 'Arataki Itto', element: 'Geo', weapon: 'Claymore', region: 'Inazuma', rarity: 5, version: '2.3', icon: 'UI_AvatarIcon_Itto' },
    { id: 10000058, name: 'Yae Miko', element: 'Electro', weapon: 'Catalyst', region: 'Inazuma', rarity: 5, version: '2.5', icon: 'UI_AvatarIcon_Yae' },
    { id: 10000059, name: 'Shikanoin Heizou', element: 'Anemo', weapon: 'Catalyst', region: 'Inazuma', rarity: 4, version: '2.8', icon: 'UI_AvatarIcon_Heizo' },
    { id: 10000061, name: 'Kirara', element: 'Dendro', weapon: 'Sword', region: 'Inazuma', rarity: 4, version: '3.7', icon: 'UI_AvatarIcon_Momoka' },
    { id: 10000065, name: 'Kuki Shinobu', element: 'Electro', weapon: 'Sword', region: 'Inazuma', rarity: 4, version: '2.7', icon: 'UI_AvatarIcon_Shinobu' },
    { id: 10000066, name: 'Kamisato Ayato', element: 'Hydro', weapon: 'Sword', region: 'Inazuma', rarity: 5, version: '2.6', icon: 'UI_AvatarIcon_Ayato' },
    { id: 10000094, name: 'Chiori', element: 'Geo', weapon: 'Sword', region: 'Inazuma', rarity: 5, version: '4.5', icon: 'UI_AvatarIcon_Chiori' },

    // Sumeru
    { id: 10000067, name: 'Collei', element: 'Dendro', weapon: 'Bow', region: 'Sumeru', rarity: 4, version: '3.0', icon: 'UI_AvatarIcon_Collei' },
    { id: 10000068, name: 'Dori', element: 'Electro', weapon: 'Claymore', region: 'Sumeru', rarity: 4, version: '3.0', icon: 'UI_AvatarIcon_Dori' },
    { id: 10000069, name: 'Tighnari', element: 'Dendro', weapon: 'Bow', region: 'Sumeru', rarity: 5, version: '3.0', icon: 'UI_AvatarIcon_Tighnari' },
    { id: 10000070, name: 'Nilou', element: 'Hydro', weapon: 'Sword', region: 'Sumeru', rarity: 5, version: '3.1', icon: 'UI_AvatarIcon_Nilou' },
    { id: 10000071, name: 'Cyno', element: 'Electro', weapon: 'Polearm', region: 'Sumeru', rarity: 5, version: '3.1', icon: 'UI_AvatarIcon_Cyno' },
    { id: 10000072, name: 'Candace', element: 'Hydro', weapon: 'Polearm', region: 'Sumeru', rarity: 4, version: '3.1', icon: 'UI_AvatarIcon_Candace' },
    { id: 10000073, name: 'Nahida', element: 'Dendro', weapon: 'Catalyst', region: 'Sumeru', rarity: 5, version: '3.2', icon: 'UI_AvatarIcon_Nahida' },
    { id: 10000074, name: 'Layla', element: 'Cryo', weapon: 'Sword', region: 'Sumeru', rarity: 4, version: '3.2', icon: 'UI_AvatarIcon_Layla' },
    { id: 10000075, name: 'Wanderer', element: 'Anemo', weapon: 'Catalyst', region: 'Sumeru', rarity: 5, version: '3.3', icon: 'UI_AvatarIcon_Wanderer' },
    { id: 10000076, name: 'Faruzan', element: 'Anemo', weapon: 'Bow', region: 'Sumeru', rarity: 4, version: '3.3', icon: 'UI_AvatarIcon_Faruzan' },
    { id: 10000078, name: 'Alhaitham', element: 'Dendro', weapon: 'Sword', region: 'Sumeru', rarity: 5, version: '3.4', icon: 'UI_AvatarIcon_Alhatham' },
    { id: 10000079, name: 'Dehya', element: 'Pyro', weapon: 'Claymore', region: 'Sumeru', rarity: 5, version: '3.5', icon: 'UI_AvatarIcon_Dehya' },
    { id: 10000081, name: 'Kaveh', element: 'Dendro', weapon: 'Claymore', region: 'Sumeru', rarity: 4, version: '3.6', icon: 'UI_AvatarIcon_Kaveh' },
    { id: 10000097, name: 'Sethos', element: 'Electro', weapon: 'Bow', region: 'Sumeru', rarity: 4, version: '4.7', icon: 'UI_AvatarIcon_Sethos' },

    // Fontaine
    { id: 10000083, name: 'Lynette', element: 'Anemo', weapon: 'Sword', region: 'Fontaine', rarity: 4, version: '4.0', icon: 'UI_AvatarIcon_Linette' },
    { id: 10000084, name: 'Lyney', element: 'Pyro', weapon: 'Bow', region: 'Fontaine', rarity: 5, version: '4.0', icon: 'UI_AvatarIcon_Liney' },
    { id: 10000085, name: 'Freminet', element: 'Cryo', weapon: 'Claymore', region: 'Fontaine', rarity: 4, version: '4.0', icon: 'UI_AvatarIcon_Freminet' },
    { id: 10000086, name: 'Wriothesley', element: 'Cryo', weapon: 'Catalyst', region: 'Fontaine', rarity: 5, version: '4.1', icon: 'UI_AvatarIcon_Wriothesley' },
    { id: 10000087, name: 'Neuvillette', element: 'Hydro', weapon: 'Catalyst', region: 'Fontaine', rarity: 5, version: '4.1', icon: 'UI_AvatarIcon_Neuvillette' },
    { id: 10000088, name: 'Charlotte', element: 'Cryo', weapon: 'Catalyst', region: 'Fontaine', rarity: 4, version: '4.2', icon: 'UI_AvatarIcon_Charlotte' },
    { id: 10000089, name: 'Furina', element: 'Hydro', weapon: 'Sword', region: 'Fontaine', rarity: 5, version: '4.2', icon: 'UI_AvatarIcon_Furina' },
    { id: 10000090, name: 'Chevreuse', element: 'Pyro', weapon: 'Polearm', region: 'Fontaine', rarity: 4, version: '4.3', icon: 'UI_AvatarIcon_Chevreuse' },
    { id: 10000091, name: 'Navia', element: 'Geo', weapon: 'Claymore', region: 'Fontaine', rarity: 5, version: '4.3', icon: 'UI_AvatarIcon_Navia' },
    { id: 10000095, name: 'Sigewinne', element: 'Hydro', weapon: 'Bow', region: 'Fontaine', rarity: 5, version: '4.7', icon: 'UI_AvatarIcon_Sigewinne' },
    { id: 10000098, name: 'Clorinde', element: 'Electro', weapon: 'Sword', region: 'Fontaine', rarity: 5, version: '4.7', icon: 'UI_AvatarIcon_Clorinde' },
    { id: 10000099, name: 'Emilie', element: 'Dendro', weapon: 'Polearm', region: 'Fontaine', rarity: 5, version: '4.8', icon: 'UI_AvatarIcon_Emilie' },

    // Natlan
    { id: 10000100, name: 'Kachina', element: 'Geo', weapon: 'Polearm', region: 'Natlan', rarity: 4, version: '5.0', icon: 'UI_AvatarIcon_Kachina' },
    { id: 10000101, name: 'Kinich', element: 'Dendro', weapon: 'Claymore', region: 'Natlan', rarity: 5, version: '5.0', icon: 'UI_AvatarIcon_Kinich' },
    { id: 10000102, name: 'Mualani', element: 'Hydro', weapon: 'Catalyst', region: 'Natlan', rarity: 5, version: '5.0', icon: 'UI_AvatarIcon_Mualani' },
    { id: 10000103, name: 'Xilonen', element: 'Geo', weapon: 'Sword', region: 'Natlan', rarity: 5, version: '5.1', icon: 'UI_AvatarIcon_Xilonen' },
    { id: 10000104, name: 'Chasca', element: 'Anemo', weapon: 'Bow', region: 'Natlan', rarity: 5, version: '5.2', icon: 'UI_AvatarIcon_Chasca' },
    { id: 10000105, name: 'Ororon', element: 'Electro', weapon: 'Bow', region: 'Natlan', rarity: 4, version: '5.2', icon: 'UI_AvatarIcon_Olorun' },
    { id: 10000106, name: 'Mavuika', element: 'Pyro', weapon: 'Claymore', region: 'Natlan', rarity: 5, version: '5.3', icon: 'UI_AvatarIcon_Mavuika' },
    { id: 10000107, name: 'Citlali', element: 'Cryo', weapon: 'Catalyst', region: 'Natlan', rarity: 5, version: '5.3', icon: 'UI_AvatarIcon_Citlali' },

]

// Get character image URL
export function getCharacterIconUrl(icon: string): string {
    return `https://enka.network/ui/${icon}.png`
}

// Get today's character based on date
export function getDailyCharacter(): GenshinCharacter {
    const today = new Date()
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
    const index = seed % GENSHIN_CHARACTERS.length
    return GENSHIN_CHARACTERS[index]
}

// Element colors for styling
export const ELEMENT_COLORS: Record<GenshinElement, string> = {
    'Pyro': '#EF7938',
    'Hydro': '#4CC2F1',
    'Electro': '#AF8EC1',
    'Cryo': '#98C8E8',
    'Anemo': '#74C2A8',
    'Geo': '#F2B723',
    'Dendro': '#A5C83B'
}

// Region colors
export const REGION_COLORS: Record<GenshinRegion, string> = {
    'Mondstadt': '#5DADE2',
    'Liyue': '#F4D03F',
    'Inazuma': '#AF7AC5',
    'Sumeru': '#58D68D',
    'Fontaine': '#85C1E9',
    'Natlan': '#E74C3C'
}

export default GENSHIN_CHARACTERS
