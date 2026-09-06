<script setup>
// 厨心 2048（2026-09-06 顶部第三页）：4×4 滑动合并食材→满汉全席，分数兑金币（每 1024 分 +20 金，单局上限 200 金）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const SIZE = 4
const grid = ref(newGrid())
const score = ref(0)
const over = ref(false)
const won = ref(false)

const TILE_META = {
  2: '🥬', 4: '🥔', 8: '🥕', 16: '🍅', 32: '🍆', 64: '🧄',
  128: '🍖', 256: '🍲', 512: '🐟', 1024: '🍰', 2048: '🍾', 4096: '🏆',
}
function newGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}
function spawn() {
  const empty = []
  grid.value.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]) }))
  if (!empty.length) return
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  grid.value[r][c] = Math.random() < 0.9 ? 2 : 4
}
function reset() {
  grid.value = newGrid()
  score.value = 0
  over.value = false
  won.value = false
  spawn()
  spawn()
}
function slideLine(line) {
  const arr = line.filter((v) => v)
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) { arr[i] *= 2; score.value += arr[i]; arr.splice(i + 1, 1) }
  }
  while (arr.length < SIZE) arr.push(0)
  return arr
}
function canMove() {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid.value[r][c]
    if (!v) return true
    if (c + 1 < SIZE && grid.value[r][c + 1] === v) return true
    if (r + 1 < SIZE && grid.value[r + 1][c] === v) return true
  }
  return false
}
function move(dir) {
  if (over.value) return
  const before = JSON.stringify(grid.value)
  for (let i = 0; i < SIZE; i++) {
    let line = dir === 'left' || dir === 'right'
      ? grid.value[i].slice()
      : grid.value.map((r) => r[i])
    if (dir === 'right' || dir === 'down') line.reverse()
    line = slideLine(line)
    if (dir === 'right' || dir === 'down') line.reverse()
    if (dir === 'left' || dir === 'right') grid.value[i] = line
    else grid.value.forEach((r, ri) => { r[i] = line[ri] })
  }
  if (JSON.stringify(grid.value) === before) return
  spawn()
  if (!won.value && grid.value.some((r) => r.includes(2048))) {
    won.value = true
    ui.pushLog('🎉 厨心 2048：合出「神圣大餐」（2048）！', 'gain')
  }
  if (!canMove()) {
    over.value = true
    giveReward()
  }
}
function giveReward() {
  const coins = Math.min(200, Math.floor(score.value / 1024) * 20)
  const mg = player.minigames.kitchen2048
  if (!mg) player.minigames.kitchen2048 = { best: 0 }
  player.minigames.kitchen2048.best = Math.max(player.minigames.kitchen2048.best ?? 0, score.value)
  if (coins > 0) {
    player.gainGold(coins)
    ui.pushLog(`🧩 厨心 2048：最终 ${score.value} 分 → +${coins} 金币！`, 'gain')
  }
}
function onKey(e) {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
  if (map[e.key]) { e.preventDefault(); move(map[e.key]) }
}
window.addEventListener('keydown', onKey)

reset()
const best = computed(() => player.minigames?.kitchen2048?.best ?? 0)
const rows = computed(() => grid.value)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🧩 厨心 2048</h2>
        <p class="dim">方向键 / 按钮滑动合并：蔬菜 → 料理 → 满汉全席（2048 神圣大餐！）。结算时每 1024 分 +20 金（单局上限 200 金）。</p>
      </div>
      <div class="skill-head-right">
        <span class="badge badge-on">⭐ {{ score }}</span>
        <span class="dim mono">最佳 {{ best }}</span>
      </div>
    </header>

    <div class="card">
      <div class="g2048-board">
        <div v-for="(row, r) in rows" :key="'r' + r" class="g2048-row">
          <div v-for="(v, c) in row" :key="c" class="g2048-cell" :class="'v' + v">
            <template v-if="v">{{ TILE_META[v] ?? v }}</template>
          </div>
        </div>
      </div>
      <div class="g2048-controls">
        <button class="btn btn-sm" @click="move('left')">←</button>
        <button class="btn btn-sm" @click="move('up')">↑</button>
        <button class="btn btn-sm" @click="move('down')">↓</button>
        <button class="btn btn-sm" @click="move('right')">→</button>
        <button class="btn btn-sm btn-primary" @click="reset()">重新开始</button>
      </div>
      <div v-if="over" class="heat-verdict miss">💀 无路可走了！分数 {{ score }}（已结算奖励）</div>
    </div>
  </div>
</template>
