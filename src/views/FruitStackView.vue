<script setup>
// 果了个果（2026-09-09 新增）：多层堆叠卡牌三消 —— 点未被压住的卡入底部 7 槽，凑 3 同款消除；槽满即负
// 可解性保证：发牌按「层序（顶层优先）」每 3 张一组分配同一水果 → 玩家按同序取牌必可全清
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 布局常量 ──
const CELL = 60 // 单元格边长
const HALF = CELL / 2 // 半格步进
const GRID = 7 // 7×7 单元格
const CARD = 56 // 卡牌边长
const BOARD_W = CELL * GRID // 420
const BOARD_H = CELL * GRID
const SLOT_MAX = 7
const SLOT_SIZE = 54
const SLOT_GAP = 6
const SLOT_Y = BOARD_H + 18
const SLOT_X0 = (BOARD_W - (SLOT_MAX * SLOT_SIZE + (SLOT_MAX - 1) * SLOT_GAP)) / 2
const STAGE_H = SLOT_Y + SLOT_SIZE + 6

// 水果种类池（图鉴有图）
const FRUITS = [
  { name: '葡萄', id: 'grape' },
  { name: '樱桃', id: 'foraging_ext_06' },
  { name: '柠檬', id: 'foraging_ext_04' },
  { name: '青梅', id: 'foraging_ext2_03' },
  { name: '草莓', id: 'strawberry' },
  { name: '橙子', id: 'foraging_ext_03' },
  { name: '苹果', id: 'apple' },
  { name: '梨', id: 'foraging_ext_02' },
  { name: '桃子', id: 'foraging_ext_01' },
  { name: '菠萝', id: 'pineapple' },
  { name: '椰子', id: 'foraging_ext2_11' },
  { name: '西瓜', id: 'watermelon' },
]

const mode = ref('m1')
const MODES = {
  m1: { label: '1关 教学', layers: 1, triples: 3, types: 3, gold: 60, desc: '1 层 · 9 张 · 3 种水果 · +60 币 —— 熟悉玩法' },
  m2: { label: '2关 轻松', layers: 2, triples: 6, types: 4, gold: 80, desc: '2 层 · 18 张 · 4 种 · +80 币' },
  m3: { label: '3关 普通', layers: 2, triples: 9, types: 5, gold: 100, desc: '2 层 · 27 张 · 5 种 · +100 币' },
  m4: { label: '4关 进阶', layers: 3, triples: 12, types: 6, gold: 130, desc: '3 层 · 36 张 · 6 种 · +130 币' },
  m5: { label: '5关 挑战', layers: 3, triples: 15, types: 6, gold: 160, desc: '3 层 · 45 张 · 6 种 · +160 币' },
  m6: { label: '6关 困难', layers: 4, triples: 18, types: 7, gold: 200, desc: '4 层 · 54 张 · 7 种 · +200 币' },
  m7: { label: '7关 困难+', layers: 4, triples: 24, types: 8, gold: 240, desc: '4 层 · 72 张 · 8 种 · +240 币' },
  m8: { label: '8关 专家', layers: 5, triples: 30, types: 9, gold: 280, desc: '5 层 · 90 张 · 9 种 · +280 币' },
  m9: { label: '9关 大师', layers: 6, triples: 36, types: 10, gold: 320, desc: '6 层 · 108 张 · 10 种 · +320 币' },
  m10: { label: '10关 地狱', layers: 7, triples: 45, types: 12, gold: 380, desc: '7 层 · 135 张 · 12 种 · +380 币 —— 极限堆叠' },
}
const showInfo = ref(false)

// ── 状态 ──
let nextId = 1
const cards = ref([]) // { id, layer, hx, hy, type, cleared, inSlot, slotIdx, clearing, justUnlocked }
const slots = ref(Array(SLOT_MAX).fill(null)) // 存 card id
const won = ref(false)
const over = ref(false)
const busy = ref(false)
const hintN = ref(2)
const shuffleN = ref(1)
const withdrawN = ref(1)
const hintIds = ref([])
const celebrating = ref(false)
let soundCtx = null

