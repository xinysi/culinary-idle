<script setup>
// 消消乐（2026-09-08 v2 动画版）：tile 绝对定位（交换/下落过渡、消除弹出动画、连锁）；十模式短名 + 高目标分
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'
import { ITEMS } from '../../game/data/items.js'
import { itemImage } from '../../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const SIZE = 8
// 缺图物品排除（2026-09-09）：这些物品的图片文件缺失，抽到会渲染成白块
const MISSING_IMG_IDS = new Set(['foraging_ext_27', 'cooking_ext_11', 'cooking_ext_25', 'cooking_ext2_07', 'cooking_ext2_14', 'preserving_ext2_25', 'spiceMixing_ext2_06', 'spiceMixing_ext2_19'])
const IMG_POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id) && !MISSING_IMG_IDS.has(i.id))
  .sort(() => Math.random() - 0.5)
  .slice(0, 6)
  .map((i) => i.id)

const mode = ref('m1')
const MODES = {
  m1: { label: '新手20', steps: 20, time: null, goal: 600, gold: 40, desc: '20 步内达 600 分 · +40 币 —— 入门' },
  m2: { label: '标准20', steps: 20, time: null, goal: 1200, gold: 90, desc: '20 步内达 1200 分 · +90 币' },
  m3: { label: '进阶20', steps: 20, time: null, goal: 2000, gold: 150, desc: '20 步内达 2000 分 · +150 币' },
  m4: { label: '高手20', steps: 20, time: null, goal: 3000, gold: 230, desc: '20 步内达 3000 分 · +230 币 —— 连锁大师' },
  t1: { label: '60秒600', steps: null, time: 60, goal: 600, gold: 80, desc: '60 秒内达 600 分 · +80 币' },
  t2: { label: '60秒1500', steps: null, time: 60, goal: 1500, gold: 130, desc: '60 秒内达 1500 分 · +130 币' },
  t3: { label: '90秒2000', steps: null, time: 90, goal: 2000, gold: 180, desc: '90 秒内达 2000 分 · +180 币' },
  t4: { label: '90秒3200', steps: null, time: 90, goal: 3200, gold: 260, desc: '90 秒内达 3200 分 · +260 币 —— 高难高速' },
  x1: { label: '硬核15', steps: 15, time: null, goal: 2200, gold: 220, desc: '仅 15 步达 2200 分 · +220 币' },
  x2: { label: '地狱15', steps: 15, time: null, goal: 3800, gold: 320, desc: '仅 15 步达 3800 分 · +320 币 —— 极限连消' },
}
const showInfo = ref(false)

const tiles = ref([])
let nextKey = 1
let epoch = 0 // 重置代际：作废进行中的异步消除流程（防重开后串改新棋盘）
const selectedKey = ref(null)
const score = ref(0)
const stepsLeft = ref(null)
const timeLeft = ref(null)
const over = ref(false)
const started = ref(false)
const won = ref(false)
let timerId = null
let busy = false

function randImg() { return IMG_POOL[Math.floor(Math.random() * IMG_POOL.length)] }

