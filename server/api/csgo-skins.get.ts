interface CSGOSkin {
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

interface CachedData {
  allSkins: CSGOSkin[]
  timestamp: number
}

// TODO - consider using a more persistent cache solution like Redis or similar
const cache = new Map<string, CachedData>()
const CACHE_DURATION = 60 * 60 * 1000
const CSGO_API_BASE = 'https://bymykel.github.io/CSGO-API/api/en'
const ALL_SKINS_CACHE_KEY = 'all_skins'

async function fetchAllSkins(): Promise<CSGOSkin[]> {
  try {
    const response = await fetch(`${CSGO_API_BASE}/skins.json`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }
  catch (error) {
    console.error('Error fetching CS:GO skins:', error)
    throw error
  }
}

async function getCachedOrFetchAllSkins(): Promise<CSGOSkin[]> {
  const cachedData = cache.get(ALL_SKINS_CACHE_KEY)

  if (cachedData && isCacheValid(cachedData)) {
    return cachedData.allSkins
  }

  const allSkins = await fetchAllSkins()

  const newCachedData: CachedData = {
    allSkins,
    timestamp: Date.now(),
  }
  cache.set(ALL_SKINS_CACHE_KEY, newCachedData)

  return allSkins
}

function getRandomSkins(skins: CSGOSkin[], count: number = 10): CSGOSkin[] {
  const validSkins = skins.filter(skin => skin.image && skin.image.length > 0)

  const skinsByWeapon = new Map<string, CSGOSkin[]>()

  validSkins.forEach((skin: CSGOSkin) => {
    const weaponId = skin.weapon.id
    if (!skinsByWeapon.has(weaponId)) {
      skinsByWeapon.set(weaponId, [])
    }
    skinsByWeapon.get(weaponId)!.push(skin)
  })

  const uniqueWeaponSkins: CSGOSkin[] = []
  const weaponIds = Array.from(skinsByWeapon.keys())

  const shuffledWeaponIds = weaponIds.sort(() => 0.5 - Math.random())

  for (const weaponId of shuffledWeaponIds) {
    if (uniqueWeaponSkins.length >= count) {
      break
    }

    const weaponSkins = skinsByWeapon.get(weaponId)!
    const randomSkin = weaponSkins[Math.floor(Math.random() * weaponSkins.length)]
    uniqueWeaponSkins.push(randomSkin)
  }

  if (uniqueWeaponSkins.length < count) {
    const remainingCount = count - uniqueWeaponSkins.length
    const usedWeaponIds = new Set(uniqueWeaponSkins.map(skin => skin.weapon.id))

    const availableSkins = validSkins.filter(skin => !usedWeaponIds.has(skin.weapon.id))
    const shuffledRemaining = availableSkins.sort(() => 0.5 - Math.random())

    uniqueWeaponSkins.push(...shuffledRemaining.slice(0, remainingCount))
  }

  return uniqueWeaponSkins.slice(0, count)
}

function isCacheValid(cachedData: CachedData): boolean {
  return Date.now() - cachedData.timestamp < CACHE_DURATION
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const count = Number.parseInt(query.count as string) || 10

  try {
    const allSkins = await getCachedOrFetchAllSkins()

    const randomSkins = getRandomSkins(allSkins, count)

    const cachedData = cache.get(ALL_SKINS_CACHE_KEY)
    const isFromCache = cachedData && isCacheValid(cachedData)

    return {
      success: true,
      data: randomSkins,
      cached: !!isFromCache,
      timestamp: cachedData?.timestamp || Date.now(),
      total_available: allSkins.length,
      requested_count: count,
      returned_count: randomSkins.length,
    }
  }
  catch (error) {
    console.error('API Error:', error)

    return {
      success: false,
      error: 'Failed to fetch CS:GO skins',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