const remainBoard = computed(() => cards.value.filter((c) => !c.cleared && !c.inSlot).length)
const remainSlot = computed(() => slots.value.filter((s) => s !== null).length)

// ── 音效（Web Audio，遵守 soundEnabled）──
function beep(freq, dur, type = 'sine') {
  if (!player.settings?.soundEnabled) return
  try {
    soundCtx = soundCtx ?? new (window.AudioContext || window.webkitAudioContext)()
    const o = soundCtx.createOscillator()
    const g = soundCtx.createGain()
    o.type = type
    o.frequency.value = freq
    o.connect(g)
    g.connect(soundCtx.destination)
    g.gain.setValueAtTime(0.1, soundCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + dur)
    o.start()
    o.stop(soundCtx.currentTime + dur)
  } catch { /* 无音频环境忽略 */ }
}

// ── 关卡生成（保证可解）──
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function genLevel() {
  const m = MODES[mode.value]
  const total = m.triples * 3
  // 1) 生成位置：按层分配数量（越下层越多），每层内半格位置不重复
  const perLayer = []
  let left = total
  const weights = []
  for (let l = 1; l <= m.layers; l++) weights.push(l) // 下层权重高
  const wSum = weights.reduce((s, v) => s + v, 0)
  for (let l = 1; l <= m.layers; l++) {
    const n = l === m.layers ? left : Math.min(left, Math.max(3, Math.round((total * weights[l - 1]) / wSum)))
    perLayer.push(n)
    left -= n
    if (left <= 0) break
  }
  // 修正：若因取整导致总量不足，补到最后一层
  let sum = perLayer.reduce((s, v) => s + v, 0)
  if (sum < total) perLayer[perLayer.length - 1] += total - sum
  const positions = []
  for (let l = 1; l <= perLayer.length; l++) {
    const n = perLayer[l - 1]
    const used = new Set()
    let guard = 0
    for (let k = 0; k < n && guard < n * 40; ) {
      guard++
      const hx = Math.floor(Math.random() * (GRID * 2 - 1)) // 0..12
      const hy = Math.floor(Math.random() * (GRID * 2 - 1))
      const key = hx + ',' + hy
      if (used.has(key)) continue
      used.add(key)
      positions.push({ layer: l, hx, hy })
      k++
    }
  }
  // 2) 按层序（顶层优先）排序 → 每 3 张一组分配同一水果（可解性保证）
  shuffleArr(positions)
  positions.sort((a, b) => b.layer - a.layer)
  const typePool = []
  for (let i = 0; i < m.types; i++) typePool.push(i)
  const list = []
  let ti = 0
  for (let i = 0; i < positions.length; i += 3) {
    const t = typePool[ti % typePool.length]
    ti++
    for (let k = 0; k < 3 && i + k < positions.length; k++) {
      const p = positions[i + k]
      list.push({ id: nextId++, layer: p.layer, hx: p.hx, hy: p.hy, type: t, cleared: false, inSlot: false, slotIdx: -1, clearing: false, justUnlocked: false })
    }
  }
  return list
}
function reset() {
  cards.value = genLevel()
  slots.value = Array(SLOT_MAX).fill(null)
  won.value = false
  over.value = false
  busy.value = false
  hintN.value = 2
  shuffleN.value = 1
  withdrawN.value = 1
  hintIds.value = []
  celebrating.value = false
}

// ── 遮挡判定 ──
function isCovered(card) {
  if (card.cleared || card.inSlot) return false
  for (const o of cards.value) {
    if (o === card || o.cleared || o.inSlot) continue
    if (o.layer <= card.layer) continue
    if (Math.abs(o.hx - card.hx) < 2 && Math.abs(o.hy - card.hy) < 2) return true // 半格单位：2 半格 = 1 格
  }
  return false
}
function canClick(card) {
  return !won.value && !over.value && !card.cleared && !card.inSlot && !isCovered(card)
}
function coveredMap() {
  const map = {}
  for (const c of cards.value) map[c.id] = isCovered(c)
  return map
}
const covered = computed(() => {
  // 依赖 cards 变化重算
  cards.value.length
  return coveredMap()
})

