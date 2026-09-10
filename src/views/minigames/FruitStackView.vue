<script setup>
// 果了个果（2026-09-09 v2 十模式差异化）：多层堆叠卡牌消除 · 卡牌数 ×5 · 每模式独立玩法
// 机制：卡槽格数（5/6/7）· 限时 · 盲盒（背面卡先翻开）· 四消（4 张同款）· 移位（定时重排位置）· 锁链（先解锁再取）
// 可解性保证：发牌按「层序 + 每 matchN 张一组」分配同一水果 → 玩家按同序取牌必可全清
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'
import { itemImage } from '../../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 基础布局常量 ──
const CELL = 60 // 单元格边长
const HALF = CELL / 2
const CARD = 56
const SLOT_SIZE = 54
const SLOT_GAP = 6

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

// ── 十模式（卡牌数约为原版 5 倍，每模式玩法不同）──
const MODES = {
  m1: { label: '1关 五格', cells: 7, layers: 3, groups: 15, matchN: 3, types: 6, slots: 5, gold: 60, desc: '45 张 · 3 层 · 卡槽仅 5 格 · +60 币' },
  m2: { label: '2关 限时', cells: 7, layers: 3, groups: 30, matchN: 3, types: 6, slots: 6, time: 110, gold: 100, desc: '90 张 · 3 层 · 限时 110 秒 · +100 币' },
  m3: { label: '3关 盲盒', cells: 7, layers: 4, groups: 45, matchN: 3, types: 7, slots: 6, blind: 0.3, gold: 150, desc: '135 张 · 4 层 · 30% 卡牌**图案隐藏**（入槽才揭晓，考验取舍）· +150 币' },
  m4: { label: '4关 四消', cells: 8, layers: 4, groups: 45, matchN: 4, types: 8, slots: 7, gold: 220, desc: '180 张 · 需 4 张同款才消除 · +220 币' },
  m5: { label: '5关 移位', cells: 8, layers: 5, groups: 75, matchN: 3, types: 8, slots: 6, shift: 8, gold: 260, desc: '225 张 · 5 层 · 每 8 秒全部卡牌重排位置 · +260 币' },
  m6: { label: '6关 锁链', cells: 8, layers: 5, groups: 90, matchN: 3, types: 9, slots: 6, lock: 0.25, gold: 300, desc: '270 张 · 5 层 · 25% 卡被锁**不可点取**（每消除一组解锁 1 张）· +300 币' },
  m7: { label: '7关 极限五格', cells: 9, layers: 6, groups: 120, matchN: 3, types: 9, slots: 5, gold: 360, desc: '360 张 · 6 层 · 卡槽 5 格 · +360 币' },
  m8: { label: '8关 限时·五格', cells: 9, layers: 6, groups: 150, matchN: 3, types: 10, slots: 5, time: 540, gold: 420, desc: '450 张 · 6 层 · 5 格 + 限时 540 秒 · +420 币' },
  m9: { label: '9关 盲盒·四消', cells: 9, layers: 7, groups: 135, matchN: 4, types: 10, slots: 7, blind: 0.25, gold: 480, desc: '540 张 · 7 层 · 四消 + 25% 背面卡 · +480 币' },
  m10: { label: '10关 地狱', cells: 9, layers: 7, groups: 168, matchN: 4, types: 12, slots: 5, blind: 0.3, shift: 12, lock: 0.2, gold: 600, desc: '672 张 · 7 层 · 5 格 + 四消 + 30% 图案隐藏 + 12 秒移位 + 20% 锁链 · +600 币' },
}
const showInfo = ref(false)

// ── 状态 ──
let nextId = 1
let shiftTimer = null
let timeTimer = null
const cards = ref([])
const slots = ref([])
const won = ref(false)
const over = ref(false)
const started = ref(false)
const busy = ref(false)
const hintN = ref(2)
const shuffleN = ref(1)
const withdrawN = ref(1)
const hintIds = ref([])
const celebrating = ref(false)
const timeLeft = ref(null)
let soundCtx = null
const mode = ref('m1')