function freshBoard() {
  // 生成无初始三连（重试）
  for (let attempt = 0; attempt < 60; attempt++) {
    const arr = Array.from({ length: SIZE * SIZE }, () => randImg())
    let ok = true
    outer: for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const id = arr[y * SIZE + x]
      if (x >= 2 && arr[y * SIZE + x - 1] === id && arr[y * SIZE + x - 2] === id) { ok = false; break outer }
      if (y >= 2 && arr[(y - 1) * SIZE + x] === id && arr[(y - 2) * SIZE + x] === id) { ok = false; break outer }
    }
    if (ok) return arr
  }
  return Array.from({ length: SIZE * SIZE }, () => randImg())
}
function reset() {
  if (timerId) clearInterval(timerId)
  epoch++ // 作废进行中的异步消除流程
  const myEpoch = epoch
  tiles.value = []
  nextKey = 1
  const arr = freshBoard()
  // 坐标同步写入正确行（不依赖定时器）；入场滑入用纯 CSS 动画，避免被节流导致整盘空白
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) tiles.value.push({ key: nextKey++, row: y, col: x, img: arr[y * SIZE + x], pop: false, justIn: true })
  selectedKey.value = null
  score.value = 0
  over.value = false
  won.value = false
  busy = false
  setTimeout(() => { if (myEpoch === epoch) tiles.value.forEach((t) => { t.justIn = false }) }, 420)
  started.value = false
  timeLeft.value = MODES[mode.value].time || null
  stepsLeft.value = MODES[mode.value].steps
}
onUnmounted(() => { if (timerId) clearInterval(timerId) })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function tileAt(key) { return tiles.value.find((t) => t.key === key && !t.pop) }
function grid() {
  const g = []
  for (let r = 0; r < SIZE; r++) {
    g.push([])
    for (let c = 0; c < SIZE; c++) {
      const t = tiles.value.find((x) => x.row === r && x.col === c && !x.pop)
      g[r].push(t ? t.img : null)
    }
  }
  return g
}
function findMatchTiles() {
  const g = grid()
  const byPos = {}
  for (const t of tiles.value) if (!t.pop) byPos[t.row + '-' + t.col] = t
  const matched = new Set()
  for (let y = 0; y < SIZE; y++) {
    let run = 1
    for (let x = 1; x <= SIZE; x++) {
      if (x < SIZE && g[y][x] === g[y][x - 1] && g[y][x] !== null) run++
      else {
        if (run >= 3) for (let k = 0; k < run; k++) matched.add(y + '-' + (x - 1 - k))
        run = 1
      }
    }
  }
  for (let x = 0; x < SIZE; x++) {
    let run = 1
    for (let y = 1; y <= SIZE; y++) {
      if (y < SIZE && g[y][x] === g[y - 1][x] && g[y][x] !== null) run++
      else {
        if (run >= 3) for (let k = 0; k < run; k++) matched.add((y - 1 - k) + '-' + x)
        run = 1
      }
    }
  }
  return [...matched].map((k) => byPos[k]).filter(Boolean)
}
function scoreOf(matched, chain) {
  return Math.round(matched.length * 15 * Math.pow(1.5, chain - 1))
}
function startTimer() {
  if (timerId) clearInterval(timerId)
  if (!MODES[mode.value].time) return
  timerId = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0 && !won.value) { timeLeft.value = 0; endNow(false) }
  }, 1000)
}
function startGame() {
  if (started.value) return
  started.value = true
  startTimer()
}
async function tap(t) {
  if (!started.value) return
  if (over.value || busy || !tiles.value.length) return
  const myEpoch = epoch
  const x = t.col
  const y = t.row
  const t0 = t
  if (!t0) return
  if (selectedKey.value == null) { selectedKey.value = t0.key; return }
  if (selectedKey.value === t0.key) { selectedKey.value = null; return }
  const a = tileAt(selectedKey.value)
  if (!a) { selectedKey.value = null; busy = false; return }
  const sx = a.col
  const sy = a.row
  if (Math.abs(sx - x) + Math.abs(sy - y) !== 1) { selectedKey.value = t0.key; return }
  selectedKey.value = null
  busy = true
  const b = t0
  if (!a || !b) { busy = false; return }
  // 交换（过渡动画）
  const [ar, ac, br, bc] = [a.row, a.col, b.row, b.col]
  a.row = br; a.col = bc; b.row = ar; b.col = ac
  await sleep(180)
  if (myEpoch !== epoch) return // 期间已重开：放弃本次流程
  let gained = 0
  let chain = 0
  let matched = findMatchTiles()
  while (matched.length >= 3) {
    chain++
    gained += scoreOf(matched, chain)
    for (const t of matched) t.pop = true // 消除弹出动画
    await sleep(240)
    if (myEpoch !== epoch) return
    for (const t of matched) {
      const idx = tiles.value.indexOf(t)
      if (idx >= 0) tiles.value.splice(idx, 1)
    }
    await cascadeDrop(myEpoch)
    if (myEpoch !== epoch) return
    await sleep(160)
    if (myEpoch !== epoch) return
    matched = findMatchTiles()
  }
  if (gained > 0) {
    score.value += gained
    if (MODES[mode.value].steps) stepsLeft.value--
    if (score.value >= MODES[mode.value].goal && !won.value) endNow(true)
    else if (MODES[mode.value].steps && stepsLeft.value <= 0) endNow(score.value >= MODES[mode.value].goal)
  } else {
    // 无匹配换回
    a.row = ar; a.col = ac; b.row = br; b.col = bc
    await sleep(180)
    if (myEpoch !== epoch) return
    if (MODES[mode.value].steps) stepsLeft.value--
    if (MODES[mode.value].steps && stepsLeft.value <= 0) endNow(score.value >= MODES[mode.value].goal)
  }
  busy = false
}
async function cascadeDrop(myEpoch) {
  if (myEpoch !== undefined && myEpoch !== epoch) return
  // 每列下落：旧块底部对齐，空缺从上方滑入新块
  const news = []
  for (let c = 0; c < SIZE; c++) {
    const colTiles = tiles.value.filter((t) => t.col === c && !t.pop).sort((a, b) => a.row - b.row)
    const keep = colTiles.length
    for (let i = 0; i < keep; i++) colTiles[i].row = SIZE - keep + i
    const need = SIZE - keep
    for (let k = 0; k < need; k++) news.push({ key: nextKey++, row: -(need - k), col: c, img: randImg(), pop: false })
  }
  for (const n of news) tiles.value.push(n)
  await sleep(20)
  // 新块目标行 = 该列最上（按 row 计算：列内现有最高 row-1 递减）
  for (const n of news) {
    const higher = tiles.value.filter((t) => t.col === n.col && t !== n && t.row < 0).length
    n.row = -(higher + 1)
  }
  // 重新精确分配新块 row（从该列当前已有 min row 向上）
  const byCol = {}
  for (const n of news) { if (!byCol[n.col]) byCol[n.col] = []; byCol[n.col].push(n) }
  for (const [c, list] of Object.entries(byCol)) {
    const existingMin = Math.min(...tiles.value.filter((t) => t.col === +c && !list.includes(t)).map((t) => t.row), 0)
    list.sort((a, b) => a.row - b.row)
    list.forEach((n, i) => { n.row = existingMin - list.length + i })
  }
}
function endNow(win) {
  won.value = win
  over.value = true
  if (timerId) clearInterval(timerId)
  if (win) {
    const gold = MODES[mode.value].gold
    player.gainGameCoins(gold)
    ui.pushLog(`🍬 消消乐达成 ${score.value} 分！+${gold} 游戏币`, 'gain')
  }
}
function tileStyle(t) {
  const cell = 100 / SIZE
  return {
    left: (t.col * cell) + '%',
    top: (t.row * cell) + '%',
    width: cell + '%',
    height: cell + '%',
  }
}
reset()
</script>

