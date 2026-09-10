<script setup>
// 凑十消（2026-09-08 新增）：多层回字嵌套 · 选中两方块数字和=10 消除 · 外层清空后内层解锁
// 规则：①被墙/外层遮挡的锁定方块禁止点击（无反馈）②5 只与 5 配对 ③消除不受距离限制 ④层内自足配对（开局必可解）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'


const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('a10')
// 凑凑消（2026-09-09 扩展）：加法/减法/乘法/除法/混算 五类运算 × 规则/不规则异形棋盘
const MODES = {
  a10: { label: '加·规', size: 6, op: '+', irregular: false, buffer: 6, gold: 110, desc: '6×6 规则回字 · 两数和 = 随机 10~16 · 容错 6 步 · +110 币' },
  a12: { label: '加·异', size: 6, op: '+', irregular: true, buffer: 6, gold: 120, desc: '6×6 不规则异形 · 两数和 = 随机 10~16 · 容错 6 步 · +120 币' },
  a15: { label: '加·大异', size: 8, op: '+', irregular: true, buffer: 10, gold: 190, desc: '8×8 异形 · 两数和 = 随机 10~16 · 容错 10 步 · +190 币' },
  s5: { label: '差·异', size: 6, op: '-', irregular: true, buffer: 6, gold: 130, desc: '6×6 异形 · 两数差 = 随机 3~9（绝对差）· 容错 6 步 · +130 币' },
  s7: { label: '差·大异', size: 8, op: '-', irregular: true, buffer: 10, gold: 220, desc: '8×8 异形 · 两数差 = 随机 3~9 · 容错 10 步 · +220 币' },
  m12: { label: '积·异', size: 6, op: '*', irregular: true, buffer: 6, gold: 165, desc: '6×6 异形 · 两数积 = 随机合数（6~24 中至少 2 组因式）· 容错 6 步 · +165 币' },
  m18: { label: '积·大异', size: 8, op: '*', irregular: true, buffer: 10, gold: 290, desc: '8×8 异形 · 两数积 = 随机合数（6~24）· 容错 10 步 · +290 币' },
  d2: { label: '商·异', size: 6, op: '/', irregular: true, buffer: 6, gold: 145, desc: '6×6 异形 · 两数商 = 随机 2~4（整除）· 容错 6 步 · +145 币' },
  d3: { label: '商·大异', size: 8, op: '/', irregular: true, buffer: 10, gold: 250, desc: '8×8 异形 · 两数商 = 随机 2~4 · 容错 10 步 · +250 币' },
  mix: { label: '混算·异', size: 6, op: 'mix', irregular: true, buffer: 7, gold: 210, desc: '6×6 异形 · 每对随机「加得 10/12」或「乘得 12/16」· 容错 7 步 · +210 币 —— 要求心算两种运算' },
}
const showInfo = ref(false)

// —— 目标随机化（2026-09-09）：每次重开从合法池随机 ——
const PLUS_POOL = [10, 11, 12, 13, 14, 15, 16]
const MINUS_POOL = [3, 4, 5, 6, 7, 8, 9]
const TIMES_POOL = [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24] // 至少 2 组因式对的合数
const DIV_POOL = [2, 3, 4]
const curPlus = ref(10) // 当前局目标（加法/混算）
const curTimes = ref(12) // 当前局目标（乘法/混算）
const curDiff = ref(5) // 当前局目标（减法）
const curDiv = ref(2) // 当前局目标（除法）
function rollTarget() {
  const m = MODES[mode.value]
  if (m.op === '+') curPlus.value = PLUS_POOL[Math.floor(Math.random() * PLUS_POOL.length)]
  else if (m.op === '-') curDiff.value = MINUS_POOL[Math.floor(Math.random() * MINUS_POOL.length)]
  else if (m.op === '*') curTimes.value = TIMES_POOL[Math.floor(Math.random() * TIMES_POOL.length)]
  else if (m.op === '/') curDiv.value = DIV_POOL[Math.floor(Math.random() * DIV_POOL.length)]
  else if (m.op === 'mix') {
    curPlus.value = [10, 12][Math.floor(Math.random() * 2)]
    curTimes.value = [12, 16][Math.floor(Math.random() * 2)]
  }
}
function curTargetText() {
  const m = MODES[mode.value]
  if (m.op === '+') return '和=' + curPlus.value
  if (m.op === '-') return '差=' + curDiff.value
  if (m.op === '*') return '积=' + curTimes.value
  if (m.op === '/') return '商=' + curDiv.value
  return '加' + curPlus.value + '|乘' + curTimes.value
}