// ── 派生布局 ──
const m = computed(() => MODES[mode.value])
const SLOT_MAX = computed(() => m.value.slots)
const BOARD_W = computed(() => m.value.cells * CELL)
const BOARD_H = computed(() => m.value.cells * CELL)
const SLOT_Y = computed(() => BOARD_H.value + 18)
const SLOT_X0 = computed(() => (BOARD_W.value - (SLOT_MAX.value * SLOT_SIZE + (SLOT_MAX.value - 1) * SLOT_GAP)) / 2)
const STAGE_H = computed(() => SLOT_Y.value + SLOT_SIZE + 6)
const MATCH_N = computed(() => m.value.matchN)

const remainBoard = computed(() => cards.value.filter((c) => !c.cleared && !c.inSlot).length)
const remainSlot = computed(() => slots.value.filter((s) => s !== null).length)
const lockedCount = computed(() => cards.value.filter((c) => c.locked && !c.cleared && !c.inSlot).length)
const hiddenCount = computed(() => cards.value.filter((c) => c.hidden && !c.cleared && !c.inSlot).length)

// ── 音效 ──
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

// ── 生成关卡（可解性保证）──
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function genLevel() {
  const cfg = m.value
  const total = cfg.groups * cfg.matchN
  // 1) 层分配（下层权重高）
  const weights = Array.from({ length: cfg.layers }, (_, i) => i + 1)
  const wSum = weights.reduce((s, v) => s + v, 0)
  const perLayer = []
  let left = total
  for (let l = 1; l <= cfg.layers; l++) {
    const n = l === cfg.layers ? left : Math.max(cfg.matchN, Math.round((total * weights[l - 1]) / wSum))
    const take = Math.min(n, left)
    perLayer.push(take)
    left -= take
  }
  // 2) 层内随机半格位置
  const maxH = cfg.cells * 2 - 1
  const positions = []
  for (let l = 1; l <= perLayer.length; l++) {
    const n = perLayer[l - 1]
    const used = new Set()
    let guard = 0
    while (used.size < n && guard < n * 30 + 200) {
      guard++
      used.add(Math.floor(Math.random() * maxH) + ',' + Math.floor(Math.random() * maxH))
    }
    for (const key of used) {
      const [hx, hy] = key.split(',').map(Number)
      positions.push({ layer: l, hx, hy })
    }
  }
  // 3) 按层序（顶层优先）排序并赋 z 序 → 每 matchN 张一组分配同一水果（可解性）
  shuffleArr(positions)
  positions.sort((a, b) => b.layer - a.layer)
  const list = positions.map((p, i) => ({
    id: nextId++, layer: p.layer, hx: p.hx, hy: p.hy, z: p.layer * 10000 + i, type: 0,
    cleared: false, inSlot: false, slotIdx: -1, clearing: false, justUnlocked: false,
    hidden: false, locked: false,
  }))
  let gi = 0
  for (let i = 0; i < list.length; i += cfg.matchN) {
    const t = gi % cfg.types
    gi++
    for (let k = 0; k < cfg.matchN && i + k < list.length; k++) list[i + k].type = t
  }
  // 4) 盲盒：图案永久隐藏（点击直接取走，入槽后才揭晓）
  if (cfg.blind) for (const c of list) if (Math.random() < cfg.blind) c.hidden = true
  // 5) 锁链：被锁卡不可点取；每消除一组解锁 1 张 —— 锁卡随机分布（顶层最多锁一半，保证开局可动）
  if (cfg.lock) {
    const cand = shuffleArr(list.filter((c) => !c.hidden))
    const nLock = Math.floor(cand.length * cfg.lock)
    const topLayer = Math.max(...list.map((c) => c.layer))
    const topCount = cand.filter((c) => c.layer === topLayer).length
    const maxTopLock = Math.floor(topCount / 2)
    let lockedTop = 0
    let left2 = nLock
    for (const c of cand) {
      if (left2 <= 0) break
      if (c.layer === topLayer && lockedTop >= maxTopLock) continue
      c.locked = true
      if (c.layer === topLayer) lockedTop++
      left2--
    }
  }
  return list
}
function stopTimers() {
  if (shiftTimer) { clearInterval(shiftTimer); shiftTimer = null }
  if (timeTimer) { clearInterval(timeTimer); timeTimer = null }
}
function reset() {
  stopTimers()
  cards.value = genLevel()
  slots.value = Array(SLOT_MAX.value).fill(null)
  won.value = false
  over.value = false
  busy.value = false
  hintN.value = 2
  shuffleN.value = 1
  withdrawN.value = 1
  hintIds.value = []
  celebrating.value = false
  started.value = false
  timeLeft.value = m.value.time ?? null
}
// 移位：未取走的场上卡牌重新随机位置（保持层与种类）
function shiftPositions() {
  const cfg = m.value
  const maxH = cfg.cells * 2 - 1
  const boardCards = cards.value.filter((c) => !c.cleared && !c.inSlot)
  const byLayer = {}
  boardCards.forEach((c) => { (byLayer[c.layer] ??= []).push(c) })
  for (const layer of Object.keys(byLayer)) {
    const used = new Set()
    for (const c of byLayer[layer]) {
      let guard = 0
      let key = ''
      do {
        key = Math.floor(Math.random() * maxH) + ',' + Math.floor(Math.random() * maxH)
        guard++
      } while (used.has(key) && guard < 80)
      used.add(key)
      const [hx, hy] = key.split(',').map(Number)
      c.hx = hx
      c.hy = hy
    }
  }
  beep(340, 0.12, 'triangle')
  ui.pushLog('🍇 果了个果：卡牌位置已重排', 'info')
}

