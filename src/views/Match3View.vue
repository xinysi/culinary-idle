<script setup>
// 消消乐（2026-09-08 新增）：8×8 三消（图鉴食物图）× 十个模式（步数型/限时型 × 目标分数）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { ITEMS } from '../game/data/items.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const SIZE = 8
const IMG_POOL = Object.values(ITEMS)
  .filter((i) => ['ingredient', 'food', 'spice'].includes(i.type) && itemImage(i.id))
  .map((i) => i.id)
  .slice(0, 60)

const mode = ref('m1')
const MODES = {
  m1: { label: '新手·20步', steps: 20, time: null, goal: 200, gold: 30, desc: '20 步内达 200 分 · +30 币 —— 入门' },
  m2: { label: '标准·20步', steps: 20, time: null, goal: 400, gold: 60, desc: '20 步内达 400 分 · +60 币' },
  m3: { label: '进阶·20步', steps: 20, time: null, goal: 700, gold: 100, desc: '20 步内达 700 分 · +100 币' },
  m4: { label: '高手·20步', steps: 20, time: null, goal: 1100, gold: 150, desc: '20 步内达 1100 分 · +150 币 —— 连锁大师' },
  t1: { label: '限时·60s·200', steps: null, time: 60, goal: 200, gold: 60, desc: '60 秒内达 200 分 · +60 币' },
  t2: { label: '限时·60s·500', steps: null, time: 60, goal: 500, gold: 120, desc: '60 秒内达 500 分 · +120 币' },
  t3: { label: '限时·90s·600', steps: null, time: 90, goal: 600, gold: 160, desc: '90 秒内达 600 分 · +160 币' },
  t4: { label: '限时·90s·1000', steps: null, time: 90, goal: 1000, gold: 260, desc: '90 秒内达 1000 分 · +260 币 —— 高难高速' },
  x1: { label: '硬核·15步·800', steps: 15, time: null, goal: 800, gold: 200, desc: '仅 15 步达 800 分 · +200 币' },
  x2: { label: '硬核·15步·1300', steps: 15, time: null, goal: 1300, gold: 320, desc: '仅 15 步达 1300 分 · +320 币 —— 极限连消' },
}
const showInfo = ref(false)

const board = ref([])
const selected = ref(null)
const score = ref(0)
const stepsLeft = ref(null)
const timeLeft = ref(null)
const over = ref(false)
const won = ref(false)
let timerId = null
let busy = false

function shuffleIds() {
  const ids = []
  for (let i = 0; i < SIZE * SIZE; i++) ids.push(IMG_POOL[Math.floor(Math.random() * 6)])
  return ids
}
function freshBoard() {
  // 生成无初始三连（简单重试）
  for (let attempt = 0; attempt < 50; attempt++) {
    const ids = shuffleIds()
    let ok = true
    outer: for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const id = ids[y * SIZE + x]
      if (x >= 2 && ids[y * SIZE + x - 1] === id && ids[y * SIZE + x - 2] === id) { ok = false; break outer }
      if (y >= 2 && ids[(y - 1) * SIZE + x] === id && ids[(y - 2) * SIZE + x] === id) { ok = false; break outer }
    }
    if (ok) return ids
  }
  return shuffleIds()
}
function reset() {
  if (timerId) clearInterval(timerId)
  board.value = freshBoard()
  selected.value = null
  score.value = 0
  over.value = false
  won.value = false
  busy = false
  if (MODES[mode.value].time) {
    timeLeft.value = MODES[mode.value].time
    timerId = setInterval(() => {
      timeLeft.value--
      if (timeLeft.value <= 0 && !won.value) { timeLeft.value = 0; endNow(false) }
    }, 1000)
  } else timeLeft.value = null
  stepsLeft.value = MODES[mode.value].steps
}
onUnmounted(() => { if (timerId) clearInterval(timerId) })

