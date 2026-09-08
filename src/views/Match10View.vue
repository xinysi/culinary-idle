<script setup>
// 凑十消（2026-09-08 新增）：多层回字嵌套 · 选中两方块数字和=10 消除 · 外层清空后内层解锁
// 规则：①被墙/外层遮挡的锁定方块禁止点击（无反馈）②5 只与 5 配对 ③消除不受距离限制 ④层内自足配对（开局必可解）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { EventBus } from '../game/core/EventBus.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('s6')
const MODES = {
  s4: { label: '4×4 新手', size: 4, five: 0, buffer: 4, gold: 50, desc: '4×4 · 8 对 · 容错 4 步 · +50 币 —— 熟悉玩法' },
  h4: { label: '4×4 紧凑', size: 4, five: 0, buffer: 1, gold: 90, desc: '4×4 · 8 对 · 仅 1 步容错 · +90 币' },
  s6: { label: '6×6 标准', size: 6, five: 0.1, buffer: 6, gold: 110, desc: '6×6 · 18 对 · 容错 6 步 · +110 币' },
  n6: { label: '6×6 无五', size: 6, five: 0, buffer: 6, gold: 130, desc: '6×6 · 无 5 方块（配对唯一清晰）· +130 币' },
  w6: { label: '6×6 多五', size: 6, five: 0.4, buffer: 6, gold: 150, desc: '6×6 · 40% 为 5 对 · +150 币 —— 5 只能对 5' },
  h6: { label: '6×6 紧凑', size: 6, five: 0.1, buffer: 2, gold: 180, desc: '6×6 · 18 对 · 仅 2 步容错 · +180 币' },
  s8: { label: '8×8 挑战', size: 8, five: 0.15, buffer: 10, gold: 220, desc: '8×8 · 32 对 · 容错 10 步 · +220 币' },
  m8: { label: '8×8 专精', size: 8, five: 0.15, buffer: 6, gold: 290, desc: '8×8 · 32 对 · 容错 6 步 · +290 币' },
  w8: { label: '8×8 多五', size: 8, five: 0.45, buffer: 10, gold: 300, desc: '8×8 · 45% 为 5 对 · +300 币 —— 高难度配对' },
  h8: { label: '8×8 紧凑', size: 8, five: 0.15, buffer: 3, gold: 360, desc: '8×8 · 32 对 · 仅 3 步容错 · +360 币 —— 零失误挑战' },
}
const showInfo = ref(false)

const board = ref([])
const sel = ref(null)
const activeLayer = ref(1)
const stepsLeft = ref(0)
const won = ref(false)
const lost = ref(false)
const busy = ref(false)
const hintN = ref(2)
const reshuffleN = ref(1)
const hintPairs = ref([])
const celebrating = ref(false)
let nextKey = 1
let unlockTimer = null

const PAIRS = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]

