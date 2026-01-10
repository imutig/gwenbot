// Memory Game Types

export type MemoryMode = 'menu' | 'solo' | '1v1' | 'lobby'
export type MemoryDifficulty = 'easy' | 'hard'
export type MemoryGameStatus = 'waiting' | 'playing' | 'finished'

export interface MemoryGame {
    id: number
    mode: string
    difficulty: MemoryDifficulty
    status: MemoryGameStatus
    cards: string[]
    matched: number[]
    host_pairs: number
    challenger_pairs: number
    current_turn: 'host' | 'challenger'
    moves: number
    start_time: string | null
    end_time: string | null
    host?: { id: number; username: string }
    challenger?: { id: number; username: string }
    winner?: { id: number; username: string }
}

export interface MemoryLobby {
    id: number
    difficulty: MemoryDifficulty
    host: { id: number; username: string }
    created_at: string
}

export interface MemoryPlayer {
    id: number
    username: string
}