// 配对判定：模式运算下两数字是否成对（目标取当前局随机值）
function okPair(x, y, m) {
  const [a, b] = x >= y ? [x, y] : [y, x]
  if (m.op === '+') return a + b === curPlus.value
  if (m.op === '-') return a - b === curDiff.value
  if (m.op === '*') return a * b === curTimes.value
  if (m.op === '/') return b > 0 && a % b === 0 && a / b === curDiv.value
  if (m.op === 'mix') return a + b === curPlus.value || a * b === curTimes.value
  return false
}
// 配对数字池（按当前随机目标生成）
function pairPool(m) {
  if (m.op === '+') {
    const T = curPlus.value
    const pool = []
    for (let a = 1; a <= T - 1; a++) pool.push([a, T - a])
    return pool
  }
  if (m.op === '-') {
    const D = curDiff.value
    const pool = []
    for (let a = 1; a + D <= 12; a++) pool.push([a + D, a])
    return pool
  }
  if (m.op === '*') {
    const T = curTimes.value
    const pool = []
    for (let d = 1; d * d <= T; d++) if (T % d === 0) pool.push([d, T / d])
    return pool
  }
  if (m.op === '/') {
    const Q = curDiv.value
    const pool = []
    for (let b = 1; b * Q <= 12; b++) pool.push([b * Q, b])
    return pool
  }
  if (m.op === 'mix') return [...pairPool({ op: '+', target: curPlus.value }), ...pairPool({ op: '*', target: curTimes.value })]
  return []
}

const board = ref([])
const sel = ref(null)
const activeLayer = ref(1)
const stepsLeft = ref(0)
const won = ref(false)
const started = ref(false)
const lost = ref(false)
const busy = ref(false)
const hintN = ref(2)
const reshuffleN = ref(1)
const hintPairs = ref([])
const celebrating = ref(false)
let nextKey = 1
let unlockTimer = null

// 配对池见 pairPool（按模式运算生成）

function ringCells(size, layer) {
  // 层环：层 k 缩进 k-1 格的外环；irregular 时挖孔 + 外扩形成不规则异形
  const cells = []
  const lo = layer - 1
  const hi = size - 1 - lo
  if (lo > hi) return cells
  const set = new Set()
  for (let r = lo; r <= hi; r++) for (let c = lo; c <= hi; c++) {
    if (r === lo || r === hi || c === lo || c === hi) set.add(r + ',' + c)
  }
  if (MODES[mode.value].irregular) {
    // 挖孔：随机删偶数个（保留至少 6 格）
    let holes = Math.floor((set.size * 0.18) / 2) * 2
    if (set.size - holes < 6) holes = Math.max(0, Math.floor((set.size - 6) / 2) * 2)
    for (let i = 0; i < holes; i++) {
      const pick = [...set][Math.floor(Math.random() * set.size)]
      set.delete(pick)
    }
    // 外扩：在 lo-1 / hi+1 边界随机加偶数格（不越界、不与已占格重叠、不进入内层）
    const bulgeN = Math.floor(Math.random() * 3) * 2
    let add = 0
    let guard = 0
    while (add < bulgeN && guard++ < 60) {
      const dir = Math.random() < 0.5 ? -1 : 1
      const edge = dir < 0 ? lo - 1 : hi + 1
      if (edge < 0 || edge > size - 1) continue
      const r = Math.random() < 0.5 ? edge : lo + Math.floor(Math.random() * (hi - lo + 1))
      const c = Math.random() < 0.5 ? edge : lo + Math.floor(Math.random() * (hi - lo + 1))
      const key = r + ',' + c
      if (!set.has(key) && !(r > lo && r < hi && c > lo && c < hi)) { set.add(key); add++ }
    }
    // 保偶数格（配对需要）
    if (set.size % 2 !== 0) {
      const last = [...set].pop()
      set.delete(last)
    }
  }
  return [...set].map((k) => { const [r, c] = k.split(','); return { row: +r, col: +c } })
}
function layerNums(m, total) {
  // 按运算从配对池抽样：层内自足配对（开局必可解）
  const pool = pairPool(m)
  const nums = []
  for (let i = 0; i < total / 2; i++) {
    const [a, b] = pool[Math.floor(Math.random() * pool.length)]
    nums.push(a, b)
  }
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[nums[i], nums[j]] = [nums[j], nums[i]]
  }
  return nums
}
function genBoard() {
  const m = MODES[mode.value]
  const maxLayer = Math.floor(m.size / 2)
  const list = []
  for (let layer = 1; layer <= maxLayer; layer++) {
    const cells = ringCells(m.size, layer)
    if (!cells.length) continue
    const nums = layerNums(m, cells.length)
    cells.forEach((cell, i) => {
      list.push({ key: nextKey++, layer, row: cell.row, col: cell.col, num: nums[i], cleared: false })
    })
  }
  return list
}
function startGame() {
  if (started.value) return
  started.value = true
}
function reset() {
  started.value = false
  rollTarget() // 目标随机化：每次重开新目标（2026-09-09）
  board.value = genBoard()
  sel.value = null
  activeLayer.value = 1
  won.value = false
  lost.value = false
  busy.value = false
  hintN.value = 2
  reshuffleN.value = 1
  hintPairs.value = []
  celebrating.value = false
  const m = MODES[mode.value]
  stepsLeft.value = board.value.length / 2 + m.buffer
}
const remaining = computed(() => board.value.filter((b) => !b.cleared).length)
const layerRemaining = (layer) => board.value.filter((b) => !b.cleared && b.layer === layer).length
const closeTo = (n) => 10 - n

