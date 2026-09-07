<script setup>
// 厨心 2048（2026-09-07 动画版）：tiles 绝对定位渲染——移动 left/top 过渡丝滑，合并弹出+新块浮现动画
// 参考标准 2048 实现：每块是绝对定位实例（id 追踪），滑动即更新坐标触发 CSS transition
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  '4x4': { label: '4×4 标准', size: 4, four: 0.1, mult: 1 },
  '3x3': { label: '3×3 极速', size: 3, four: 0.1, mult: 1 },
  '5x5': { label: '5×5 挑战', size: 5, four: 0.1, mult: 2 },
  f4: { label: '4+ 怪物局', size: 4, four: 0.55, mult: 1.5 },
  easy: { label: '温和局', size: 4, four: 0.05, mult: 0.8 },
}
const mode = ref('4x4')
const SIZE = computed(() => MODES[mode.value].size)
const best = computed(() => {
  const mp = player.minigames?.kitchen2048 ?? {}
  return mp['b_' + mode.value] ?? (mode.value === '4x4' ? (mp.best ?? 0) : mode.value === '3x3' ? (mp.best3 ?? 0) : 0)
})

// tiles 模型：{ id, value, row, col, fresh, merged }
let nextId = 1
const tiles = ref([])
let paid = 0 // 保留兼容占位（已改档位达成制）
let earned = 0
const TILE_BONUS = { 8: 2, 16: 3, 32: 5, 64: 8, 128: 12, 256: 18, 512: 26, 1024: 36, 2048: 60, 4096: 100 }
const score = ref(0)
const over = ref(false)
const won = ref(false)

const GAP = 8
const BOARD_INNER = () => 380 - 20 - 4 // padding 10*2 + border 2*2
const CELL = computed(() => (BOARD_INNER() - (SIZE.value - 1) * GAP) / SIZE.value)

// 物品图档位映射（与图鉴一致，图片必渲染）
const TILE_IMG = { 2: 'apple', 4: 'potato', 8: 'carrot', 16: 'tomato', 32: 'eggplant', 64: 'mushroom', 128: 'roastPotato', 256: 'vegSalad', 512: 'grouperFeast', 1024: 'dragonHotpot', 2048: 'godFeast', 4096: 'legendaryManHan' }

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
  spawnTile(r, c, Math.random() < MODES[mode.value].four ? 4 : 2, { fresh: true })
}
function reset() {
  saveBest()
  tiles.value = []
  score.value = 0
  over.value = false
  won.value = false
  earned = 0
  reached.clear() // 本局已领奖档位
  spawn(); spawn()
}
// 档位达成奖励（2026-09-07）：从合出 8 起，每个新档位首次合成即发奖
const reached = new Set()
function award(tileValue) {
  const base = TILE_BONUS[tileValue]
  if (!base || reached.has(tileValue)) return
  reached.add(tileValue)
  const bonus = Math.round(base * MODES[mode.value].mult) // 奖励随模式倍率（2026-09-07）
  earned += bonus
  player.gainGold(bonus)
  ui.pushLog(`🧩 2048 合出 ${tileValue}！+${bonus} 金币`, 'gain')
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
    // 方向映射：right/down 从远端收集、写入也从远端（2026-09-07 修正方向 bug）
    const kk = (i) => (dir === 'right' || dir === 'down' ? m - 1 - i : i)
    const wp = (i) => kk(i)
    const idxs = []
    for (let i = 0; i < m; i++) {
      const r = dir === 'left' || dir === 'right' ? line : kk(i)
      const c = dir === 'left' || dir === 'right' ? kk(i) : line
      const cell = virtual[r][c]
      if (cell?.value) idxs.push({ tile: cell })
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
        const target = { row: dir === 'left' || dir === 'right' ? line : wp(write), col: dir === 'left' || dir === 'right' ? wp(write) : line }
        positions.set(cur.tile.id, { ...target, mergedInto: true })
        collectIds.add(next.tile.id)
        generate.push({ value: cur.tile.value * 2, ...target })
        score.value += cur.tile.value * 2
        award(cur.tile.value * 2) // 档位首次合成即发奖（从 8 开始）
        i += 2
      } else {
        const target = { row: dir === 'left' || dir === 'right' ? line : wp(write), col: dir === 'left' || dir === 'right' ? wp(write) : line }
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
  if (!won.value && tiles.value.some((t) => t.value >= 2048)) { won.value = true; ui.pushLog('🎉 合出「神圣大餐」（2048）！', 'gain') }
  if (!canMoveAny()) over.value = true
}
function saveBest() {
  const mg = player.minigames.kitchen2048
  if (!mg) player.minigames.kitchen2048 = { best: 0 }
  const key = 'b_' + mode.value
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
      <button v-for="(m, id) in MODES" :key="id" class="g2048-mode" :class="{ on: mode === id }" @click="switchMode(id)">{{ m.label }}</button>
      <div class="g2048-stats">
        <span class="g2048-chip">⭐ <b class="mono">{{ score }}</b></span>
        <span class="g2048-chip">💰 奖 <b class="mono">{{ earned }}</b> 金</span>
        <span class="g2048-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      </div>
    </div>

    <div class="g2048-board2">
      <div class="g2048-slots" :style="{ gridTemplateColumns: 'repeat(' + MODES[mode].size + ', minmax(0, 1fr))' }">
        <div v-for="(x, i) in slots" :key="i" class="g2048-slot"></div>
      </div>
      <div
        v-for="t in tiles"
        :key="t.id"
        class="g2048-cell2"
        :class="'v' + t.value"
        :style="posStyle(t)"
      ><img v-if="TILE_IMG[t.value]" class="g2048-img" :src="itemImage(TILE_IMG[t.value])" @error="$event.target.style.display = 'none'" alt="" />
      <span v-else>{{ t.value }}</span></div>
    </div>

    <div class="g2048-keys">
      <button class="g2048-key" @click="move('left')">←</button>
      <button class="g2048-key" @click="move('up')">↑</button>
      <button class="g2048-key" @click="move('down')">↓</button>
      <button class="g2048-key" @click="move('right')">→</button>
      <button class="g2048-reset" @click="reset()">重新开始</button>
    </div>
    <div v-if="over" class="g2048-over">💀 无路可走了！本局已入账 {{ earned }} 金币</div>
    <div class="g2048-tip">每档首次奖励（8→2金…4096→100金）×模式倍率：标准/极速×1 · 怪物局×1.5 · 温和局×0.8 · 5×5×2 · 最佳分按模式独立记录</div>
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
  display: grid; gap: 8px; grid-auto-rows: 1fr; /* 槽格按容器高度均分（5×5 也成方形） */
}
.g2048-slot {
  height: 0;
  padding-top: 100%; /* 方形占位：宽度=列宽 → 高=宽（任意模式格子方正） */
  border-radius: 10px;
  background: rgba(255, 251, 244, 0.55);
  border: 1px solid rgba(150, 110, 70, 0.25);
}
.g2048-cell2 {
  position: absolute;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  padding: 5px;
  background: rgba(255, 251, 244, 0.6);
  transition: left 0.12s ease, top 0.12s ease; /* 移动丝滑 */
  animation: tileBorn 0.12s ease; /* 新块/合并块浮现 */
  will-change: left, top;
}
@keyframes tileBorn {
  from { transform: scale(0.7); opacity: 0.4; }
  to { transform: scale(1); opacity: 1; }
}
.g2048-img { width: 100%; height: 100%; object-fit: contain; } /* 图片固定尺寸：格内撑满按比例居中 */
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
