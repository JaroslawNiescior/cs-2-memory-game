<script setup lang="ts">
import * as THREE from 'three'

interface Card {
  id: number
  value: string
  isFlipped: boolean
  isMatched: boolean
  mesh?: THREE.Mesh
  frontTexture?: THREE.Texture
  backTexture?: THREE.Texture
}

const BOARD_SIZE = 4
const CARD_WIDTH = 1.5
const CARD_HEIGHT = 2
const CARD_SPACING = 0.3
const FLIP_DURATION = 0.5

const cards = ref<Card[]>([])
const flippedCards = ref<Card[]>([])
const isGameLocked = ref(false)
const moves = ref(0)
const matches = ref(0)

const containerRef = ref<HTMLDivElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let animationId: number

const CARD_VALUES = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼']

const COLORS = {
  cardBack: 0x3B82F6,
  cardFront: 0xF3F4F6,
  matched: 0x10B981,
  background: 0x1A1A2E,
}

function createEmojiTexture(emoji: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!

  context.fillStyle = '#F3F4F6'
  context.fillRect(0, 0, 256, 256)

  context.font = '120px Arial'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#1F2937'
  context.fillText(emoji, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createBackTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!

  const gradient = context.createLinearGradient(0, 0, 256, 256)
  gradient.addColorStop(0, '#3B82F6')
  gradient.addColorStop(1, '#1E40AF')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)

  context.strokeStyle = '#60A5FA'
  context.lineWidth = 4
  for (let i = 0; i < 256; i += 32) {
    context.beginPath()
    context.moveTo(i, 0)
    context.lineTo(i + 32, 32)
    context.moveTo(i + 32, 0)
    context.lineTo(i, 32)
    context.stroke()
  }

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
    75,
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    0.1,
    1000,
  )
  camera.position.set(0, 0, 8)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8)
  directionalLight.position.set(5, 5, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('click', onMouseClick)
  window.addEventListener('resize', onWindowResize)

  animate()
}

function createCard(card: Card, x: number, y: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, 0.1)

  const frontMaterial = new THREE.MeshLambertMaterial({
    map: card.frontTexture,
  })
  const backMaterial = new THREE.MeshLambertMaterial({
    map: card.backTexture,
  })

  const materials = [
    new THREE.MeshLambertMaterial({ color: COLORS.cardBack }),
    new THREE.MeshLambertMaterial({ color: COLORS.cardBack }),
    new THREE.MeshLambertMaterial({ color: COLORS.cardBack }),
    new THREE.MeshLambertMaterial({ color: COLORS.cardBack }),
    frontMaterial,
    backMaterial,
  ]

  const mesh = new THREE.Mesh(geometry, materials)
  mesh.position.set(x, y, 0)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = { card }

  return mesh
}

function initializeGame() {
  const cardsToRemove = scene.children.filter(child => child.userData.card)
  cardsToRemove.forEach((child) => {
    scene.remove(child)
  })

  const cardValues = [...CARD_VALUES, ...CARD_VALUES]
  const shuffledValues = cardValues.sort(() => Math.random() - 0.5)

  cards.value = shuffledValues.map((value, index) => ({
    id: index,
    value,
    isFlipped: false,
    isMatched: false,
    frontTexture: createEmojiTexture(value),
    backTexture: createBackTexture(),
  }))

  const startX = -((BOARD_SIZE - 1) * (CARD_WIDTH + CARD_SPACING)) / 2
  const startY = ((BOARD_SIZE - 1) * (CARD_HEIGHT + CARD_SPACING)) / 2

  cards.value.forEach((card, index) => {
    const row = Math.floor(index / BOARD_SIZE)
    const col = index % BOARD_SIZE
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
}

function flipCardAnimation(card: Card, showFront: boolean) {
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
          if (material instanceof THREE.MeshLambertMaterial) {
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

function flipCard(card: Card) {
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
      if (firstCard.value === secondCard.value) {
        firstCard.isMatched = true
        secondCard.isMatched = true
        matches.value++
        flippedCards.value = []
        isGameLocked.value = false

        if (matches.value === CARD_VALUES.length) {
          setTimeout(() => {
            // eslint-disable-next-line no-alert
            alert(`Gratulacje! Ukończyłeś grę w ${moves.value} ruchach!`)
          }, 500)
        }
      }
      else {
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
    const card = clickedMesh.userData.card as Card

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

  scene.rotation.y += 0.0001

  renderer.render(scene, camera)
}

function restartGame() {
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
      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">Ruchy:</span>
          <span class="stat-value">{{ moves }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Pary:</span>
          <span class="stat-value">{{ matches }}/{{ CARD_VALUES.length }}</span>
        </div>
      </div>
      <button class="restart-btn" @click="restartGame">
        Nowa Gra
      </button>
    </div>

    <div class="game-board">
      <div ref="containerRef" class="three-container" />
    </div>

    <div class="game-instructions">
      <p>Kliknij na karty, aby je odkryć. Znajdź wszystkie pary!</p>
      <p>Użyj myszy aby obracać widok.</p>
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
