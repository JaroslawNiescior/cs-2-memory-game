interface CS2_Skin {
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

interface CSGOApiResponse {
  success: boolean
  data?: CS2_Skin[]
  cached?: boolean
  timestamp?: number
  total_available?: number
  error?: string
  message?: string
}

export function useCS2_Skins() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const skins = ref<CS2_Skin[]>([])

  const fetchRandomSkins = async (count: number = 10) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<CSGOApiResponse>('/api/csgo-skins', {
        query: { count },
      })

      if (response.success && response.data) {
        skins.value = response.data
        return response.data
      }
      else {
        error.value = response.error || 'Failed to fetch skins'
        return []
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      return []
    }
    finally {
      loading.value = false
    }
  }

  const clearCache = async () => {
    try {
      await $fetch('/api/cache', {
        method: 'DELETE',
      })
    }
    catch (err) {
      console.error('Failed to clear cache:', err)
    }
  }

  const getCacheInfo = async () => {
    try {
      return await $fetch('/api/cache')
    }
    catch (err) {
      console.error('Failed to get cache info:', err)
      return null
    }
  }

  const transformSkinsForGame = (skins: CS2_Skin[], pairCount: number = 8) => {
    const selectedSkins = skins.slice(0, pairCount)
    const pairs = [...selectedSkins, ...selectedSkins]

    return pairs
      .map((skin, index) => ({
        id: index,
        value: skin.name,
        image: skin.image,
        skin,
        isFlipped: false,
        isMatched: false,
      }))
      .sort(() => Math.random() - 0.5)
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    skins: readonly(skins),
    fetchRandomSkins,
    clearCache,
    getCacheInfo,
    transformSkinsForGame,
  }
}
