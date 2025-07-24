import type * as THREE from 'three'

export interface CS2Skin {
  id: string
  name: string
  description: string
  weapon: {
    id: string
    name: string
  }
  category: {
    id: string
    name: string
  }
  pattern: {
    id: string
    name: string
  }
  min_float: number
  max_float: number
  rarity: {
    id: string
    name: string
    color: string
  }
  stattrak: boolean
  souvenir: boolean
  image: string
  team: {
    id: string
    name: string
  } | null
  crates: Array<{
    id: string
    name: string
    image: string
  }>
  collections: Array<{
    id: string
    name: string
    image: string
  }>
}

export interface GameCard {
  id: number
  value: string
  skin: CS2Skin
  isFlipped: boolean
  isMatched: boolean
  mesh?: THREE.Mesh
  frontTexture?: THREE.Texture
  backTexture?: THREE.Texture
}

export interface GameStats {
  moves: number
  matches: number
  gameTime: number
}

export interface GameState {
  cards: GameCard[]
  flippedCards: GameCard[]
  isGameLocked: boolean
  isLoading: boolean
  gameReady: boolean
  stats: GameStats
}

export interface CS2ApiResponse {
  success: boolean
  data?: CS2Skin[]
  cached?: boolean
  timestamp?: number
  total_available?: number
  error?: string
  message?: string
}
