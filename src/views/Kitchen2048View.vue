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
  '3x3': { label: '3×3 极速', size: 3, four: 0.1, mult: 1, desc: '9 格小盘 · 出4率 10% · 奖励×1 —— 空间极小，能合出 128 已是高手' },
  f3: { label: '3+ 猛兽', size: 3, four: 0.55, mult: 3, desc: '9 格 · 出4率 55% · 奖励×3 —— 全部最难：高概率直出 4，无空间缓冲' },
  easy: { label: '温和局', size: 4, four: 0.05, mult: 0.8, desc: '16 格 · 出4率 5% · 奖励×0.8 —— 新块几乎全是 2，最安逸' },
  '4x4': { label: '4×4 标准', size: 4, four: 0.1, mult: 1, desc: '16 格 · 出4率 10% · 奖励×1 —— 经典 2048 数值' },
  w4: { label: '4+ 狂野', size: 4, four: 0.3, mult: 1.2, desc: '16 格 · 出4率 30% · 奖励×1.2 —— 4 更常见，节奏更紧' },
  f4: { label: '4+ 怪物局', size: 4, four: 0.55, mult: 1.5, desc: '16 格 · 出4率 55% · 奖励×1.5 —— 高难：半数新块是 4' },
  '5x5': { label: '5×5 挑战', size: 5, four: 0.1, mult: 2, desc: '25 格 · 出4率 10% · 奖励×2 —— 空间充足，平稳合大块' },
  w5: { label: '5+ 狂野', size: 5, four: 0.3, mult: 1.8, desc: '25 格 · 出4率 30% · 奖励×1.8 —— 大而凶' },
  s6: { label: '6×6 漫游', size: 6, four: 0.1, mult: 0.6, desc: '36 格 · 出4率 10% · 奖励×0.6 —— 最大棋盘，合出 2048 几乎必成' },
  s6f: { label: '6+ 巨人', size: 6, four: 0.55, mult: 2.5, desc: '36 格 · 出4率 55% · 奖励×2.5 —— 大空间高难度，四率 55%' },
}
const showInfo = ref(false)
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
const TILE_BONUS = { 8: 5, 16: 8, 32: 12, 64: 18, 128: 26, 256: 38, 512: 55, 1024: 80, 2048: 120, 4096: 180 }
const score = ref(0)
const over = ref(false)
const won = ref(false)

const GAP = 8
// 棋盘随模式尺寸自适应：3×3/4×4=380 · 5×5=420 · 6×6=460（6×6 用 380 会太挤）
const BOARD_PX = computed(() => 380 + Math.max(0, MODES[mode.value].size - 4) * 40)
const BOARD_INNER = () => BOARD_PX.value - 20 - 4 // padding 10*2 + border 2*2
const CELL = computed(() => (BOARD_INNER() - (SIZE.value - 1) * GAP) / SIZE.value)

