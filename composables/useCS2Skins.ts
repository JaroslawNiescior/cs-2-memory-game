import type { CS2ApiResponse, CS2Skin } from '~/types/game'

export function useCS2Skins() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const skins = ref<CS2Skin[]>([])

  const fetchRandomSkins = async (count: number = 10) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<CS2ApiResponse>('/api/csgo-skins', {
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
      isLoading.value = false
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

  const transformSkinsForGame = (skins: CS2Skin[], pairCount: number = 8) => {
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
    loading: readonly(isLoading),
    error: readonly(error),
    skins: readonly(skins),
    fetchRandomSkins,
    clearCache,
    getCacheInfo,
    transformSkinsForGame,
  }
}