function canTap(t) {
  return !won.value && !lost.value && !busy.value && !!t && !t.cleared && t.layer === activeLayer.value
}
function matchExists() {
  const list = board.value.filter((b) => !b.cleared && b.layer === activeLayer.value)
  const used = new Set()
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue
    let found = -1
    for (let j = i + 1; j < list.length; j++) {
      if (okPair(list[i].num, list[j].num, MODES[mode.value]) && !used.has(j)) { found = j; break }
    }
    if (found < 0) return false
    used.add(i); used.add(found)
  }
  return true
}
function fail() {
  lost.value = true
  beep(140, 0.3)
}
function checkWin() {
  if (remaining.value === 0) {
    won.value = true
    celebrating.value = true
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 120)
    setTimeout(() => beep(1568, 0.2), 240)
    setTimeout(() => { celebrating.value = false }, 1500)
    const gold = MODES[mode.value].gold
    player.gainGameCoins(gold)
    ui.pushLog(`🧮 凑十消通关！+${gold} 游戏币`, 'gain')
    return
  }
  // 当前层已清空 → 解锁下一层（淡入）
  if (layerRemaining(activeLayer.value) === 0) {
    activeLayer.value++
    unlockFlash()
  }
  if (!matchExists()) fail()
}
function unlockFlash() {
  // 新层方块淡入动画（一次性 class）
  const t = setTimeout(() => {
    board.value.forEach((b) => { if (b.layer === activeLayer.value && !b.cleared) b.unlock = true })
    setTimeout(() => board.value.forEach((b) => { if (b.unlock) b.unlock = false }), 500)
  }, 30)
  return t
}
function tap(t) {
  if (!started.value) return
  if (!canTap(t)) return // 锁定方块：彻底禁止，无任何反馈
  if (sel.value == null) { sel.value = t.key; beep(520, 0.08); return }
  if (sel.value === t.key) { sel.value = null; return }
  const a = board.value.find((b) => b.key === sel.value)
  const b = t
  const ok = a.key !== b.key && okPair(a.num, b.num, MODES[mode.value])
  sel.value = null
  if (ok) {
    busy.value = true
    a.clearing = true
    b.clearing = true
    beep(660, 0.1)
    setTimeout(() => beep(990, 0.12), 110)
    setTimeout(() => {
      a.cleared = true
      b.cleared = true
      a.clearing = false
      b.clearing = false
      stepsLeft.value--
      busy.value = false
      checkWin()
    }, 260)
  } else {
    beep(180, 0.15) // 错误提示音（配对错误清空选中状态）
    stepsLeft.value--
    if (stepsLeft.value <= 0) fail()
  }
}
function useHint() {
  if (hintN.value <= 0 || won.value || lost.value) return
  const list = board.value.filter((b) => !b.cleared && b.layer === activeLayer.value)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (okPair(list[i].num, list[j].num, MODES[mode.value])) {
        hintN.value--
        hintPairs.value = [list[i].key, list[j].key]
        setTimeout(() => { hintPairs.value = [] }, 1800)
        return
      }
    }
  }
  fail() // 无可提示说明已死局
}
function reshuffle() {
  if (reshuffleN.value <= 0 || won.value || lost.value) return
  const list = board.value.filter((b) => !b.cleared && b.layer === activeLayer.value)
  if (list.length <= 2 || list.length % 2 !== 0) return
  const m = MODES[mode.value]
  const nums = layerNums(m.size, activeLayer.value, m.five, list.length)
  list.forEach((b, i) => { b.num = nums[i] })
  reshuffleN.value--
  beep(440, 0.1)
}

