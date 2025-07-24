<script setup lang="ts">
import type { CS2Skin, GameCard } from '~/types/game'
import * as THREE from 'three'

const CARD_WIDTH = 1.5
const CARD_HEIGHT = 2
const CARD_SPACING = 0.3
const FLIP_DURATION = 0.5

// Poziomy trudności
const DIFFICULTY_LEVELS = {
  easy: { name: 'Easy (3x4)', rows: 3, cols: 4, pairs: 6 },
  medium: { name: 'Medium (4x5)', rows: 4, cols: 5, pairs: 10 },
  hard: { name: 'Hard (5x6)', rows: 5, cols: 6, pairs: 15 },
}

const cards = ref<GameCard[]>([])
const flippedCards = ref<GameCard[]>([])
const isGameLocked = ref(false)
const moves = ref(0)
const matches = ref(0)
const isLoading = ref(true)
const gameReady = ref(false)
const currentDifficulty = ref<keyof typeof DIFFICULTY_LEVELS>('easy')

const containerRef = ref<HTMLDivElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let animationId: number

const { fetchRandomSkins } = useCS2Skins()

const COLORS = {
  cardBack: 0x3B82F6,
  cardFront: 0xF3F4F6,
  matched: 0x10B981,
  background: 0x1A1A2E,
}

async function createSkinTexture(imageUrl: string): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    loader.load(
      imageUrl,
      (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        resolve(texture)
      },
      undefined,
      (error) => {
        console.error('Error loading skin texture:', error)
        resolve(createFallbackTexture(imageUrl))
      },
    )
  })
}

function createFallbackTexture(skinName: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512 // Zwiększona rozdzielczość
  canvas.height = 512
  const context = canvas.getContext('2d')!

  // Gradient tło
  const gradient = context.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, '#4F46E5')
  gradient.addColorStop(1, '#7C3AED')
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 512)

  // Tekst z nazwą skórki
  context.fillStyle = '#FFFFFF'
  context.font = 'bold 24px Arial' // Większa czcionka
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  // Podziel długą nazwę na linie
  const words = skinName.split(' ')
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word
    if (testLine.length > 20 && currentLine) {
      lines.push(currentLine)
      currentLine = word
    }
    else {
      currentLine = testLine
    }
  }
  if (currentLine)
    lines.push(currentLine)

  // Rysuj linie tekstu
  const lineHeight = 30 // Większa wysokość linii
  const startY = 256 - ((lines.length - 1) * lineHeight) / 2

  lines.forEach((line, index) => {
    context.fillText(line, 256, startY + index * lineHeight)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createBackTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 512 // Zwiększona rozdzielczość
  canvas.height = 512
  const context = canvas.getContext('2d')!

  const gradient = context.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, '#3B82F6')
  gradient.addColorStop(1, '#1E40AF')
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 512)

  // Wzór siatki
  context.strokeStyle = '#60A5FA'
  context.lineWidth = 6 // Grubsze linie
  for (let i = 0; i < 512; i += 64) { // Większy wzór
    context.beginPath()
    context.moveTo(i, 0)
    context.lineTo(i + 64, 64)
    context.moveTo(i + 64, 0)
    context.lineTo(i, 64)
    context.stroke()
  }

  // Dodaj logo/tekst CS:GO
  context.fillStyle = '#FFFFFF'
  context.font = 'bold 48px Arial'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('CS:GO', 256, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function initThree() {
  if (!containerRef.value)
    return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.background)

  camera = new THREE.PerspectiveCamera(
    60, // Mniejszy FOV dla mniej zniekształceń
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    0.1,
    1000,
  )

  // Dostosuj pozycję kamery do rozmiaru planszy
  const difficulty = DIFFICULTY_LEVELS[currentDifficulty.value]
  const maxDimension = Math.max(difficulty.rows, difficulty.cols)
  const cameraDistance = 8 + maxDimension * 0.5 // Dynamiczna odległość kamery
  camera.position.set(0, 0, cameraDistance)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Lepsze DPI
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace // Poprawne kolory
  containerRef.value.appendChild(renderer.domElement)

  // Lepsze oświetlenie dla wyraźniejszych tekstur
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.8) // Więcej światła otoczenia
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.0) // Jaśniejsze światło kierunkowe
  directionalLight.position.set(5, 5, 5)
  directionalLight.castShadow = true
  // Poprawione ustawienia cieni
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  // Dodatkowe światło z przodu dla lepszej widoczności
  const frontLight = new THREE.DirectionalLight(0xFFFFFF, 0.5)
  frontLight.position.set(0, 0, 5)
  scene.add(frontLight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('click', onMouseClick)
  window.addEventListener('resize', onWindowResize)

  animate()
}