// ── 遮挡判定 ──
// 遮挡判定（2026-09-09 收紧）：任何 z 序更高的卡压住一点（含同层后放的卡）即不可点
function isCovered(card) {
  if (card.cleared || card.inSlot) return false
  for (const o of cards.value) {
    if (o === card || o.cleared || o.inSlot) continue
    if (o.z <= card.z) continue
    if (Math.abs(o.hx - card.hx) < 2 && Math.abs(o.hy - card.hy) < 2) return true
  }
  return false
}
function canClick(card) {
  return !won.value && !over.value && !card.cleared && !card.inSlot && !card.locked && !isCovered(card)
}
const covered = computed(() => {
  cards.value.length
  const map = {}
  for (const c of cards.value) map[c.id] = isCovered(c)
  return map
})

// ── 卡槽整理 ──
function compactSlots() {
  const inSlot = slots.value
    .filter((s) => s !== null)
    .map((id) => cards.value.find((c) => c.id === id))
    .filter(Boolean)
  inSlot.sort((a, b) => a.type - b.type)
  const next = Array(SLOT_MAX.value).fill(null)
  inSlot.forEach((c, i) => { next[i] = c.id; c.slotIdx = i })
  slots.value = next
}

// ── 点击卡牌 ──
function startTimers() {
  stopTimers()
  if (m.value.time) {
    timeTimer = setInterval(() => {
      timeLeft.value--
      if (timeLeft.value <= 0 && !won.value && !over.value) { timeLeft.value = 0; fail('⏱ 时间到') }
    }, 1000)
  }
  if (m.value.shift) {
    shiftTimer = setInterval(() => {
      if (won.value || over.value) return
      shiftPositions()
    }, m.value.shift * 1000)
  }
}
function startGame() {
  if (started.value) return
  started.value = true
  startTimers()
}
function tapCard(card) {
  if (!started.value) return
  if (!canClick(card)) return
  if (card.locked) { beep(300, 0.08, 'square'); return } // 锁链：被锁卡不可点取（需消除一组解锁）
  const free = slots.value.indexOf(null)
  if (free < 0) { fail('💦 卡槽已满且无法消除'); return }
  card.inSlot = true
  card.slotIdx = free
  slots.value[free] = card.id
  slots.value = [...slots.value]
  beep(620, 0.08)
  compactSlots()
  const need = MATCH_N.value
  const byType = {}
  for (const id of slots.value) {
    if (id === null) continue
    const c = cards.value.find((x) => x.id === id)
    byType[c.type] = (byType[c.type] ?? 0) + 1
  }
  const hitType = Object.keys(byType).find((t) => byType[t] >= need)
  if (hitType !== undefined) {
    const group = slots.value
      .filter((id) => id !== null)
      .map((id) => cards.value.find((c) => c.id === id))
      .filter((c) => String(c.type) === hitType)
      .slice(0, need)
    busy.value = true
    group.forEach((c) => { c.clearing = true })
    beep(880, 0.1)
    setTimeout(() => beep(1180, 0.12), 90)
    setTimeout(() => {
      group.forEach((c) => { c.cleared = true; c.inSlot = false })
      slots.value = slots.value.map((id) => (group.some((g) => g.id === id) ? null : id))
      compactSlots()
      // 锁链：每消除一组解锁 1 张被锁卡（优先 z 序高者，即最上层）
      const lockedLeft = cards.value.filter((c) => c.locked && !c.cleared && !c.inSlot).sort((a, b) => b.z - a.z)
      if (lockedLeft.length) {
        lockedLeft[0].locked = false
        lockedLeft[0].justUnlocked = true
        beep(760, 0.1)
        ui.pushLog(`🍇 消除一组 → 解锁 1 张锁卡（剩余 ${lockedLeft.length - 1} 张）`, 'info')
      }
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
  if (remainSlot.value >= SLOT_MAX.value) { fail('💦 卡槽已满且无法消除'); return }
  if (remainBoard.value > 0 && !cards.value.some((c) => canClick(c))) {
    // 兜底：若还有锁卡（全被锁住导致无卡可点），自动解锁一张，避免不公平失败
    const lockedLeft = cards.value.filter((c) => c.locked && !c.cleared && !c.inSlot).sort((a, b) => b.z - a.z)
    if (lockedLeft.length) {
      lockedLeft[0].locked = false
      lockedLeft[0].justUnlocked = true
      ui.pushLog('🍇 无卡可点 → 自动解锁一张锁卡', 'info')
      return
    }
    fail('💦 无可点击的卡牌')
  }
}
function win() {
  won.value = true
  stopTimers()
  celebrating.value = true
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  setTimeout(() => { celebrating.value = false }, 1600)
  const gold = m.value.gold
  player.gainGameCoins(gold)
  ui.pushLog(`🍇 果了个果通关！${m.value.label} +${gold} 游戏币`, 'gain')
}
function fail(reason = '本局失败') {
  if (won.value || over.value) return
  over.value = true
  busy.value = false
  stopTimers()
  beep(160, 0.32, 'sawtooth')
  ui.pushLog(`🍇 果了个果：${reason}`, 'warn')
}

// ── 道具 ──
function useHint() {
  if (hintN.value <= 0 || won.value || over.value) return
  const need = MATCH_N.value
  const pool = cards.value.filter((c) => !c.cleared)
  const byType = {}
  pool.forEach((c) => { (byType[c.type] ??= []).push(c) })
  let group = null
  for (const t of Object.keys(byType)) {
    const g = byType[t]
    if (g.length < need) continue
    const clickable = g.filter((c) => canClick(c))
    if (clickable.length) { group = [clickable[0], ...g.filter((c) => c !== clickable[0]).slice(0, need - 1)]; break }
  }
  if (!group) group = pool.filter((c) => canClick(c)).slice(0, need)
  if (!group.length) return
  hintN.value--
  hintIds.value = group.map((c) => c.id)
  setTimeout(() => { hintIds.value = [] }, 1800)
}
function useShuffle() {
  if (shuffleN.value <= 0 || won.value || over.value || busy.value) return
  const need = MATCH_N.value
  const all = cards.value.filter((c) => !c.cleared)
  const boardCards = all.filter((c) => !c.inSlot)
  const slotCards = all.filter((c) => c.inSlot)
  if (boardCards.length < need) return
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
onUnmounted(() => stopTimers())

// ── 渲染位置 ──
function cardStyle(c) {
  if (c.inSlot) {
    return {
      left: SLOT_X0.value + c.slotIdx * (SLOT_SIZE + SLOT_GAP) + 'px',
      top: SLOT_Y.value + 'px',
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
      <button v-for="(cfg, key, idx) in MODES" :key="key" class="gg-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="gg-chip" style="margin-left: auto">🍇 场上 <b class="mono">{{ remainBoard }}</b></span>
      <span class="gg-chip">🈵 卡槽 <b class="mono">{{ remainSlot }}</b>/{{ SLOT_MAX }}</span>
      <span v-if="timeLeft !== null" class="gg-chip">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span v-if="lockedCount > 0" class="gg-chip">🔒 锁 <b class="mono">{{ lockedCount }}</b></span>
      <span v-if="hiddenCount > 0" class="gg-chip">❓ 隐藏 <b class="mono">{{ hiddenCount }}</b></span>
      <span class="gg-chip">💰 <b class="mono">{{ m.gold }}</b> 币</span>
      <button class="gg-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="gg-stage" :style="{ width: BOARD_W + 'px', height: STAGE_H + 'px' }">
      <!-- 卡槽底格 -->
      <div
        v-for="i in SLOT_MAX"
        :key="'slot' + i"
        class="gg-slot"
        :style="{ left: SLOT_X0 + (i - 1) * (SLOT_SIZE + SLOT_GAP) + 'px', top: SLOT_Y + 'px', width: SLOT_SIZE + 'px', height: SLOT_SIZE + 'px' }"
      ></div>
      <!-- 卡牌 -->
      <div
        v-for="c in cards"
        :key="c.id"
        class="gg-card"
        :class="{
          covered: covered[c.id],
          cleared: c.cleared,
          slot: c.inSlot,
          clearing: c.clearing,
          hint: hintIds.includes(c.id),
          unlocked: c.justUnlocked,
          blind: c.hidden && !c.inSlot,
          lock: c.locked,
        }"
        :style="cardStyle(c)"
        @click="tapCard(c)"
      >
        <img v-if="!c.hidden || c.inSlot" class="gg-img" :src="itemImage(FRUITS[c.type].id)" :alt="FRUITS[c.type].name" @error="$event.target.style.display = 'none'" />
        <span v-else class="gg-back">❓</span>
        <span v-if="c.locked" class="gg-lock">🔒</span>
      </div>
    </div>

    <div class="gg-keys">
      <button v-if="!started" class="gg-start" @click="startGame()">▶ 开始游戏</button>
      <button class="gg-reset" @click="reset()">🔄 重置本局</button>
      <button class="gg-prop" :disabled="hintN <= 0 || won || over" @click="useHint()">💡 提示 ×{{ hintN }}</button>
      <button class="gg-prop" :disabled="shuffleN <= 0 || won || over" @click="useShuffle()">🔀 洗牌 ×{{ shuffleN }}</button>
      <button class="gg-prop" :disabled="withdrawN <= 0 || won || over" @click="useWithdraw()">↩️ 撤回 ×{{ withdrawN }}</button>
    </div>
        <div v-if="won || over" class="gg-mask">
      <div class="gg-result">
        <div class="gg-result-head"><b>{{ won ? '🎉 全部消除通关！' : '💦 本局失败' }}</b></div>
        <div class="gg-result-score"><span v-if="won" class="gg-gold">+{{ m.gold }} 游戏币</span><span v-else>再来一局</span></div>
        <button class="gg-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="won" class="gg-fire">
        <span v-for="i in 20" :key="i" class="gg-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>
    

    <!-- 通关礼花 -->
    <div v-if="celebrating" class="gg-fire">
      <span v-for="i in 20" :key="i" class="gg-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
    </div>

    <div v-if="showInfo" class="gg-info-mask" @click.self="showInfo = false">
      <div class="gg-info-box">
        <div class="gg-info-head"><b>🍇 果了个果 · 十关模式说明</b><button class="gg-info-close" @click="showInfo = false">✕</button></div>
        <div class="gg-info-list">
          <div class="gg-info-row gg-info-rule">
            通用规则：任何被上层卡牌压住一点点的卡都不可点击（灰色显示）· 点击未被压住的卡放入卡槽 ·
            卡槽凑齐 {{ MATCH_N }} 张同款立即消除 · 消除后下层解锁 · 卡槽填满即失败 · 清空全部卡牌通关 ·
            盲盒关：图案隐藏的卡可直接取走，入槽才知种类 · 锁链关：🔒 卡不可点取，每消除一组解锁 1 张 ·
            道具：提示 ×2 / 洗牌 ×1 / 撤回 ×1
          </div>
          <div v-for="(cfg, key) in MODES" :key="key" class="gg-info-row">
            <b class="gg-info-name">{{ cfg.label }}</b>
            <span class="gg-info-desc">{{ cfg.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gg-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.gg-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.gg-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.gg-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.gg-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.gg-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}

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
  transition: left 0.28s ease, top 0.28s ease, width 0.18s ease, height 0.18s ease, filter 0.18s ease, opacity 0.2s ease;
}
.gg-img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.gg-back { font-size: 26px; opacity: 0.75; }
.gg-lock { position: absolute; right: 2px; bottom: 2px; font-size: 14px; }
.gg-card.covered { cursor: not-allowed; filter: grayscale(0.75) brightness(0.78); }
.gg-card.covered::after { content: ''; position: absolute; inset: 0; border-radius: 10px; background: rgba(90, 70, 50, 0.28); }
.gg-card.slot { cursor: default; }
.gg-card.blind { background: rgba(240, 232, 216, 0.98); }
.gg-card.lock { border-color: rgba(217, 90, 56, 0.55); }
.gg-card.clearing { animation: ggPop 0.24s ease forwards; }
@keyframes ggPop { 0% { transform: scale(1); } 45% { transform: scale(1.22); } 100% { transform: scale(0); opacity: 0; } }
.gg-card.cleared { opacity: 0; pointer-events: none; }
.gg-card.hint { animation: ggHint 0.5s ease 3; }
@keyframes ggHint { 0%, 100% { box-shadow: 0 2px 6px rgba(93, 64, 55, 0.18); } 50% { box-shadow: 0 0 16px rgba(232, 112, 63, 0.95); } }
.gg-card.unlocked { animation: ggIn 0.4s ease; }
@keyframes ggIn { from { opacity: 0.35; transform: scale(0.82); } to { opacity: 1; transform: scale(1); } }

.gg-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.gg-reset { padding: 9px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.gg-prop { padding: 9px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.gg-prop:disabled { opacity: 0.45; cursor: not-allowed; }
.gg-fire { position: fixed; inset: 0; z-index: 320; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.gg-spark { position: absolute; font-size: 22px; color: var(--gold); animation: ggSpark 1.1s ease-out forwards; }
@keyframes ggSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.gg-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.gg-info-box {
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
.gg-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.gg-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.gg-info-list { display: flex; flex-direction: column; gap: 8px; }
.gg-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.gg-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.7;
  display: block;
}
.gg-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.gg-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── gg 结算弹窗（2026-09-09 统一）── */
.gg-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.gg-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.gg-result-head { font-size: 18px; }
.gg-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.gg-gold { color: var(--good-strong); font-weight: 800; }
.gg-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.gg-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.gg-spark { position: absolute; font-size: 22px; color: var(--gold); animation: ggSpark 1.1s ease-out forwards; }
@keyframes ggSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

/* ── gg 开始门控（2026-09-09）── */
.gg-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
</style>