// ── 卡槽整理：同款相邻排列 ──
function compactSlots() {
  const inSlot = slots.value.filter((s) => s !== null).map((id) => cards.value.find((c) => c.id === id)).filter(Boolean)
  inSlot.sort((a, b) => a.type - b.type)
  const next = Array(SLOT_MAX).fill(null)
  inSlot.forEach((c, i) => { next[i] = c.id; c.slotIdx = i })
  slots.value = next
}

// ── 点击卡牌 ──
function tapCard(card) {
  if (!canClick(card)) return
  const free = slots.value.indexOf(null)
  if (free < 0) { fail(); return }
  card.inSlot = true
  card.slotIdx = free
  slots.value[free] = card.id
  slots.value = [...slots.value]
  beep(620, 0.08)
  compactSlots()
  // 三消判定：立即执行（动画不阻塞连续点击）
  const byType = {}
  for (const id of slots.value) {
    if (id === null) continue
    const c = cards.value.find((x) => x.id === id)
    byType[c.type] = (byType[c.type] ?? 0) + 1
  }
  const hitType = Object.keys(byType).find((t) => byType[t] >= 3)
  if (hitType !== undefined) {
    const group = slots.value
      .filter((id) => id !== null)
      .map((id) => cards.value.find((c) => c.id === id))
      .filter((c) => String(c.type) === hitType)
      .slice(0, 3)
    busy.value = true
    group.forEach((c) => { c.clearing = true })
    beep(880, 0.1)
    setTimeout(() => beep(1180, 0.12), 90)
    setTimeout(() => {
      group.forEach((c) => { c.cleared = true; c.inSlot = false })
      slots.value = slots.value.map((id) => (group.some((g) => g.id === id) ? null : id))
      compactSlots()
      // 解锁高亮：上层消除后重新暴露的卡牌
      cards.value.forEach((c) => {
        if (!c.cleared && !c.inSlot && !isCovered(c)) c.justUnlocked = true
      })
      setTimeout(() => cards.value.forEach((c) => { c.justUnlocked = false }), 420)
      busy.value = false
      checkEnd()
    }, 230)
    return
  }
  checkEnd()
}
function checkEnd() {
  if (won.value || over.value) return
  if (remainBoard.value === 0 && remainSlot.value === 0) { win(); return }
  if (remainSlot.value >= SLOT_MAX) { fail(); return }
  // 死局保护：场上还有牌但已无任何可点击卡（理论上不会发生，防御性判定）
  if (remainBoard.value > 0 && !cards.value.some((c) => canClick(c))) { fail(); return }
}
function win() {
  won.value = true
  celebrating.value = true
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  setTimeout(() => { celebrating.value = false }, 1600)
  const gold = MODES[mode.value].gold
  player.gainGameCoins(gold)
  ui.pushLog(`🍇 果了个果通关！${MODES[mode.value].label} +${gold} 游戏币`, 'gain')
}
function fail() {
  if (won.value || over.value) return
  over.value = true
  busy.value = false
  beep(160, 0.32, 'sawtooth')
}

