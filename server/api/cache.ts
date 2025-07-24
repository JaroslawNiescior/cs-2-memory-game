const cache = new Map()

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'DELETE') {
    cache.clear()
    return {
      success: true,
      message: 'Cache cleared successfully',
    }
  }

  if (method === 'GET') {
    const cacheInfo = Array.from(cache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      itemCount: value.allSkins?.length || value.skins?.length || 0,
      ageMinutes: Math.floor((Date.now() - value.timestamp) / 60000),
    }))

    return {
      success: true,
      cache: cacheInfo,
      totalKeys: cache.size,
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed',
  })
})
