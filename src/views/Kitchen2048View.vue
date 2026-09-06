<script setup>
// 厨心 2048（2026-09-07 动画版）：tiles 绝对定位渲染——移动 left/top 过渡丝滑，合并弹出+新块浮现动画
// 参考标准 2048 实现：每块是绝对定位实例（id 追踪），滑动即更新坐标触发 CSS transition
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref(4)
const SIZE = computed(() => mode.value)
const best = computed(() => player.minigames?.kitchen2048?.[mode.value === 4 ? 'best' : 'best3'] ?? 0)

// tiles 模型：{ id, value, row, col, fresh, merged }
let nextId = 1
const tiles = ref([])
let paid = 0
let earned = 0
const score = ref(0)
const over = ref(false)
const won = ref(false)

const GAP = 8
const BOARD_INNER = () => 380 - 20 - 4 // padding 10*2 + border 2*2
const CELL = computed(() => (BOARD_INNER() - (SIZE.value - 1) * GAP) / SIZE.value)

const TILE_META = { 2: '🥬', 4: '🥔', 8: '🥕', 16: '🍅', 32: '🍆', 64: '🧄', 128: '🍖', 256: '🍲', 512: '🐟', 1024: '🍰', 2048: '🍾', 4096: '🏆' }

function spawnTile(row, col, value = 2, opts = {}) {
  tiles.value.push({ id: nextId++, value, row, col, fresh: !!opts.fresh, merged: false })
}
function emptyCells() {
  const used = new Set(tiles.value.map((t) => t.row * SIZE.value + t.col))
  const out = []
  for (let r = 0; r < SIZE.value; r++) for (let c = 0; c < SIZE.value; c++) if (!used.has(r * SIZE.value + c)) out.push([r, c])
  return out
}
function spawn() {
  const empty = emptyCells()
  if (!empty.length) return
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  spawnTile(r, c, Math.random() < 0.9 ? 2 : 4, { fresh: true })
}
function reset() {
  saveBest()
  tiles.value = []
  score.value = 0
  over.value = false
  won.value = false
  paid = 0
  earned = 0
  spawn(); spawn()
}
function stepAndCap() { return mode.value === 4 ? [1024, 200] : [512, 100] }
function tryPay() {
  const [step, cap] = stepAndCap()
  while (score.value - paid >= step && earned + 20 <= cap) { paid += step; earned += 20; player.gainGold(20) }
  if (earned >= cap && score.value - paid >= step) paid = score.value
}
function canMoveAny() {
  const m = SIZE.value
  const flat = Array.from({ length: m }, () => Array(m).fill(0))
  tiles.value.forEach((t) => { flat[t.row][t.col] = t.value })
  for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
    const v = flat[r][c]
    if (!v) return true
    if (c + 1 < m && flat[r][c + 1] === v) return true
    if (r + 1 < m && flat[r + 1][c] === v) return true
  }
  return false
}
function move(dir) {
  if (over.value) return
  const m = SIZE.value
  // 按方向建索引：每行/列取 tiles 到线，滑动合并
  const virtual = Array.from({ length: m }, () => Array(m).fill(0))
  tiles.value.forEach((t) => { virtual[t.row][t.col] = t })
  let changed = false

  // 预排：每个 tile 的目标坐标（统一计算后一次性更新，触发 transition）
  const positions = new Map()
  const generate = []
  const collectIds = new Set()
  for (let line = 0; line < m; line++) {
    // 抽该线 tiles（从行进方向）
    const idxs = []
    for (let i = 0; i < m; i++) {
      const r = dir === 'left' || dir === 'right' ? line : i
      const c = dir === 'up' || dir === 'down' ? line : i
      const cell = dir === 'left' || dir === 'right' ? virtual[r][c] : virtual[i][c]
      if (cell?.value) idxs.push({ tile: cell, pos: i })
    }
    if (!idxs.length) continue
    // 合并计算（每元素最多参与一次）
    let write = 0
    let i = 0
    const lineTiles = []
    while (i < idxs.length) {
      const cur = idxs[i]
      const next = idxs[i + 1]
      if (next && next.tile.value === cur.tile.value) {
        // 合并：cur 滑动到目标位，相邻移除，生成合并块
        const nr = dir === 'left' ? line : write
        const nc = dir === 'left' ? write : dir === 'right' ? m - 1 - write : line
        const row = dir === 'left' || dir === 'right' ? line : write
        const col = dir === 'left' || dir === 'right' ? write : line
        void nr; void nc
        const target = { row: dir === 'up' || dir === 'down' ? write : line, col: dir === 'left' || dir === 'right' ? write : line }
        positions.set(cur.tile.id, { ...target, mergedInto: true })
        collectIds.add(next.tile.id)
        generate.push({ value: cur.tile.value * 2, ...target })
        score.value += cur.tile.value * 2
        i += 2
      } else {
        const target = { row: dir === 'up' || dir === 'down' ? write : line, col: dir === 'left' || dir === 'right' ? write : line }
        positions.set(cur.tile.id, target)
        i += 1
      }
      write++
    }
  }
  // 应用：tiles 坐标更新（旧块过渡）；移除被合并块（先淡出再删——简化：直接删+新块 pop）
  const nextTiles = []
  for (const t of tiles.value) {
    if (collectIds.has(t.id)) continue
    const p = positions.get(t.id)
    if (p) {
      if (p.row !== t.row || p.col !== t.col) changed = true
      t.row = p.row
      t.col = p.col
    }
    nextTiles.push(t)
  }
  tiles.value = nextTiles
  // 合并生成块（弹出动画）
  for (const g of generate) spawnTile(g.row, g.col, g.value, { fresh: true })
  if (generate.length) changed = true

  // 出现标记（新块的 fresh=true 一次性清除）
  tiles.value.forEach((t) => { if (t.fresh) { t.fresh = false; t.justBorn = true } })

  if (!changed) return
  spawn()
  tryPay()
  if (!won.value && tiles.value.some((t) => t.value >= 2048)) { won.value = true; ui.pushLog('🎉 合出「神圣大餐」（2048）！', 'gain') }
  if (!canMoveAny()) over.value = true
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

const rows = computed(() => tiles.value)
const slots = computed(() => Array.from({ length: SIZE.value * SIZE.value }))
function posStyle(t) {
  const cell = CELL.value
  return {
    width: cell + 'px',
    height: cell + 'px',
    left: 12 + t.col * (cell + GAP) + 'px',
    top: 12 + t.row * (cell + GAP) + 'px',
  }
}
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

    <div class="g2048-board2">
      <div class="g2048-slots" :style="{ gridTemplateColumns: 'repeat(' + mode + ', minmax(0, 1fr))' }">
        <div v-for="(x, i) in slots" :key="i" class="g2048-slot"></div>
      </div>
      <div
        v-for="t in tiles"
        :key="t.id"
        class="g2048-cell2"
        :class="'v' + t.value"
        :style="posStyle(t)"
      >{{ TILE_META[t.value] ?? t.value }}</div>
    </div>

    <div class="g2048-keys">
      <button class="g2048-key" @click="move('left')">←</button>
      <button class="g2048-key" @click="move('up')">↑</button>
      <button class="g2048-key" @click="move('down')">↓</button>
      <button class="g2048-key" @click="move('right')">→</button>
      <button class="g2048-reset" @click="reset()">重新开始</button>
    </div>
    <div v-if="over" class="g2048-over">💀 无路可走了！本局已入账 {{ earned }} 金币</div>
    <div class="g2048-tip">方向键或按钮滑动 · 每跨一档（4×4 每 1024 / 3×3 每 512 分）即时 +20 金</div>
  </div>
</template>
<style scoped>
.g2048-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.g2048-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }
.g2048-mode { padding: 7px 16px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 13px; border: 1px solid rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.85); color: var(--muted); }
.g2048-mode.on { background: var(--primary-strong); color: #fff; border-color: var(--primary-strong); }
.g2048-stats { margin-left: auto; display: flex; gap: 8px; }
.g2048-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; }
.g2048-board2 {
  position: relative; /* 方块绝对定位容器 */
  width: 380px; height: 380px;
  background: rgba(150, 110, 70, 0.3);
  border: 2px solid rgba(150, 110, 70, 0.35);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18), inset 0 2px 10px rgba(93, 64, 55, 0.12);
}
.g2048-slots {
  position: absolute; inset: 12px;
  display: grid; gap: 8px;
}
.g2048-slot {
  border-radius: 10px;
  background: rgba(255, 251, 244, 0.55);
  border: 1px solid rgba(150, 110, 70, 0.25);
}
.g2048-cell2 {
  position: absolute;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  background: rgba(255, 251, 244, 0.6);
  transition: left 0.12s ease, top 0.12s ease; /* 移动丝滑 */
  animation: tileBorn 0.12s ease; /* 新块/合并块浮现 */
  will-change: left, top;
}
@keyframes tileBorn {
  from { transform: scale(0.7); opacity: 0.4; }
  to { transform: scale(1); opacity: 1; }
}
.g2048-cell2.v2 { background: #e8f3d9; } .g2048-cell2.v4 { background: #d8ecb8; }
.g2048-cell2.v8 { background: #c8e39a; } .g2048-cell2.v16 { background: #b6d98a; }
.g2048-cell2.v32 { background: #f6d9a8; } .g2048-cell2.v64 { background: #f3c684; }
.g2048-cell2.v128 { background: #efb669; } .g2048-cell2.v256 { background: #e8a24e; }
.g2048-cell2.v512 { background: #dd8f3c; } .g2048-cell2.v1024 { background: #e0704a; }
.g2048-cell2.v2048, .g2048-cell2.v4096 { background: #d95a38; color: #fff; }
.g2048-keys { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.g2048-key { width: 54px; height: 46px; border-radius: 12px; font-size: 18px; font-weight: 800; cursor: pointer; background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); color: var(--text); }
.g2048-key:hover { border-color: var(--primary-strong); }
.g2048-reset { padding: 0 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.g2048-over { font-weight: 800; color: var(--bad-strong); }
.g2048-tip { color: var(--muted); font-size: 12px; text-align: center; }
</style>