function matchesIn(ids) {
  const matched = new Set()
  for (let y = 0; y < SIZE; y++) {
    let run = 1
    for (let x = 1; x <= SIZE; x++) {
      if (x < SIZE && ids[y * SIZE + x] === ids[y * SIZE + x - 1]) run++
      else {
        if (run >= 3) for (let k = 0; k < run; k++) matched.add(y * SIZE + x - 1 - k)
        run = 1
      }
    }
  }
  for (let x = 0; x < SIZE; x++) {
    let run = 1
    for (let y = 1; y <= SIZE; y++) {
      if (y < SIZE && ids[y * SIZE + x] === ids[(y - 1) * SIZE + x]) run++
      else {
        if (run >= 3) for (let k = 0; k < run; k++) matched.add((y - 1 - k) * SIZE + x)
        run = 1
      }
    }
  }
  return matched
}
function resolveBoard(ids, chain) {
  let total = 0
  let matched = matchesIn(ids)
  while (matched.size >= 3) {
    total += matched.size * 10 * (1 + 0.5 * chain)
    chain++
    // 移除 + 下落 + 顶部补充
    for (const idx of matched) ids[idx] = null
    for (let x = 0; x < SIZE; x++) {
      const col = []
      for (let y = 0; y < SIZE; y++) if (ids[y * SIZE + x] !== null) col.push(ids[y * SIZE + x])
      while (col.length < SIZE) col.unshift(IMG_POOL[Math.floor(Math.random() * 6)])
      for (let y = 0; y < SIZE; y++) ids[y * SIZE + x] = col[y]
    }
    matched = matchesIn(ids)
  }
  return Math.round(total)
}
function tap(i) {
  if (over.value || busy) return
  const x = i % SIZE
  const y = Math.floor(i / SIZE)
  if (selected.value == null) { selected.value = i; return }
  const sel = selected.value
  const sx = sel % SIZE
  const sy = Math.floor(sel / SIZE)
  if (Math.abs(sx - x) + Math.abs(sy - y) !== 1) { selected.value = i; return }
  selected.value = null
  busy = true
  const ids = [...board.value]
  ;[ids[sel], ids[i]] = [ids[i], ids[sel]]
  const gained = resolveBoard(ids, 0)
  if (gained > 0) {
    board.value = [...ids]
    score.value += gained
    if (MODES[mode.value].steps) stepsLeft.value--
    busy = false
    if (score.value >= MODES[mode.value].goal && !won.value) endNow(true)
    else if (MODES[mode.value].steps && stepsLeft.value <= 0 && !won.value) endNow(score.value >= MODES[mode.value].goal)
  } else {
    ;[ids[sel], ids[i]] = [ids[i], ids[sel]]
    if (MODES[mode.value].steps) stepsLeft.value--
    busy = false
    if (stepsLeft.value <= 0 && MODES[mode.value].steps && !won.value) endNow(score.value >= MODES[mode.value].goal)
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
reset()
</script>

<template>
  <div class="m3-page">
    <div class="m3-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="m3-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="m3-chip" style="margin-left: auto">⭐ <b class="mono">{{ score }}</b>/{{ MODES[mode].goal }}</span>
      <span v-if="stepsLeft !== null" class="m3-chip">🎯 余 <b class="mono">{{ stepsLeft }}</b> 步</span>
      <span v-if="timeLeft !== null" class="m3-chip">⏱ 剩余 <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="m3-chip">💰 目标 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <button class="m3-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="m3-board">
      <div
        v-for="(id, i) in board"
        :key="i"
        class="m3-cell"
        :class="{ sel: selected === i }"
        @click="tap(i)"
      ><img class="m3-img" :src="itemImage(id)" @error="$event.target.style.display = 'none'" alt="" /></div>
    </div>

    <div class="m3-keys">
      <button class="m3-reset" @click="reset()">重新开始</button>
    </div>
    <div v-if="over" class="m3-done" :class="{ ok: won }">{{ won ? `🍬 达标成功！+${MODES[mode].gold} 游戏币` : '💦 未达标，重新开始再来' }}</div>

    <div v-if="showInfo" class="m3-info-mask" @click.self="showInfo = false">
      <div class="m3-info-box">
        <div class="m3-info-head"><b>🍬 消消乐 · 十种模式说明</b><button class="m3-info-close" @click="showInfo = false">✕</button></div>
        <div class="m3-info-list">
          <div class="m3-info-row m3-info-rule">通用规则：点击交换相邻两块 · 三连及以上消除（4/5 连倍数计分）· 连锁 +50% 加成 · 步数/时间耗尽未达标即失败</div>
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
.m3-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.m3-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.m3-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.m3-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.m3-board {
  width: min(520px, 94%);
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px;
  padding: 12px; border-radius: 18px;
  background: rgba(150, 110, 70, 0.16);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
}
.m3-cell {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  padding: 4px; border-radius: 9px; cursor: pointer; user-select: none;
  background: rgba(255, 251, 244, 0.92); border: 1px solid rgba(150, 110, 70, 0.25);
}
.m3-img { width: 100%; height: 100%; object-fit: contain; }
.m3-cell.sel { border-color: var(--gold); box-shadow: 0 0 10px rgba(168, 120, 11, 0.5); }
.m3-cell:hover { transform: scale(1.06); }
.m3-keys { display: flex; gap: 10px; justify-content: center; }
.m3-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m3-done { font-weight: 800; color: var(--bad-strong); }
.m3-done.ok { color: var(--good-strong); }
.m3-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.m3-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.m3-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.m3-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.m3-info-list { display: flex; flex-direction: column; gap: 8px; }
.m3-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.m3-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.m3-info-name { flex: 0 0 128px; color: var(--primary-strong); }
.m3-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