// ── 道具 ──
function useHint() {
  if (hintN.value <= 0 || won.value || over.value) return
  // 优先找「可点击卡」且同款在场上/槽中共 ≥3 的一组
  const pool = cards.value.filter((c) => !c.cleared)
  const byType = {}
  pool.forEach((c) => { (byType[c.type] ??= []).push(c) })
  let group = null
  for (const t of Object.keys(byType)) {
    const g = byType[t]
    if (g.length < 3) continue
    const clickable = g.filter((c) => canClick(c))
    if (clickable.length) { group = [clickable[0], ...g.filter((c) => c !== clickable[0]).slice(0, 2)]; break }
  }
  if (!group) group = pool.filter((c) => canClick(c)).slice(0, 3)
  if (!group.length) return
  hintN.value--
  hintIds.value = group.map((c) => c.id)
  setTimeout(() => { hintIds.value = [] }, 1800)
}
function useShuffle() {
  if (shuffleN.value <= 0 || won.value || over.value || busy.value) return
  // 重排：保持每种水果总数不变（板上+槽内每种必为 3 的倍数），按层序重新三元组发牌
  const all = cards.value.filter((c) => !c.cleared)
  const boardCards = all.filter((c) => !c.inSlot)
  const slotCards = all.filter((c) => c.inSlot)
  if (boardCards.length < 3) return
  const totalByType = {}
  all.forEach((c) => { totalByType[c.type] = (totalByType[c.type] ?? 0) + 1 })
  slotCards.forEach((c) => { totalByType[c.type] -= 1 })
  const multiset = []
  for (const t of Object.keys(totalByType)) {
    for (let i = 0; i < totalByType[t]; i++) multiset.push(Number(t))
  }
  shuffleArr(multiset)
  const order = [...boardCards].sort((a, b) => b.layer - a.layer)
  order.forEach((c, i) => { c.type = multiset[i] ?? c.type })
  shuffleN.value--
  beep(520, 0.12)
  ui.pushLog('🍇 果了个果：已重排卡牌', 'info')
}
function useWithdraw() {
  if (withdrawN.value <= 0 || won.value || over.value || busy.value) return
  // 撤回槽内最后放入的卡牌（返回面板原位）
  const filled = slots.value.map((id, i) => (id === null ? null : { id, i })).filter(Boolean)
  if (!filled.length) return
  const last = filled[filled.length - 1]
  const card = cards.value.find((c) => c.id === last.id)
  if (!card) return
  card.inSlot = false
  card.slotIdx = -1
  slots.value[last.i] = null
  slots.value = [...slots.value]
  compactSlots()
  withdrawN.value--
  beep(440, 0.1)
  ui.pushLog('🍇 果了个果：撤回一张卡牌', 'info')
}
onUnmounted(() => { /* 无定时器需清理（setTimeout 短生命周期） */ })

// ── 渲染位置 ──
function cardStyle(c) {
  if (c.inSlot) {
    return {
      left: SLOT_X0 + c.slotIdx * (SLOT_SIZE + SLOT_GAP) + 'px',
      top: SLOT_Y + 'px',
      width: SLOT_SIZE + 'px',
      height: SLOT_SIZE + 'px',
      zIndex: 100 + c.slotIdx,
    }
  }
  return {
    left: c.hx * HALF + 'px',
    top: c.hy * HALF + 'px',
    width: CARD + 'px',
    height: CARD + 'px',
    zIndex: c.layer * 10,
  }
}

reset()
</script>

<template>
  <div class="gg-page">
    <div class="gg-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="gg-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="gg-chip" style="margin-left: auto">🍇 场上 <b class="mono">{{ remainBoard }}</b></span>
      <span class="gg-chip">🈵 卡槽 <b class="mono">{{ remainSlot }}</b>/{{ SLOT_MAX }}</span>
      <span class="gg-chip">💰 通关 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <button class="gg-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="gg-stage" :style="{ width: BOARD_W + 'px', height: STAGE_H + 'px' }">
      <!-- 底部卡槽底格 -->
      <div v-for="i in SLOT_MAX" :key="'slot' + i" class="gg-slot" :style="{ left: SLOT_X0 + (i - 1) * (SLOT_SIZE + SLOT_GAP) + 'px', top: SLOT_Y + 'px', width: SLOT_SIZE + 'px', height: SLOT_SIZE + 'px' }"></div>
      <!-- 卡牌 -->
      <div
        v-for="c in cards"
        :key="c.id"
        class="gg-card"
        :class="{ covered: covered[c.id], cleared: c.cleared, slot: c.inSlot, clearing: c.clearing, hint: hintIds.includes(c.id), unlocked: c.justUnlocked }"
        :style="cardStyle(c)"
        @click="tapCard(c)"
      >
        <img class="gg-img" :src="itemImage(FRUITS[c.type].id)" :alt="FRUITS[c.type].name" @error="$event.target.style.display = 'none'" />
      </div>
    </div>

    <div class="gg-keys">
      <button class="gg-reset" @click="reset()">🔄 重置本局</button>
      <button class="gg-prop" :disabled="hintN <= 0 || won || over" @click="useHint()">💡 提示 ×{{ hintN }}</button>
      <button class="gg-prop" :disabled="shuffleN <= 0 || won || over" @click="useShuffle()">🔀 洗牌 ×{{ shuffleN }}</button>
      <button class="gg-prop" :disabled="withdrawN <= 0 || won || over" @click="useWithdraw()">↩️ 撤回 ×{{ withdrawN }}</button>
    </div>
    <div v-if="won" class="gg-done ok">🎉 全部消除通关！+{{ MODES[mode].gold }} 游戏币</div>
    <div v-else-if="over" class="gg-done">💦 卡槽已满且无法消除 —— 重置本局再来</div>

    <!-- 通关礼花 -->
    <div v-if="celebrating" class="gg-fire">
      <span v-for="i in 20" :key="i" class="gg-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
    </div>

    <div v-if="showInfo" class="gg-info-mask" @click.self="showInfo = false">
      <div class="gg-info-box">
        <div class="gg-info-head"><b>🍇 果了个果 · 十关模式说明</b><button class="gg-info-close" @click="showInfo = false">✕</button></div>
        <div class="gg-info-list">
          <div class="gg-info-row gg-info-rule">
            通用规则：点击**未被压住**的卡牌放入底部卡槽（被压住的灰色不可点）· 卡槽凑齐 3 张同款水果立即消除 ·
            消除后下层卡牌解锁 · 卡槽最多 7 格，**填满且无法消除即失败** · 清空全部卡牌通关得游戏币 ·
            道具：提示 ×2 / 洗牌 ×1 / 撤回 ×1（每局）
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="gg-info-row">
            <b class="gg-info-name">{{ m.label }}</b>
            <span class="gg-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gg-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.gg-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.gg-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.gg-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.gg-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.gg-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }

.gg-stage {
  position: relative;
  border-radius: 18px;
  background: rgba(150, 110, 70, 0.14);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
  overflow: hidden;
}
.gg-slot { position: absolute; border-radius: 10px; background: rgba(255, 251, 244, 0.5); border: 1px dashed rgba(150, 110, 70, 0.35); }
.gg-card {
  position: absolute; border-radius: 10px; cursor: pointer; user-select: none;
  background: rgba(255, 253, 248, 0.97);
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 2px 6px rgba(93, 64, 55, 0.18);
  display: flex; align-items: center; justify-content: center;
  padding: 4px;
  transition: left 0.22s ease, top 0.22s ease, width 0.18s ease, height 0.18s ease, filter 0.18s ease, opacity 0.2s ease;
}
.gg-img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.gg-card.covered { cursor: not-allowed; filter: grayscale(0.75) brightness(0.78); }
.gg-card.covered::after { content: ''; position: absolute; inset: 0; border-radius: 10px; background: rgba(90, 70, 50, 0.28); }
.gg-card.slot { cursor: default; }
.gg-card.clearing { animation: ggPop 0.24s ease forwards; }
@keyframes ggPop { 0% { transform: scale(1); } 45% { transform: scale(1.22); } 100% { transform: scale(0); opacity: 0; } }
.gg-card.cleared { opacity: 0; pointer-events: none; }
.gg-card.hint { animation: ggHint 0.5s ease 3; }
@keyframes ggHint { 0%, 100% { box-shadow: 0 2px 6px rgba(93, 64, 55, 0.18); } 50% { box-shadow: 0 0 16px rgba(232, 112, 63, 0.95); } }
.gg-card.unlocked { animation: ggIn 0.4s ease; }
@keyframes ggIn { from { opacity: 0.35; transform: scale(0.82); } to { opacity: 1; transform: scale(1); } }

.gg-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.gg-reset { padding: 9px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.gg-prop { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.gg-prop:disabled { opacity: 0.45; cursor: not-allowed; }
.gg-done { font-weight: 800; color: var(--bad-strong); }
.gg-done.ok { color: var(--good-strong); }
.gg-fire { position: fixed; inset: 0; z-index: 320; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.gg-spark { position: absolute; font-size: 22px; color: var(--gold); animation: ggSpark 1.1s ease-out forwards; }
@keyframes ggSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.gg-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.gg-info-box { width: min(600px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.gg-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.gg-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.gg-info-list { display: flex; flex-direction: column; gap: 8px; }
.gg-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.gg-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.6; }
.gg-info-name { flex: 0 0 108px; color: var(--primary-strong); }
.gg-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