function beep(freq, dur) {
  if (!player.settings?.soundEnabled) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.12, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    o.start()
    o.stop(ctx.currentTime + dur)
  } catch { /* 无音频环境忽略 */ }
}
onUnmounted(() => { clearTimeout(unlockTimer) })
reset()
</script>

<template>
  <div class="m10-page">
    <div class="m10-topbar">
      <button v-for="(m, key, idx) in MODES" :key="key" class="m10-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="m10-chip" style="margin-left: auto">📦 余 <b class="mono">{{ stepsLeft }}</b> 步</span>
      <span class="m10-chip">🔢 剩 <b class="mono">{{ remaining }}</b> 块</span>
      <span class="m10-chip">🪜 第 <b class="mono">{{ activeLayer }}</b> 层</span>
      <span class="m10-chip">🧮 <b class="mono">{{ curTargetText() }}</b></span>
      <span class="m10-chip">💰 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <button class="m10-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="m10-board" :style="{ gridTemplateColumns: 'repeat(' + MODES[mode].size + ', minmax(0, 1fr))' }">
      <div
        v-for="t in board"
        :key="t.key"
        class="m10-cell"
        :class="{
          cleared: t.cleared,
          clearing: t.clearing,
          locked: !t.cleared && t.layer !== activeLayer,
          sel: sel === t.key,
          hint: hintPairs.includes(t.key),
          unlock: t.unlock,
        }"
        :style="{ gridColumn: t.col + 1, gridRow: t.row + 1 }"
        @click="tap(t)"
      >{{ t.num }}</div>
    </div>

    <div class="m10-keys">
      <button v-if="!started" class="m10-start" @click="startGame()">▶ 开始游戏</button>
      <button class="m10-reset" @click="reset()">🔄 重置本局</button>
      <button class="m10-hint" :disabled="hintN <= 0 || won || lost" @click="useHint()">💡 提示 ×{{ hintN }}</button>
      <button class="m10-shuffle" :disabled="reshuffleN <= 0 || won || lost" @click="reshuffle()">🔀 重排 ×{{ reshuffleN }}</button>
    </div>
        <div v-if="won || lost" class="m10-mask">
      <div class="m10-result">
        <div class="m10-result-head"><b>{{ won ? '🎉 全清通关！' : '💦 本局失败' }}</b></div>
        <div class="m10-result-score"><span v-if="won" class="m10-gold">+{{ MODES[mode].gold }} 游戏币</span><span v-else>无可配对或步数耗尽</span></div>
        <button class="m10-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="won" class="m10-fire">
        <span v-for="i in 20" :key="i" class="m10-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>
    

    <!-- 通关礼花 -->
    <div v-if="celebrating" class="m10-fire">
      <span v-for="i in 18" :key="i" class="m10-spark" :style="{ '--dx': ((i * 37) % 200) - 100 + 'px', '--dy': ((i * 61) % 160) - 80 + 'px', animationDelay: (i % 5) * 0.05 + 's' }">✦</span>
    </div>

    <div v-if="showInfo" class="m10-info-mask" @click.self="showInfo = false">
      <div class="m10-info-box">
        <div class="m10-info-head"><b>🧮 凑凑消 · 十种模式说明</b><button class="m10-info-close" @click="showInfo = false">✕</button></div>
        <div class="m10-info-list">
          <div class="m10-info-row m10-info-rule">通用规则：多层嵌套（规则回字或随机挖孔+外扩异形）棋盘，外层清空才解锁内层 · 按模式运算配对即消除（加=目标和/差=固定差/积=目标积/商=固定商/混算=加10或乘12）· 锁定方块不可点击 · 全清通关得游戏币 · 无配对或步数耗尽即失败 · 提示×2/重排×1 每局免费</div>
          <div v-for="(m, key) in MODES" :key="key" class="m10-info-row">
            <b class="m10-info-name">{{ m.label }}</b>
            <span class="m10-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.m10-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.m10-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.m10-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.m10-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.m10-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.m10-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}