// 物品图档位映射（与图鉴一致，图片必渲染）：8192 起为 6×6 大棋盘专属升格，超出 262144 沿用封顶图
const TILE_IMG = {
  2: 'apple', 4: 'potato', 8: 'carrot', 16: 'tomato', 32: 'eggplant', 64: 'mushroom',
  128: 'roastPotato', 256: 'vegSalad', 512: 'grouperFeast', 1024: 'dragonHotpot',
  2048: 'godFeast', 4096: 'legendaryManHan',
  8192: 'dragonRoast', // 龙息烤全龙
  16384: 'goldenFeast', // 金龙鱼全宴
  32768: 'mammothRoast', // 猛犸象烤肉
  65536: 'chefFriedRice', // 食神炒饭
  131072: 'seaCucumberStew', // 葱烧海参
  262144: 'buddhaJump', // 佛跳墙（封顶）
}
const TILE_IMG_TOP = 262144
function tileImgOf(v) { return TILE_IMG[v] ?? TILE_IMG[TILE_IMG_TOP] }

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
function resetBoard() {
  tiles.value = []
  score.value = 0
  over.value = false
  won.value = false
  earned = 0
  reached.clear() // 本局已领奖档位
  spawn(); spawn()
}
function reset() {
  saveBest()
  resetBoard()
}
// 档位达成奖励（2026-09-07）：从合出 8 起，每个新档位首次合成即发奖
const reached = new Set()
function award(tileValue) {
  const base = TILE_BONUS[tileValue]
  if (!base || reached.has(tileValue)) return
  reached.add(tileValue)
  const bonus = Math.round(base * MODES[mode.value].mult) // 奖励随模式倍率（2026-09-07）
  earned += bonus
  player.gainGameCoins(bonus)
  ui.pushLog(`🧩 2048 合出 ${tileValue}！+${bonus} 游戏币`, 'gain')
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
        // 合并：cur 与 next 都移除、只留生成块（2026-09-07 修复：原实现保留 cur，会在目标格留下
        // 同值"假死块"——被新块覆盖后潜伏，上层移开后又复活，且空位判定把重叠格算占用，
        // 棋盘有效空间被蚕食，难度显著高于标准 2048）
        const target = { row: dir === 'left' || dir === 'right' ? line : wp(write), col: dir === 'left' || dir === 'right' ? wp(write) : line }
        collectIds.add(cur.tile.id)
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
function switchMode(m) {
  if (m === mode.value) return
  saveBest() // 切换前先保存当前模式最佳分（reset 内不再重复存分，避免旧局分数串到新模式键）
  mode.value = m
  resetBoard()
}
function onKey(e) {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
  if (map[e.key]) { e.preventDefault(); move(map[e.key]) }
}
window.addEventListener('keydown', onKey)
onUnmounted(() => window.removeEventListener('keydown', onKey))
reset()

const rows = computed(() => tiles.value)
const slots = computed(() => Array.from({ length: SIZE.value * SIZE.value }))
// 槽格与瓦片共用同一套绝对定位公式（12 内边距 + CELL + GAP 步进），保证像素级对齐
function slotStyle(i) {
  const cell = CELL.value
  const r = Math.floor(i / SIZE.value)
  const c = i % SIZE.value
  return {
    width: cell + 'px',
    height: cell + 'px',
    left: 12 + c * (cell + GAP) + 'px',
    top: 12 + r * (cell + GAP) + 'px',
  }
}
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
      <button v-for="(m, id, idx) in MODES" :key="id" class="g2048-mode" :class="{ on: mode === id }" @click="switchMode(id)">模式{{ idx + 1 }}</button>
      <div class="g2048-stats">
        <span class="g2048-chip">⭐ <b class="mono">{{ score }}</b></span>
        <span class="g2048-chip"><img class="coin-ico" src="/images/icon-coin.png" alt=""> 奖 <b class="mono">{{ earned }}</b> 游戏币</span>
        <span class="g2048-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      </div>
      <button class="g2048-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="g2048-board2" :style="{ width: BOARD_PX + 'px', height: BOARD_PX + 'px' }">
      <div v-for="(x, i) in slots" :key="i" class="g2048-slot" :style="slotStyle(i)"></div>
      <div
        v-for="t in tiles"
        :key="t.id"
        class="g2048-cell2"
        :class="'v' + t.value"
        :style="posStyle(t)"
      ><img v-if="tileImgOf(t.value)" class="g2048-img" :src="itemImage(tileImgOf(t.value))" @error="$event.target.style.display = 'none'" alt="" />
      <span v-else>{{ t.value }}</span></div>
    </div>

    <div class="g2048-keys">
      <button class="g2048-key" @click="move('left')">←</button>
      <button class="g2048-key" @click="move('up')">↑</button>
      <button class="g2048-key" @click="move('down')">↓</button>
      <button class="g2048-key" @click="move('right')">→</button>
      <button class="g2048-reset" @click="reset()">🔄 重置本局</button>
    </div>
        <div v-if="over" class="g2048-mask">
      <div class="g2048-result">
        <div class="g2048-result-head"><b>💀 无路可走了！</b></div>
        <div class="g2048-result-score"><span>本局已入账 <b class="mono">{{ earned }}</b> 游戏币</span></div>
        <button class="g2048-again" @click="reset()">🔄 再来一局</button>
      </div>
    </div>
    <div v-if="showInfo" class="g2048-info-mask" @click.self="showInfo = false">
      <div class="g2048-info-box">
        <div class="g2048-info-head"><b>厨心 2048 · 十种模式说明</b><button class="g2048-info-close" @click="showInfo = false">✕</button></div>
        <div class="g2048-info-list">
          <div v-for="(m, id) in MODES" :key="id" class="g2048-info-row">
            <b class="g2048-info-name">{{ m.label }}</b>
            <span class="g2048-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.g2048-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.g2048-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }
.g2048-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.g2048-mode.on {
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
  border-color: var(--primary-strong);
  border-style: solid;
}
.g2048-stats { margin-left: auto; display: flex; gap: 8px; }
.g2048-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.g2048-board2 {
  position: relative; /* 方块绝对定位容器 */
  background: rgba(150, 110, 70, 0.3);
  border: 2px solid rgba(150, 110, 70, 0.35);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18), inset 0 2px 10px rgba(93, 64, 55, 0.12);
}
.g2048-slot {
  position: absolute; /* 与瓦片共用绝对定位公式，像素级对齐（原 grid 布局有浮点/边框累计误差） */
  box-sizing: border-box;
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
.g2048-keys {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}
.g2048-key { width: 54px; height: 46px; border-radius: 12px; font-size: 18px; font-weight: 800; cursor: pointer; background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); color: var(--text); }
.g2048-key:hover { border-color: var(--primary-strong); }
.g2048-reset { padding: 0 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.g2048-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.g2048-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.g2048-info-box {
  width: min(620px, 92vw);
  max-height: 76vh;
  overflow: auto;
  background: rgba(255, 252, 246, 0.94);
  border: 1px solid rgba(150, 110, 70, 0.35);
  border-radius: 16px;
  padding: 16px 18px;
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35);
}
.g2048-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.g2048-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.g2048-info-list { display: flex; flex-direction: column; gap: 8px; }
.g2048-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.g2048-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.g2048-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── g2048 结算弹窗（2026-09-09 统一）── */
.g2048-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.g2048-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.g2048-result-head { font-size: 18px; }
.g2048-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.g2048-gold { color: var(--good-strong); font-weight: 800; }
.g2048-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.g2048-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.g2048-spark { position: absolute; font-size: 22px; color: var(--gold); animation: g2048Spark 1.1s ease-out forwards; }
@keyframes g2048Spark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
</style>