function createCard(card: GameCard, x: number, y: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, 0.1)

  // Używamy MeshPhongMaterial dla lepszej jakości
  const frontMaterial = new THREE.MeshPhongMaterial({
    map: card.frontTexture,
    shininess: 30,
    specular: 0x111111,
  })
  const backMaterial = new THREE.MeshPhongMaterial({
    map: card.backTexture,
    shininess: 30,
    specular: 0x111111,
  })

  const materials = [
    new THREE.MeshPhongMaterial({ color: COLORS.cardBack }), // prawy bok (index 0)
    new THREE.MeshPhongMaterial({ color: COLORS.cardBack }), // lewy bok (index 1)
    new THREE.MeshPhongMaterial({ color: COLORS.cardBack }), // góra (index 2)
    new THREE.MeshPhongMaterial({ color: COLORS.cardBack }), // dół (index 3)
    backMaterial, // przód - rewers z napisem CS:GO (index 4) - TO widać na początku
    frontMaterial, // tył - awers z obrazkiem (index 5) - TO widać po obróceniu
  ]

  const mesh = new THREE.Mesh(geometry, materials)
  mesh.position.set(x, y, 0)
  // Początkowo karty pokazują rewers (pozycja początkowa 0)
  mesh.rotation.y = 0 // Pokazuj rewers na początku
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { card }

  return mesh
}

async function initializeGame() {
  isLoading.value = true
  gameReady.value = false

  // Wyczyść scenę z poprzednich kart
  const cardsToRemove = scene.children.filter((child: THREE.Object3D) => child.userData.card)
  cardsToRemove.forEach((child: THREE.Object3D) => {
    scene.remove(child)
  })

  const difficulty = DIFFICULTY_LEVELS[currentDifficulty.value]

  try {
    // Pobierz wymaganą liczbę losowych skórek CS:GO
    const skins = await fetchRandomSkins(difficulty.pairs)

    if (skins.length === 0) {
      throw new Error('Nie udało się pobrać skórek CS:GO')
    }

    // Stwórz pary kart z skórek
    const cardPairs: CS2Skin[] = [...skins, ...skins]
    const shuffledSkins = cardPairs.sort(() => Math.random() - 0.5)

    // Stwórz karty z teksturami
    const cardPromises = shuffledSkins.map(async (skin, index) => {
      const frontTexture = await createSkinTexture(skin.image)
      const backTexture = createBackTexture()

      return {
        id: index,
        value: skin.name,
        skin,
        isFlipped: false,
        isMatched: false,
        frontTexture,
        backTexture,
      }
    })

    cards.value = await Promise.all(cardPromises)

    // Rozmieść karty na planszy z uwzględnieniem trudności
    const startX = -((difficulty.cols - 1) * (CARD_WIDTH + CARD_SPACING)) / 2
    const startY = ((difficulty.rows - 1) * (CARD_HEIGHT + CARD_SPACING)) / 2

    cards.value.forEach((card, index) => {
      const row = Math.floor(index / difficulty.cols)
      const col = index % difficulty.cols
      const x = startX + col * (CARD_WIDTH + CARD_SPACING)
      const y = startY - row * (CARD_HEIGHT + CARD_SPACING)

      const mesh = createCard(card, x, y)
      card.mesh = mesh
      scene.add(mesh)
    })

    // Reset statystyk
    flippedCards.value = []
    isGameLocked.value = false
    moves.value = 0
    matches.value = 0
    gameReady.value = true
  }
  catch (error) {
    console.error('Błąd podczas inicjalizacji gry:', error)
    // Fallback - użyj domyślnych wartości jeśli API nie działa
    await initializeFallbackGame()
  }
  finally {
    isLoading.value = false
  }
}