<template>
  <div class="m3-page">
    <div class="m3-topbar">
      <button v-for="(m, key, idx) in MODES" :key="key" class="m3-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="m3-chip" style="margin-left: auto">⭐ <b class="mono">{{ score }}</b>/{{ MODES[mode].goal }}</span>
      <span v-if="stepsLeft !== null" class="m3-chip">🎯 余 <b class="mono">{{ stepsLeft }}</b> 步</span>
      <span v-if="timeLeft !== null" class="m3-chip">⏱ 剩余 <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="m3-chip">💰 目标 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <button class="m3-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="m3-board">
      <div
        v-for="(t, i) in tiles"
        :key="t.key"
        class="m3-tile"
        :class="{ sel: t.key === selectedKey, pop: t.pop, justin: t.justin }"
        :style="tileStyle(t)"
        @click="tap(t)"
      ><div class="m3-inner"><img class="m3-img" :src="itemImage(t.img)" @error="$event.target.style.display = 'none'" alt="" /></div></div>
    </div>

    <div class="m3-keys">
      <button v-if="!started" class="m3-start" @click="startGame()">▶ 开始游戏</button>
      <button class="m3-reset" @click="reset()">🔄 重置本局</button>
    </div>
        <div v-if="over" class="m3-mask">
      <div class="m3-result">
        <div class="m3-result-head"><b>{{ won ? '🍬 达标成功！' : '💦 未达标' }}</b></div>
        <div class="m3-result-score"><span v-if="won" class="m3-gold">+{{ MODES[mode].gold }} 游戏币</span><span v-else>再来一局</span></div>
        <button class="m3-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="won" class="m3-fire">
        <span v-for="i in 20" :key="i" class="m3-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="m3-info-mask" @click.self="showInfo = false">
      <div class="m3-info-box">
        <div class="m3-info-head"><b>🍬 消消乐 · 十种模式说明</b><button class="m3-info-close" @click="showInfo = false">✕</button></div>
        <div class="m3-info-list">
          <div class="m3-info-row m3-info-rule">通用规则：点击交换相邻两块 · 三连及以上消除（4/5 连加成）· 连锁 1.5 倍递增 · 步数/时间耗尽未达标即失败</div>
          <div v-for="(m, key) in MODES" :key="key" class="m3-info-row">
            <b class="m3-info-name">{{ m.label }}</b>
            <span class="m3-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.m3-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.m3-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.m3-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.m3-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.m3-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.m3-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.m3-board {
  position: relative;
  width: min(520px, 94%); aspect-ratio: 1;
  border-radius: 18px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
  overflow: hidden;
}
.m3-tile {
  position: absolute;
  box-sizing: border-box;
  padding: 3px;
  transition: left 0.16s ease, top 0.16s ease, opacity 0.2s ease;
}
.m3-tile.pop { animation: m3pop 0.22s ease forwards; }
/* 入场动画：纯 CSS（不依赖定时器，避免被节流导致整盘空白） */
.m3-tile.justin .m3-inner { animation: m3in 0.32s ease backwards; }
@keyframes m3in {
  from { opacity: 0; transform: translateY(-16px) scale(0.88); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes m3pop {
  0% { transform: scale(1); opacity: 1; }
  60% { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}
.m3-inner {
  width: 100%; height: 100%;
  background: rgba(255, 251, 244, 0.92);
  border: 1px solid rgba(150, 110, 70, 0.25);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  padding: 4px;
  cursor: pointer;
}
.m3-tile.sel .m3-inner { border-color: var(--gold); box-shadow: 0 0 10px rgba(168, 120, 11, 0.5); }
.m3-tile:hover .m3-inner { border-color: var(--primary-strong); }
.m3-img { width: 100%; height: 100%; object-fit: contain; }
.m3-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.m3-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m3-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.m3-info-box {
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
.m3-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.m3-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.m3-info-list { display: flex; flex-direction: column; gap: 8px; }
.m3-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.m3-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.m3-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.m3-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── m3 结算弹窗（2026-09-09 统一）── */
.m3-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.m3-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.m3-result-head { font-size: 18px; }
.m3-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.m3-gold { color: var(--good-strong); font-weight: 800; }
.m3-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m3-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.m3-spark { position: absolute; font-size: 22px; color: var(--gold); animation: m3Spark 1.1s ease-out forwards; }
@keyframes m3Spark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

/* ── m3 开始门控（2026-09-09）── */
.m3-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
</style>