.m10-board {
  width: min(520px, 94%);
  display: grid; gap: 7px;
  padding: 14px; border-radius: 18px;
  /* 橙色墙体底纹（2026-09-09 由绿改橙）：棋盘底（环间空隙即墙） */
  background:
    repeating-linear-gradient(0deg, rgba(217, 138, 43, 0.28) 0 3px, transparent 3px 26px),
    repeating-linear-gradient(90deg, rgba(217, 138, 43, 0.28) 0 3px, transparent 3px 26px),
    rgba(234, 176, 74, 0.32);
  border: 4px solid rgba(201, 132, 43, 0.6);
  box-shadow: 0 10px 28px rgba(150, 96, 30, 0.3);
}
.m10-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 900; font-family: var(--mono);
  border-radius: 10px; cursor: pointer; user-select: none;
  background: rgba(255, 253, 248, 0.96); color: #2a2016;
  border: 2px solid #d9c9b4;
  transition: transform 0.12s ease, opacity 0.2s ease, box-shadow 0.12s ease;
}
.m10-cell:hover { transform: scale(1.06); }
.m10-cell.sel { border-color: var(--gold); box-shadow: 0 0 12px rgba(168, 120, 11, 0.6); transform: scale(1.1); }
.m10-cell.locked { opacity: 0.35; cursor: not-allowed; background: rgba(210, 205, 190, 0.9); color: #8a8272; }
.m10-cell.clearing { animation: m10pop 0.26s ease forwards; }
@keyframes m10pop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(0); opacity: 0; } }
.m10-cell.cleared { opacity: 0; pointer-events: none; }
.m10-cell.hint { animation: m10hint 0.5s ease 3; }
@keyframes m10hint { 0%, 100% { box-shadow: 0 0 0 rgba(232, 112, 63, 0); } 50% { box-shadow: 0 0 14px rgba(232, 112, 63, 0.9); } }
.m10-cell.unlock { animation: m10in 0.45s ease; }
@keyframes m10in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
.m10-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.m10-reset { padding: 9px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m10-hint { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.m10-hint:disabled, .m10-shuffle:disabled { opacity: 0.45; cursor: not-allowed; }
.m10-shuffle { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #5b8fd9, #3b6cb0); border: none; }
.m10-fire { position: fixed; inset: 0; z-index: 320; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.m10-spark { position: absolute; font-size: 22px; color: var(--gold); animation: m10spark 1.1s ease-out forwards; }
@keyframes m10spark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.m10-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.m10-info-box {
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
.m10-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.m10-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.m10-info-list { display: flex; flex-direction: column; gap: 8px; }
.m10-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.m10-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.m10-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.m10-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── m10 结算弹窗（2026-09-09 统一）── */
.m10-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.m10-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.m10-result-head { font-size: 18px; }
.m10-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.m10-gold { color: var(--good-strong); font-weight: 800; }
.m10-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m10-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.m10-spark { position: absolute; font-size: 22px; color: var(--gold); animation: m10Spark 1.1s ease-out forwards; }
@keyframes m10Spark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

/* ── m10 开始门控（2026-09-09）── */
.m10-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
</style>
