<script setup>
// 厨心 2048（2026-09-06 逐页重排版：顶部状态条 + 中心大圆角棋盘 + 底部控制）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref(4)
const SIZE = computed(() => mode.value)
const best = computed(() => player.minigames?.kitchen2048?.[mode.value === 4 ? 'best' : 'best3'] ?? 0)
const grid = ref(newGrid(4))
let paid = 0
let earned = 0
const score = ref(0)
const over = ref(false)
const won = ref(false)

const TILE_META = { 2: '🥬', 4: '🥔', 8: '🥕', 16: '🍅', 32: '🍆', 64: '🧄', 128: '🍖', 256: '🍲', 512: '🐟', 1024: '🍰', 2048: '🍾', 4096: '🏆' }
function newGrid(size = SIZE.value) {
  return Array.from({ length: size }, () => Array(size).fill(0))
}
function spawn() {
  const empty = []
  grid.value.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]) }))
  if (!empty.length) return
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  grid.value[r][c] = Math.random() < 0.9 ? 2 : 4
}
function reset() {
  saveBest()
  grid.value = newGrid()
  score.value = 0
  over.value = false
  won.value = false
  paid = 0
  earned = 0
  spawn(); spawn()
}
function slideLine(line) {
  const arr = line.filter((v) => v)
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) { arr[i] *= 2; score.value += arr[i]; arr.splice(i + 1, 1) }
  }
  while (arr.length < SIZE.value) arr.push(0)
  return arr
}
function stepAndCap() { return mode.value === 4 ? [1024, 200] : [512, 100] }
function tryPay() {
  const [step, cap] = stepAndCap()
  while (score.value - paid >= step && earned + 20 <= cap) { paid += step; earned += 20; player.gainGold(20) }
  if (earned >= cap && score.value - paid >= step) paid = score.value
}
function canMove(size = SIZE.value) {
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const v = grid.value[r][c]
    if (!v) return true
    if (c + 1 < size && grid.value[r][c + 1] === v) return true
    if (r + 1 < size && grid.value[r + 1][c] === v) return true
  }
  return false
}
function move(dir) {
  if (over.value) return
  const before = JSON.stringify(grid.value)
  const size = SIZE.value
  for (let i = 0; i < size; i++) {
    let line = dir === 'left' || dir === 'right' ? grid.value[i].slice() : grid.value.map((r) => r[i])
    if (dir === 'right' || dir === 'down') line.reverse()
    line = slideLine(line)
    if (dir === 'right' || dir === 'down') line.reverse()
    if (dir === 'left' || dir === 'right') grid.value[i] = line
    else grid.value.forEach((r, ri) => { r[i] = line[ri] })
  }
  if (JSON.stringify(grid.value) === before) return
  spawn()
  tryPay()
  if (!won.value && grid.value.some((r) => r.includes(2048))) { won.value = true; ui.pushLog('🎉 合出「神圣大餐」（2048）！', 'gain') }
  if (!canMove()) over.value = true
}
function saveBest() {
  const mg = player.minigames.kitchen2048
  if (!mg) player.minigames.kitchen2048 = { best: 0 }
  const key = mode.value === 4 ? 'best' : 'best3'
  player.minigames.kitchen2048[key] = Math.max(player.minigames.kitchen2048[key] ?? 0, score.value)
}
function switchMode(m) { mode.value = m; reset() }
function onKey(e) {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
  if (map[e.key]) { e.preventDefault(); move(map[e.key]) }
}
window.addEventListener('keydown', onKey)
onUnmounted(() => window.removeEventListener('keydown', onKey))
reset()
const rows = computed(() => grid.value)
</script>

<template>
  <div class="g2048-page">
    <div class="g2048-topbar">
      <button class="g2048-mode" :class="{ on: mode === 4 }" @click="switchMode(4)">4×4 标准</button>
      <button class="g2048-mode" :class="{ on: mode === 3 }" @click="switchMode(3)">3×3 极速</button>
      <div class="g2048-stats">
        <span class="g2048-chip">⭐ <b class="mono">{{ score }}</b></span>
        <span class="g2048-chip">💰 已得 <b class="mono">{{ earned }}/{{ mode === 4 ? 200 : 100 }}</b></span>
        <span class="g2048-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      </div>
    </div>

    <div class="g2048-board2" :style="{ gridTemplateColumns: 'repeat(' + mode + ', minmax(0, 1fr))' }">
      <div v-for="(cell, idx) in rows.flat()" :key="idx" class="g2048-cell2" :class="'v' + cell">
        <template v-if="cell">{{ TILE_META[cell] ?? cell }}</template>
      </div>
    </div>

    <div class="g2048-keys">
      <button class="g2048-key" @click="move('left')">←</button>
      <button class="g2048-key" @click="move('up')">↑</button>
      <button class="g2048-key" @click="move('down')">↓</button>
      <button class="g2048-key" @click="move('right')">→</button>
      <button class="g2048-reset" @click="reset()">重新开始</button>
    </div>
    <div v-if="over" class="g2048-over">💀 无路可走了！本局已入账 {{ earned }} 金币</div>
    <div class="g2048-tip">方向键或按钮滑动合并 · 每跨一档（4×4 每 1024 / 3×3 每 512 分）即时 +20 金，单局上限 200/100</div>
  </div>
</template>
<style scoped>
.g2048-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.g2048-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }
.g2048-mode {
  padding: 7px 16px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 13px;
  border: 1px solid rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.85); color: var(--muted);
}
.g2048-mode.on { background: var(--primary-strong); color: #fff; border-color: var(--primary-strong); }
.g2048-stats { margin-left: auto; display: flex; gap: 8px; }
.g2048-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; }
.g2048-board2 {
  width: min(380px, 90%); aspect-ratio: 1;
  display: grid; gap: 8px;
  background: rgba(150, 110, 70, 0.2);
  border: 2px solid rgba(150, 110, 70, 0.35);
  border-radius: 18px; padding: 10px;
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18), inset 0 2px 10px rgba(93, 64, 55, 0.12);
}
.g2048-cell2 {
  position: relative; aspect-ratio: 1; /* 与美食拼图同款：宽=列宽 → 高=宽，正方形 */
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; font-size: 24px;
  background: rgba(255, 251, 244, 0.6);
}
.g2048-cell2.v2 { background: #e8f3d9; } .g2048-cell2.v4 { background: #d8ecb8; }
.g2048-cell2.v8 { background: #c8e39a; } .g2048-cell2.v16 { background: #b6d98a; }
.g2048-cell2.v32 { background: #f6d9a8; } .g2048-cell2.v64 { background: #f3c684; }
.g2048-cell2.v128 { background: #efb669; } .g2048-cell2.v256 { background: #e8a24e; }
.g2048-cell2.v512 { background: #dd8f3c; } .g2048-cell2.v1024 { background: #e0704a; }
.g2048-cell2.v2048, .g2048-cell2.v4096 { background: #d95a38; color: #fff; }
.g2048-keys { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.g2048-key {
  width: 54px; height: 46px; border-radius: 12px; font-size: 18px; font-weight: 800; cursor: pointer;
  background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); color: var(--text);
}
.g2048-key:hover { border-color: var(--primary-strong); }
.g2048-reset { padding: 0 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.g2048-over { font-weight: 800; color: var(--bad-strong); }
.g2048-tip { color: var(--muted); font-size: 12px; text-align: center; }
</style>