function ringCells(size, layer) {
  // 回字嵌套：层 k 缩进 k-1 格的外环
  const cells = []
  const lo = layer - 1
  const hi = size - 1 - lo
  if (lo > hi) return cells
  for (let r = lo; r <= hi; r++) for (let c = lo; c <= hi; c++) {
    if (r === lo || r === hi || c === lo || c === hi) cells.push({ row: r, col: c })
  }
  return cells
}
function layerNums(size, layer, fiveRate, total) {
  // 层内自足配对：5 对按比例，其余从 1/9…4/6 对池随机 —— 保证该层清空时必有配对（可解）
  const nums = []
  const fivePairs = Math.round((total / 2) * fiveRate)
  const restPairs = total / 2 - fivePairs
  const restPool = [PAIRS[0], PAIRS[1], PAIRS[2], PAIRS[3]]
  for (let i = 0; i < fivePairs; i++) nums.push(5, 5)
  for (let i = 0; i < restPairs; i++) {
    const [a, b] = restPool[Math.floor(Math.random() * restPool.length)]
    nums.push(a, b)
  }
  // 洗牌
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
  let activeCount = 0
  for (let layer = 1; layer <= maxLayer; layer++) {
    const cells = ringCells(m.size, layer)
    if (!cells.length) continue
    const nums = layerNums(m.size, layer, m.five, cells.length)
    cells.forEach((cell, i) => {
      list.push({ key: nextKey++, layer, row: cell.row, col: cell.col, num: nums[i], cleared: false })
    })
    activeCount += cells.length
  }
  return list
}
function reset() {
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
      if (list[i].num + list[j].num === 10 && !used.has(j)) { found = j; break }
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
  if (!canTap(t)) return // 锁定方块：彻底禁止，无任何反馈
  if (sel.value == null) { sel.value = t.key; beep(520, 0.08); return }
  if (sel.value === t.key) { sel.value = null; return }
  const a = board.value.find((b) => b.key === sel.value)
  const b = t
  const ok = a.num + b.num === 10 && a.key !== b.key
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
      if (list[i].num + list[j].num === 10) {
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
function exitGame() { EventBus.emit('mg:back') }
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
      <button v-for="(m, key) in MODES" :key="key" class="m10-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="m10-chip" style="margin-left: auto">📦 余 <b class="mono">{{ stepsLeft }}</b> 步</span>
      <span class="m10-chip">🔢 剩 <b class="mono">{{ remaining }}</b> 块</span>
      <span class="m10-chip">🪜 第 <b class="mono">{{ activeLayer }}</b> 层</span>
      <span class="m10-chip">💰 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <button class="m10-info-btn" @click="showInfo = true">📖 模式说明</button>
      <button class="m10-exit" @click="exitGame">🚪 退出</button>
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
      <button class="m10-reset" @click="reset()">🔁 重置本局</button>
      <button class="m10-hint" :disabled="hintN <= 0 || won || lost" @click="useHint()">💡 提示 ×{{ hintN }}</button>
      <button class="m10-shuffle" :disabled="reshuffleN <= 0 || won || lost" @click="reshuffle()">🔀 重排 ×{{ reshuffleN }}</button>
    </div>
    <div v-if="won" class="m10-done ok">🎉 全清通关！+{{ MODES[mode].gold }} 游戏币</div>
    <div v-else-if="lost" class="m10-done">💦 无可配对或步数耗尽 —— 重置本局再来</div>

    <!-- 通关礼花 -->
    <div v-if="celebrating" class="m10-fire">
      <span v-for="i in 18" :key="i" class="m10-spark" :style="{ '--dx': ((i * 37) % 200) - 100 + 'px', '--dy': ((i * 61) % 160) - 80 + 'px', animationDelay: (i % 5) * 0.05 + 's' }">✦</span>
    </div>

    <div v-if="showInfo" class="m10-info-mask" @click.self="showInfo = false">
      <div class="m10-info-box">
        <div class="m10-info-head"><b>🧮 凑十消 · 十种模式说明</b><button class="m10-info-close" @click="showInfo = false">✕</button></div>
        <div class="m10-info-list">
          <div class="m10-info-row m10-info-rule">通用规则：回字多层棋盘，外层清空才解锁内层 · 选两个数字相加等于 10 即消除（1+9/2+8/3+7/4+6/5+5）· 5 只能对 5 · 锁定方块不可点击 · 全清通关得金币 · 无配对或步数耗尽即失败 · 提示×2/重排×1 每局免费</div>
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
.m10-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.m10-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.m10-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.m10-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.m10-exit { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #7a6a58; background: rgba(255, 252, 246, 0.7); border: 1px solid rgba(150, 110, 70, 0.3); }
.m10-board {
  width: min(520px, 94%);
  display: grid; gap: 7px;
  padding: 14px; border-radius: 18px;
  /* 绿色竹子墙体：棋盘底（环间空隙即竹墙） */
  background:
    repeating-linear-gradient(0deg, rgba(38, 92, 44, 0.25) 0 3px, transparent 3px 26px),
    repeating-linear-gradient(90deg, rgba(38, 92, 44, 0.25) 0 3px, transparent 3px 26px),
    rgba(78, 128, 66, 0.35);
  border: 4px solid rgba(38, 92, 44, 0.55);
  box-shadow: 0 10px 28px rgba(40, 74, 40, 0.3);
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
.m10-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.m10-reset { padding: 9px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.m10-hint { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.m10-hint:disabled, .m10-shuffle:disabled { opacity: 0.45; cursor: not-allowed; }
.m10-shuffle { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #5b8fd9, #3b6cb0); border: none; }
.m10-done { font-weight: 800; color: var(--bad-strong); }
.m10-done.ok { color: var(--good-strong); }
.m10-fire { position: fixed; inset: 0; z-index: 320; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.m10-spark { position: absolute; font-size: 22px; color: var(--gold); animation: m10spark 1.1s ease-out forwards; }
@keyframes m10spark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.m10-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.m10-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.m10-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.m10-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.m10-info-list { display: flex; flex-direction: column; gap: 8px; }
.m10-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.m10-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.m10-info-name { flex: 0 0 110px; color: var(--primary-strong); }
.m10-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