// Fallback gra z prostymi teksturami
async function initializeFallbackGame() {
  const difficulty = DIFFICULTY_LEVELS[currentDifficulty.value]
  const fallbackValues = ['AK-47', 'M4A4', 'AWP', 'Glock-18', 'Desert Eagle', 'P90', 'Famas', 'MP7', 'M4A1-S', 'USP-S', 'Tec-9', 'Five-SeveN', 'P250', 'CZ75-Auto', 'Dual Berettas']

  // Wybierz wymaganą liczbę unikalnych wartości
  const selectedValues = fallbackValues.slice(0, difficulty.pairs)
  const cardValues = [...selectedValues, ...selectedValues]
  const shuffledValues = cardValues.sort(() => Math.random() - 0.5)

  const cardPromises = shuffledValues.map(async (value, index) => {
    const frontTexture = createFallbackTexture(value)
    const backTexture = createBackTexture()

    // Stwórz dummy skin object
    const dummySkin: CS2Skin = {
      id: `fallback-${index}`,
      name: value,
      description: `Fallback ${value}`,
      weapon: { id: `weapon-${index}`, name: value },
      category: { id: 'fallback', name: 'Fallback' },
      pattern: { id: 'fallback', name: 'Fallback' },
      min_float: 0,
      max_float: 1,
      rarity: { id: 'common', name: 'Common', color: '#FFFFFF' },
      stattrak: false,
      souvenir: false,
      image: '',
      team: null,
      crates: [],
      collections: [],
    }

    return {
      id: index,
      value,
      skin: dummySkin,
      isFlipped: false,
      isMatched: false,
      frontTexture,
      backTexture,
    }
  })

  cards.value = await Promise.all(cardPromises)

  // Rozmieść karty na planszy z uwzględnieniem trudności
  const startX = -((difficulty.cols - 1) * (CARD_WIDTH + CARD_SPACING)) / 2
  const startY = ((difficulty.rows - 1) * (CARD_HEIGHT + CARD_SPACING)) / 2

  cards.value.forEach((card, index) => {
    const row = Math.floor(index / difficulty.cols)
    const col = index % difficulty.cols
    const x = startX + col * (CARD_WIDTH + CARD_SPACING)
    const y = startY - row * (CARD_HEIGHT + CARD_SPACING)

    const mesh = createCard(card, x, y)
    card.mesh = mesh
    scene.add(mesh)
  })

  flippedCards.value = []
  isGameLocked.value = false
  moves.value = 0
  matches.value = 0
  gameReady.value = true
}

function flipCardAnimation(card: GameCard, showFront: boolean) {
  if (!card.mesh)
    return

  const targetRotation = showFront ? Math.PI : 0
  const startRotation = card.mesh.rotation.y
  const duration = FLIP_DURATION * 1000
  const startTime = Date.now()

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    if (card.mesh) {
      card.mesh.rotation.y = startRotation + (targetRotation - startRotation) * progress

      if (card.isMatched && progress > 0.5) {
        const materials = card.mesh.material as THREE.Material[]
        materials.forEach((material) => {
          if (material instanceof THREE.MeshPhongMaterial) {
            material.color.setHex(COLORS.matched)
          }
        })
      }
    }

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  animate()
}

function flipCard(card: GameCard) {
  if (card.isFlipped || card.isMatched)
    return

  card.isFlipped = true
  flippedCards.value.push(card)
  flipCardAnimation(card, true)

  if (flippedCards.value.length === 2) {
    moves.value++
    isGameLocked.value = true

    const [firstCard, secondCard] = flippedCards.value

    setTimeout(() => {
      if (firstCard.skin.id === secondCard.skin.id) {
        // Para znaleziona!
        firstCard.isMatched = true
        secondCard.isMatched = true
        matches.value++
        flippedCards.value = []
        isGameLocked.value = false

        // Sprawdź czy gra została ukończona
        if (matches.value === DIFFICULTY_LEVELS[currentDifficulty.value].pairs) {
          setTimeout(() => {
            // eslint-disable-next-line no-alert
            alert(`Gratulacje! Ukończyłeś grę w ${moves.value} ruchach!`)
          }, 500)
        }
      }
      else {
        // Nie para - odwróć karty z powrotem
        setTimeout(() => {
          firstCard.isFlipped = false
          secondCard.isFlipped = false
          flipCardAnimation(firstCard, false)
          flipCardAnimation(secondCard, false)
          flippedCards.value = []
          isGameLocked.value = false
        }, 1000)
      }
    }, FLIP_DURATION * 1000)
  }
}

