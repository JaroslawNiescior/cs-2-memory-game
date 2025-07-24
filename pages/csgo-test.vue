<script setup lang="ts">
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
}

interface GameCard {
  id: number
  value: string
  image: string
  skin: CSGOSkin
  isFlipped: boolean
  isMatched: boolean
}

interface CacheItem {
  key: string
  timestamp: number
  itemCount: number
  ageMinutes: number
}

interface CacheInfo {
  success: boolean
  cache: CacheItem[]
  totalKeys: number
}

const {
  loading,
  error,
  skins,
  fetchRandomSkins,
  clearCache,
  getCacheInfo,
  transformSkinsForGame,
} = useCSGOSkins()

const cacheInfo = ref<CacheInfo | null>(null)
const gameCards = ref<GameCard[]>([])

// Pobierz skórki przy załadowaniu
onMounted(() => {
  fetchRandomSkins(16) // 16 skórek dla 8 par
})

async function handleFetchSkins() {
  const fetchedSkins = await fetchRandomSkins(16)
  if (fetchedSkins.length > 0) {
    gameCards.value = transformSkinsForGame(fetchedSkins, 8) as GameCard[]
  }
}

async function handleClearCache() {
  await clearCache()
  await updateCacheInfo()
}

async function updateCacheInfo() {
  const info = await getCacheInfo()
  cacheInfo.value = info as CacheInfo
}

// Pobierz info o cache przy załadowaniu
onMounted(() => {
  updateCacheInfo()
})
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>CS:GO Skins API Test</h1>
      <p>Testowanie cachowania i pobierania losowych skórek z CS:GO API</p>
    </div>

    <div class="controls">
      <button
        class="btn btn-primary"
        :disabled="loading"
        @click="handleFetchSkins"
      >
        {{ loading ? 'Pobieranie...' : 'Pobierz Nowe Skórki' }}
      </button>

      <button
        class="btn btn-secondary"
        @click="handleClearCache"
      >
        Wyczyść Cache
      </button>

      <button
        class="btn btn-info"
        @click="updateCacheInfo"
      >
        Odśwież Info Cache
      </button>
    </div>

    <div v-if="error" class="error">
      <h3>Błąd:</h3>
      <p>{{ error }}</p>
    </div>

    <div v-if="cacheInfo" class="cache-info">
      <h3>Informacje o Cache:</h3>
      <p><strong>Liczba kluczy:</strong> {{ cacheInfo.totalKeys }}</p>
      <div v-if="cacheInfo.cache.length > 0" class="cache-details">
        <h4>Szczegóły cache:</h4>
        <ul>
          <li v-for="item in cacheInfo.cache" :key="item.key">
            <strong>{{ item.key }}:</strong>
            {{ item.itemCount }} elementów,
            {{ item.ageMinutes }} min temu
          </li>
        </ul>
      </div>
    </div>

    <div v-if="skins.length > 0" class="skins-grid">
      <h3>Pobrane Skórki ({{ skins.length }}):</h3>
      <div class="grid">
        <div
          v-for="skin in skins"
          :key="skin.id"
          class="skin-card"
        >
          <img
            :src="skin.image"
            :alt="skin.name"
            loading="lazy"
          >
          <div class="skin-info">
            <h4>{{ skin.name }}</h4>
            <p><strong>Broń:</strong> {{ skin.weapon.name }}</p>
            <p><strong>Rzadkość:</strong> {{ skin.rarity.name }}</p>
            <p><strong>StatTrak:</strong> {{ skin.stattrak ? 'Tak' : 'Nie' }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="gameCards.length > 0" class="game-preview">
      <h3>Karty do Gry Memory ({{ gameCards.length }}):</h3>
      <div class="cards-grid">
        <div
          v-for="card in gameCards"
          :key="card.id"
          class="game-card"
        >
          <img
            :src="card.image"
            :alt="card.value"
            loading="lazy"
          >
          <p>{{ card.value }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Arial, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover {
  background: #138496;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.cache-info {
  background: #d1ecf1;
  color: #0c5460;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.cache-details ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.skins-grid h3,
.game-preview h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.skin-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.skin-card:hover {
  transform: translateY(-2px);
}

.skin-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}

.skin-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1rem;
}

.skin-info p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #7f8c8d;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.game-card {
  background: white;
  border-radius: 0.25rem;
  padding: 0.5rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.game-card img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 0.25rem;
  margin-bottom: 0.25rem;
}

.game-card p {
  margin: 0;
  font-size: 0.75rem;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: center;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