function onMouseClick(event: MouseEvent) {
  if (isGameLocked.value)
    return

  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(scene.children)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh
    const card = clickedMesh.userData.card as GameCard

    if (card && !card.isFlipped && !card.isMatched) {
      flipCard(card)
    }
  }
}

function onWindowResize() {
  if (!containerRef.value)
    return

  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
}

function animate() {
  animationId = requestAnimationFrame(animate)

  // Usunięte obracanie sceny - scena jest teraz statyczna
  // scene.rotation.y += 0.0001

  renderer.render(scene, camera)
}

function restartGame() {
  initializeGame()
}

function changeDifficulty(newDifficulty: keyof typeof DIFFICULTY_LEVELS) {
  currentDifficulty.value = newDifficulty
  initializeGame()
}

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.domElement.removeEventListener('click', onMouseClick)
    window.removeEventListener('resize', onWindowResize)
    renderer.dispose()
  }
})

onMounted(() => {
  nextTick(() => {
    initThree()
    initializeGame()
  })
})
</script>

<template>
  <div class="game-container">
    <div class="game-header">
      <h1 class="game-title">
        Memory Game 3D
      </h1>

      <!-- Wybór poziomu trudności -->
      <div class="difficulty-selector">
        <h3>Poziom trudności:</h3>
        <div class="difficulty-buttons">
          <button
            v-for="(level, key) in DIFFICULTY_LEVELS"
            :key="key"
            class="difficulty-btn"
            :class="{ active: currentDifficulty === key }"
            @click="changeDifficulty(key)"
          >
            {{ level.name }}
          </button>
        </div>
      </div>

      <div class="mb-6 flex justify-center space-x-8 text-white">
        <div class="stat">
          <span class="stat-label">Ruchy:</span>
          <span class="stat-value">{{ moves }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Pary:</span>
          <span class="stat-value">{{ matches }}/{{ DIFFICULTY_LEVELS[currentDifficulty].pairs }}</span>
        </div>
      </div>
      <button class="restart-btn" @click="restartGame">
        Nowa Gra
      </button>
    </div>

    <div class="game-board" :class="`difficulty-${currentDifficulty}`">
      <div ref="containerRef" class="three-container" />
    </div>

    <div class="game-instructions">
      <p>Kliknij na karty, aby je odkryć. Znajdź wszystkie pary!</p>
      <p>Karty pokażą prawdziwe skiny CS:GO po odkryciu.</p>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Arial', sans-serif;
}

.game-header {
  text-align: center;
  margin-bottom: 2rem;
  color: white;
}

.game-title {
  font-size: 3rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.difficulty-selector {
  margin-bottom: 2rem;
}

.difficulty-selector h3 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
  color: white;
}

.difficulty-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.difficulty-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid transparent;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  min-width: 100px;
}

.difficulty-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.difficulty-btn.active {
  background: #10b981;
  border-color: #059669;
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.game-stats {
  display: flex;
  gap: 2rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.stat {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
}

.stat-label {
  font-weight: bold;
  margin-right: 0.5rem;
}

.stat-value {
  font-size: 1.2rem;
  color: #ffd700;
}

.restart-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.restart-btn:hover {
  background: #059669;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.2);
}

.game-board {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.three-container {
  width: 800px;
  height: 600px;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

/* Dostosuj rozmiar kontenera do poziomu trudności */
.difficulty-easy .three-container {
  width: 600px;
  height: 500px;
}

.difficulty-medium .three-container {
  width: 800px;
  height: 600px;
}

.difficulty-hard .three-container {
  width: 1000px;
  height: 700px;
}

.game-instructions {
  text-align: center;
  color: white;
  opacity: 0.8;
}

.game-instructions p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .three-container {
    width: 100%;
    max-width: 600px;
    height: 450px;
  }

  .game-title {
    font-size: 2rem;
  }

  .game-stats {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
