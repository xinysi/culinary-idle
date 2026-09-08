<script setup>
// 垂钓渔翁（2026-09-09 重制）：蓄力抛投 → 咬钩提竿 → 收线角力（星露谷式判定条）
// 画面：分时段天空/远山/分层水面/波光/气泡/鱼群拖影/鱼竿鱼线/粒子 · 玩法：深度分区（越深越稀有）+ 连击加分 · 十模式
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 画布 / 水域几何 ──
const W = 420
const H = 560
const SKY_H = 78
const WATER_TOP = 86
const WATER_BOTTOM = 548
const ROD_TIP = { x: W - 54, y: 46 }
const ROD_BASE = { x: W + 52, y: H + 46 }
const HOOK_R = 7
const TAU = Math.PI * 2
const BAR = { x: 376, w: 26, y: 172, h: 316 } // 收线判定条
const METER = { x: 362, w: 7, y: 172, h: 316 } // 收线进度条
const PLAYER_MAX = 1.42 // 判定条最大速度（条高/秒），鱼速以此为基准设上界

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const rand = (a, b) => a + Math.random() * (b - a)
// 圆角矩形路径（ctx.roundRect 在部分 Chromium 内核不存在，统一用 arcTo 兼容实现）
function rr(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.arcTo(x + w, y, x + w, y + h, k)
  ctx.arcTo(x + w, y + h, x, y + h, k)
  ctx.arcTo(x, y + h, x, y, k)
  ctx.arcTo(x, y, x + w, y, k)
  ctx.closePath()
}

// ── 稀有度 ──
const RARITY = {
  0: { name: '普通', color: '#8aa06a', glow: 'rgba(138,160,106,0.30)' },
  1: { name: '稀有', color: '#4f8fd9', glow: 'rgba(79,143,217,0.45)' },
  2: { name: '史诗', color: '#9a7ae0', glow: 'rgba(154,122,224,0.50)' },
  3: { name: '传说', color: '#e0a13a', glow: 'rgba(224,161,58,0.55)' },
}
// 稀有度 → 出没深度带（0 表层 / 1 水底）：越稀有越靠底
const DEPTH_BAND = { 0: [0.06, 0.52], 1: [0.18, 0.70], 2: [0.40, 0.90], 3: [0.55, 1.0] }

// ── 鱼类体系（图鉴真实鱼类图片；分值/速度/权重按稀有度）──
const FISH = [
  { id: 'crucian', name: '鲫鱼', r: 0, score: 10, speed: 40, weight: 30, size: 46 },
  { id: 'fishing_ext_01', name: '沙丁鱼', r: 0, score: 15, speed: 54, weight: 28, size: 43 },
  { id: 'fishing_ext2_03', name: '银鱼', r: 0, score: 18, speed: 66, weight: 26, size: 40 },
  { id: 'carp', name: '鲤鱼', r: 1, score: 30, speed: 78, weight: 12, size: 54 },
  { id: 'fishing_ext2_11', name: '草鱼', r: 1, score: 45, speed: 92, weight: 10, size: 57 },
  { id: 'tuna', name: '金枪鱼', r: 1, score: 55, speed: 104, weight: 8, size: 62 },
  { id: 'eel', name: '鳗鱼', r: 2, score: 80, speed: 128, weight: 4, size: 65 },
  { id: 'abalone', name: '鲍鱼', r: 2, score: 90, speed: 140, weight: 3, size: 51 },
  { id: 'bluefin', name: '蓝鳍金枪鱼', r: 2, score: 100, speed: 150, weight: 2.5, size: 70 },
  { id: 'fishing_ext2_28', name: '花蟹', r: 3, score: 120, speed: 164, weight: 1, size: 54 },
  { id: 'fishing_ext_28', name: '黑鱼', r: 3, score: 130, speed: 172, weight: 0.8, size: 68 },
  { id: 'goldenDragonFish', name: '金龙鱼', r: 3, score: 150, speed: 180, weight: 0.6, size: 73 },
]

// ── 十模式（时长 × 目标分 × 稀有倾向 × 判定条宽 × 鱼挣扎强度 × 咬钩窗口）──
const MODES = {
  m1: { label: '模式1', dur: 30, target: 230, gold: 35, rm: 1.0, zoneH: 86, spd: 0.85, fs: 0.3, win: 1.0, desc: '30 秒 · 目标 230 分 · 平静浅滩（普通鱼为主）· +35 币' },
  m2: { label: '模式2', dur: 40, target: 310, gold: 45, rm: 1.1, zoneH: 82, spd: 0.9, fs: 0.333, win: 0.95, desc: '40 秒 · 目标 310 分 · +45 币' },
  m3: { label: '模式3', dur: 50, target: 385, gold: 60, rm: 1.2, zoneH: 78, spd: 1.0, fs: 0.367, win: 0.9, desc: '50 秒 · 目标 385 分 · 稀有鱼开始活跃 · +60 币' },
  m4: { label: '模式4', dur: 60, target: 590, gold: 75, rm: 1.35, zoneH: 74, spd: 1.05, fs: 0.4, win: 0.85, desc: '60 秒 · 目标 590 分 · +75 币' },
  m5: { label: '模式5', dur: 60, target: 590, gold: 85, rm: 1.5, zoneH: 70, spd: 1.15, fs: 0.433, win: 0.8, desc: '60 秒 · 目标 590 分 · 深水鱼群成形 · +85 币' },
  m6: { label: '模式6', dur: 75, target: 735, gold: 105, rm: 1.65, zoneH: 66, spd: 1.25, fs: 0.467, win: 0.75, desc: '75 秒 · 目标 735 分 · +105 币' },
  m7: { label: '模式7', dur: 75, target: 735, gold: 115, rm: 1.8, zoneH: 62, spd: 1.35, fs: 0.5, win: 0.7, desc: '75 秒 · 目标 735 分 · 史诗鱼增多 · +115 币' },
  m8: { label: '模式8', dur: 90, target: 880, gold: 140, rm: 2.0, zoneH: 58, spd: 1.45, fs: 0.533, win: 0.65, desc: '90 秒 · 目标 880 分 · +140 币' },
  m9: { label: '模式9', dur: 90, target: 880, gold: 150, rm: 2.2, zoneH: 54, spd: 1.55, fs: 0.567, win: 0.6, desc: '90 秒 · 目标 880 分 · 传说鱼概率提升 · +150 币' },
  m10: { label: '模式10', dur: 120, target: 1175, gold: 200, rm: 2.5, zoneH: 50, spd: 1.7, fs: 0.6, win: 0.55, desc: '120 秒 · 目标 1175 分 · 高稀有度扎堆的深潭 · +200 币' },
}

// ── 十时段配色（模式1→10：清晨→正午→黄昏→夜钓→深海→碧波→金波）──
const PALETTES = [
  { sky: ['#c9e7f6', '#fdf1e0'], sun: '#ffe9a8', sunX: 0.78, water: ['#6cc2de', '#2f8ab0', '#175471'], hills: '#9dc2cf', hills2: '#7fa8ba', label: '清晨' },
  { sky: ['#a6d8f2', '#e2f3fb'], sun: '#fffbe0', sunX: 0.72, water: ['#55b0d8', '#2076a4', '#124a68'], hills: '#8fb8c9', hills2: '#6f9cb0', label: '正午' },
  { sky: ['#bfe0f0', '#ffeccc'], sun: '#ffe0a0', sunX: 0.30, water: ['#4fa8cf', '#1f6f96', '#10455f'], hills: '#93b6c6', hills2: '#749cb2', label: '午后' },
  { sky: ['#f7c78e', '#fbe7c8'], sun: '#ffd27a', sunX: 0.24, water: ['#d59a6d', '#8a5f7e', '#403a63'], hills: '#a98a92', hills2: '#7c6a86', label: '黄昏' },
  { sky: ['#9d86b8', '#e8bda6'], sun: '#ffc98a', sunX: 0.20, water: ['#6b6a9a', '#3d3f6b', '#232848'], hills: '#6d6a90', hills2: '#4c4a72', label: '暮色' },
  { sky: ['#1d2547', '#3a3f6b'], sun: '#e8eeff', sunX: 0.76, water: ['#24405c', '#16293f', '#0c1725'], hills: '#2c3a5e', hills2: '#1d2942', label: '夜钓' },
  { sky: ['#141f3a', '#2a3757'], sun: '#dfe8ff', sunX: 0.28, water: ['#1d3450', '#112136', '#08111c'], hills: '#22304e', hills2: '#162034', label: '月夜' },
  { sky: ['#2a5a7a', '#84bcd6'], sun: '#d8f0ff', sunX: 0.70, water: ['#2f7fa0', '#175a7c', '#0a3548'], hills: '#3f6f86', hills2: '#2c586e', label: '深海' },
  { sky: ['#cfeef0', '#eafaf7'], sun: '#eafff2', sunX: 0.66, water: ['#4fc4b0', '#1f8f88', '#0d5c5a'], hills: '#8fc9bd', hills2: '#6aa9a0', label: '碧波' },
  { sky: ['#f5d9a8', '#fdf2d8'], sun: '#ffe6a6', sunX: 0.30, water: ['#e0a94f', '#a06a2c', '#57351a'], hills: '#c9a469', hills2: '#a07f4c', label: '金波' },
]

// ── 响应式状态 ──
const canvas = ref(null)
const mode = ref('m1')
const score = ref(0)
const timeLeft = ref(30)
const over = ref(false)
const passed = ref(false)
const caughtList = ref([]) // { id, name, r, score, n }
const showInfo = ref(false)
const hint = ref('')
const started = ref(false)
const combo = ref(0)
const maxCombo = ref(0)
const baitN = ref(1)
const speedN = ref(1)
const best = computed(() => player.minigames?.fishing?.best ?? 0)
const modeIdx = computed(() => Math.max(0, Number(mode.value.slice(1)) - 1))
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)
const goldText = computed(() => {
  const m = MODES[mode.value]
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

// ── 内部状态（非响应式）──
let fish = []
let particles = [] // { x,y,vx,vy,life,max,kind,color,size }
let floats = [] // { x,y,text,life,max,color }
let bubbles = []
let ripples = [] // { x,y,life,max }
let hook = { x: ROD_TIP.x, y: ROD_TIP.y, tx: ROD_TIP.x, ty: ROD_TIP.y, t: 0, inWater: false }
let phase = 'ready' // ready|charge|sink|wait|bite|fight|land|escape
let charge = 0
let aimX = W / 2
let power = 0
let biteT = 0
let biteMax = 1
let biteFish = null
let fight = null
let landT = 0
let landFrom = null
let escapeT = 0
let streak = 0
let baitUntil = 0
let speedOn = false
let spawnAccum = 0
let timeAccum = 0
let waveT = 0
let running = false
let overFlag = false
let lastTs = 0
let loopId = null
let held = false
let nextId = 1
let pointerX = 0
let pointerY = 0
let downPos = null
let downAt = 0
let reelT = 0
let reelFrom = null

const IMGS = FISH.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})

// ── 音效 ──
let soundCtx = null
function beep(freq, dur, type = 'sine', vol = 0.08) {
  if (!player.settings?.soundEnabled) return
  try {
    soundCtx = soundCtx ?? new (window.AudioContext || window.webkitAudioContext)()
    const o = soundCtx.createOscillator()
    const g = soundCtx.createGain()
    o.type = type
    o.frequency.value = freq
    o.connect(g)
    g.connect(soundCtx.destination)
    g.gain.setValueAtTime(vol, soundCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + dur)
    o.start()
    o.stop(soundCtx.currentTime + dur)
  } catch { /* 无音频环境忽略 */ }
}

// ── 鱼群生成 ──
function pickFish() {
  const m = MODES[mode.value]
  const bait = performance.now() < baitUntil
  const pool = FISH.map((f, i) => {
    let w = f.weight * Math.pow(m.rm, f.r)
    if (bait && f.r > 0) w *= 3
    return { i, w }
  })
  const total = pool.reduce((s, p) => s + p.w, 0)
  let r = Math.random() * total
  for (const p of pool) { r -= p.w; if (r <= 0) return p.i }
  return 0
}
function spawnFish() {
  if (fish.length >= 15) return
  const i = pickFish()
  const base = FISH[i]
  const band = DEPTH_BAND[base.r]
  const dir = Math.random() < 0.5 ? 1 : -1
  const usable = WATER_BOTTOM - WATER_TOP - 40
  const y = WATER_TOP + 20 + lerp(band[0], band[1], Math.random()) * usable
  fish.push({
    key: nextId++, i, id: base.id, name: base.name, r: base.r, score: base.score,
    speed: base.speed, size: base.size,
    dir, x: dir > 0 ? -base.size : W + base.size, y, baseY: y,
    amp: rand(3, 9), wob: rand(0.9, 1.7), seed: rand(0, TAU), t: 0,
    migT: rand(1.5, 4), migTarget: y, life: rand(11, 24), leaveDir: 1, dead: false,
    state: 'swim', fleeT: 0, caught: false,
  })
}

// ── 输入 ──
function toCanvas(e) {
  const cv = canvas.value
  const rect = cv.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  }
}
function onDown(e) {
  if (!running || overFlag || !started.value) return
  const p = toCanvas(e)
  held = true
  pointerX = p.x
  pointerY = p.y
  downPos = { x: p.x, y: p.y }
  downAt = performance.now()
  if (phase === 'ready') {
    phase = 'charge'
    charge = 0
    aimX = clamp(p.x, 44, W - 44)
    hint.value = '松手抛竿！（蓄力越满抛得越深，深水鱼更稀有）'
    beep(520, 0.05)
  } else if (phase === 'bite') {
    strike()
  } else if (phase === 'wait' || phase === 'sink') {
    beep(660, 0.04, 'triangle', 0.04)
  }
}
function onMove(e) {
  if (!running || overFlag || !started.value) return
  const p = toCanvas(e)
  pointerX = p.x
  pointerY = p.y
  if (phase === 'charge') {
    aimX = clamp(p.x, 44, W - 44)
  } else if (phase === 'wait' && hook.inWater) {
    hook.tx = clamp(p.x, 30, W - 30)
  }
}
function onUp() {
  if (!held) return
  held = false
  if (phase === 'charge') { cast(); downPos = null; return }
  // 轻点（未拖动）→ 收杆
  if (downPos && (phase === 'wait' || phase === 'sink')) {
    const moved = Math.hypot(pointerX - downPos.x, pointerY - downPos.y)
    if (moved < 10 && performance.now() - downAt < 450) reelIn()
  }
  downPos = null
}
// ── 收杆（空钩回收）──
function reelIn() {
  if (phase !== 'wait' && phase !== 'sink') return
  phase = 'reel'
  reelT = 0
  reelFrom = { x: hook.x, y: hook.y }
  hook.inWater = false
  hint.value = '收杆中…'
  beep(320, 0.1, 'sine', 0.05)
}

// ── 抛竿 / 咬钩 / 提竿 ──
function cast() {
  power = clamp(charge / 0.9, 0, 1)
  hook.x = ROD_TIP.x
  hook.y = ROD_TIP.y
  hook.tx = aimX
  hook.ty = WATER_TOP + 34 + power * (WATER_BOTTOM - WATER_TOP - 84)
  hook.t = 0
  hook.inWater = false
  phase = 'sink'
  hint.value = '鱼钩下潜中…'
  beep(720, 0.07)
}
function splash(x, y, n = 8, kind = 'drop') {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: rand(-70, 70), vy: rand(-160, -40), life: 0, max: rand(0.4, 0.8),
      kind, color: 'rgba(255,255,255,0.9)', size: rand(1.4, 3),
    })
  }
  ripples.push({ x, y, life: 0, max: 0.7 })
}
function startBite(f) {
  const m = MODES[mode.value]
  const bait = performance.now() < baitUntil
  phase = 'bite'
  biteFish = f
  biteMax = m.win * (bait ? 1.3 : 1)
  biteT = biteMax
  f.state = 'nibble'
  hint.value = '！咬钩了 —— 点击提竿！'
  beep(980, 0.06, 'square', 0.06)
}
function missStrike() {
  const f = biteFish
  if (f) { f.state = 'flee'; f.fleeT = 2.6 }
  biteFish = null
  streak = 0
  combo.value = 0
  phase = 'wait'
  hint.value = '鱼跑了…再来一次'
  floats.push({ x: hook.x, y: hook.y - 14, text: '跑掉了', life: 0, max: 0.9, color: '#e06a5a' })
  beep(220, 0.18, 'sawtooth', 0.05)
}
function strike() {
  if (!biteFish) return
  const f = biteFish
  const m = MODES[mode.value]
  const zoom = (speedOn ? 1.4 : 1) * (1 - 0.03 * f.r)
  // 鱼速上界：不超过判定条最大速度的 fs 倍（fs 随模式递增），保证「有难度但可赢」
  const ampY = 0.34 + 0.02 * f.r
  const peak = PLAYER_MAX * clamp(m.fs * (1 + 0.05 * f.r), 0.2, 0.62)
  fight = {
    f,
    fy: 0.5, phase: rand(0, TAU), phase2: rand(0, TAU), seed2: rand(0, TAU),
    omega: peak / (ampY + 0.182), ampY,
    zy: 0.5, zvy: 0,
    prog: 0.4,
    zoneH: clamp((m.zoneH / BAR.h) * zoom, 0.07, 0.42),
    t: 0,
  }
  f.state = 'hooked'
  phase = 'fight'
  biteFish = null
  hint.value = '按住让绿条上浮，把鱼保持在绿条内！'
  beep(620, 0.08, 'triangle')
}

// ── 结算一次捕获 ──
function recordCatch(f, gain) {
  const hit = caughtList.value.find((c) => c.id === f.id)
  if (hit) hit.n++
  else caughtList.value = [...caughtList.value, { id: f.id, name: f.name, r: f.r, score: gain, n: 1 }]
}
function landFish() {
  const f = fight.f
  streak++
  combo.value = streak
  maxCombo.value = Math.max(maxCombo.value, streak)
  const mult = 1 + Math.min(0.5, 0.1 * (streak - 1))
  const gain = Math.round(f.score * mult)
  score.value += gain
  recordCatch(f, gain)
  floats.push({ x: hook.x, y: hook.y - 10, text: `+${gain}`, life: 0, max: 1.0, color: RARITY[f.r].color })
  if (streak >= 2) floats.push({ x: hook.x, y: hook.y - 30, text: `连击 ×${streak}`, life: 0, max: 1.0, color: '#e0a13a' })
  for (let i = 0; i < 14; i++) {
    particles.push({ x: hook.x, y: hook.y, vx: rand(-90, 90), vy: rand(-140, -20), life: 0, max: rand(0.4, 0.9), kind: 'spark', color: RARITY[f.r].color, size: rand(1.5, 3) })
  }
  splash(hook.x, WATER_TOP, 6)
  f.caught = true
  f.state = 'land'
  landFrom = { x: hook.x, y: hook.y }
  landT = 0
  phase = 'land'
  hook.inWater = false
  beep(880, 0.09)
  setTimeout(() => beep(1180, 0.09), 80)
  if (f.r >= 3) setTimeout(() => beep(1568, 0.16), 170)
}
function escapeFish() {
  const f = fight.f
  streak = 0
  combo.value = 0
  f.state = 'flee'
  f.fleeT = 3
  f.caught = false
  fight = null
  phase = 'escape'
  escapeT = 0.8
  hook.inWater = false
  floats.push({ x: hook.x, y: hook.y - 10, text: '断线！', life: 0, max: 1.0, color: '#e06a5a' })
  splash(hook.x, hook.y, 10)
  hint.value = '线断了…连击清零'
  beep(180, 0.26, 'sawtooth', 0.06)
}

// ── 主循环 ──
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  waveT += dt
  if (running && !overFlag) {
    const m = MODES[mode.value]
    // 倒计时（点击「开始游戏」后才开始计时）
    if (started.value) {
      timeAccum += dt
      if (timeAccum >= 1) {
        timeAccum -= 1
        timeLeft.value = Math.max(0, timeLeft.value - 1)
        if (timeLeft.value <= 0) settle()
      }
    }
    // 蓄力（松手事件丢失时兜底：未按住即视为松手）
    if (phase === 'charge') {
      charge = Math.min(1, charge + dt)
      if (!held) cast()
    }
    // 鱼钩
    if (phase === 'sink') {
      hook.t += dt / (0.26 + 0.4 * power)
      const k = Math.min(1, hook.t)
      hook.x = lerp(ROD_TIP.x, hook.tx, k)
      hook.y = lerp(ROD_TIP.y, hook.ty, k) - Math.sin(k * Math.PI) * (46 + 40 * power)
      if (k >= 1) {
        hook.inWater = true
        hook.y = hook.ty
        phase = 'wait'
        hint.value = '静待鱼咬钩（拖动移动鱼钩 · 点击水面收杆）'
        splash(hook.x, WATER_TOP, 7)
        beep(420, 0.09, 'sine', 0.05)
      }
    } else if (phase === 'wait' && hook.inWater) {
      hook.x = lerp(hook.x, hook.tx, 0.08)
      hook.y = hook.ty + Math.sin(waveT * 1.6) * 2.2
    }
    // 咬钩窗口
    if (phase === 'bite') {
      biteT -= dt
      if (biteT <= 0) missStrike()
    }
    // 收线角力
    if (phase === 'fight' && fight) updateFight(dt, m)
    // 上岸动画
    if (phase === 'land') {
      landT += dt
      if (landT >= 0.62) {
        phase = 'ready'
        fight = null
        landFrom = null
        resetHook()
        hint.value = '按住水面蓄力抛竿'
      }
    }
    if (phase === 'escape') {
      escapeT -= dt
      if (escapeT <= 0) {
        phase = 'ready'
        resetHook()
        hint.value = '按住水面蓄力抛竿'
      }
    }
    // 收杆动画
    if (phase === 'reel' && reelFrom) {
      reelT += dt
      const k = Math.min(1, reelT / 0.4)
      const e = 1 - (1 - k) * (1 - k)
      hook.x = lerp(reelFrom.x, ROD_TIP.x, e)
      hook.y = lerp(reelFrom.y, ROD_TIP.y, e)
      if (k >= 1) {
        phase = 'ready'
        reelFrom = null
        resetHook()
        hint.value = '按住水面蓄力抛竿'
      }
    }
    // 鱼群
    updateFish(dt, m)
    // 刷鱼
    spawnAccum += dt
    if (spawnAccum >= 0.5) { spawnAccum = 0; spawnFish() }
  }
  updateFx(dt)
  draw()
}
function resetHook() {
  hook.x = ROD_TIP.x
  hook.y = ROD_TIP.y
  hook.tx = ROD_TIP.x
  hook.ty = ROD_TIP.y
  hook.inWater = false
  hook.t = 0
}

function updateFish(dt, m) {
  const bait = performance.now() < baitUntil
  // 诱鱼半径：鱼饵期间大幅提升；不再按深度衰减（深水鱼少本身就构成平衡）
  const attractR = (bait ? 230 : 150)
  for (const f of fish) {
    f.t += dt
    if (f.state === 'hooked') {
      f.x = lerp(f.x, hook.x, 0.25)
      f.y = lerp(f.y, hook.y + 6, 0.25)
      continue
    }
    if (f.state === 'land') continue
    if (f.state === 'nibble') {
      // 咬钩中：贴着鱼钩抖动
      f.x = lerp(f.x, hook.x - f.dir * 15, 0.3)
      f.y = lerp(f.y, hook.y + Math.sin(waveT * 9 + f.seed) * 3, 0.3)
      continue
    }
    if (f.state === 'leave') {
      f.x += f.leaveDir * f.speed * 1.5 * dt
      if (f.x < -f.size || f.x > W + f.size) f.dead = true
      continue
    }
    if (f.state === 'flee') {
      f.fleeT -= dt
      if (f.fleeT <= 0) f.state = 'swim'
    }
    // 生命周期：到点后主动离场，避免鱼池被固定深度的鱼占满
    f.life -= dt
    if (f.life <= 0 && f.state === 'swim') {
      f.state = 'leave'
      f.leaveDir = f.x < W / 2 ? -1 : 1
      continue
    }
    const spd = f.speed * m.spd * (f.state === 'flee' ? 1.9 : f.state === 'approach' ? 0.85 : 1)
    // 水平游动
    f.x += f.dir * spd * dt
    if (f.x < f.size * 0.6) { f.x = f.size * 0.6; f.dir = 1 }
    if (f.x > W - f.size * 0.6) { f.x = W - f.size * 0.6; f.dir = -1 }
    // 垂直迁移：缓慢改变巡游深度，让整条水柱都活跃
    f.migT -= dt
    if (f.migT <= 0) {
      f.migT = rand(2.4, 5.5)
      f.migTarget = clamp(f.baseY + rand(-150, 150), WATER_TOP + 18, WATER_BOTTOM - 18)
    }
    f.baseY = lerp(f.baseY, f.migTarget, 0.55 * dt)
    f.baseY = clamp(f.baseY, WATER_TOP + 16, WATER_BOTTOM - 16)
    f.y = f.baseY + Math.sin(f.t * f.wob + f.seed) * f.amp
    // 靠近鱼钩
    if (hook.inWater && phase !== 'fight' && phase !== 'land' && f.state !== 'flee' && f.state !== 'nibble') {
      const dx = hook.x - f.x
      const dy = hook.y - f.y
      const d = Math.hypot(dx, dy)
      if (d < attractR) {
        f.state = 'approach'
        f.dir = Math.sign(dx) || f.dir
        const step = Math.min(Math.abs(dx), spd * 1.15 * dt)
        f.x += Math.sign(dx) * step
        f.baseY = clamp(f.baseY + Math.sign(dy) * Math.min(Math.abs(dy), spd * 0.9 * dt), WATER_TOP + 16, WATER_BOTTOM - 16)
        f.migTarget = f.baseY
        if (d < 26 && phase === 'wait') {
          startBite(f)
          f.x = lerp(f.x, hook.x - Math.sign(dx || 1) * 14, 0.6)
        }
      } else if (f.state === 'approach') {
        f.state = 'swim'
      }
    }
  }
  // 回收：被钓走 / 已离场
  fish = fish.filter((f) => f.state !== 'land' && !f.caught && !f.dead)
}

function updateFight(dt, m) {
  const f = fight
  f.t += dt
  // 鱼：双正弦巡游（速度有上界、可预判；主正弦 + 2.6 倍频小幅摆动）
  f.phase += dt * f.omega
  f.phase2 += dt * f.omega * 2.6
  const tgt = 0.5 + Math.sin(f.phase) * f.ampY + Math.sin(f.phase2 + f.seed2) * 0.07
  f.fy = clamp(tgt, 0.04, 0.96)
  // 玩家判定条（按住上浮 / 松开下沉；zy 越小越靠上）
  if (held) f.zvy -= 9.5 * dt
  else f.zvy += 8 * dt
  f.zvy *= 0.9
  f.zy = clamp(f.zy + f.zvy * dt, 0.03, 0.97)
  // 进度
  const inZone = Math.abs(f.fy - f.zy) < f.zoneH / 2
  f.prog += (inZone ? 0.36 : -0.28) * dt
  if (!inZone && Math.random() < dt * 26) {
    particles.push({ x: rand(BAR.x - 8, BAR.x + BAR.w + 8), y: rand(BAR.y + 20, BAR.y + BAR.h - 20), vx: rand(-30, 30), vy: rand(-50, -10), life: 0, max: 0.4, kind: 'spark', color: '#e0a13a', size: 2 })
  }
  if (f.prog >= 1) { f.prog = 1; landFish() }
  else if (f.prog <= 0) escapeFish()
}

function updateFx(dt) {
  for (const p of particles) {
    p.life += dt
    p.vy += (p.kind === 'spark' ? 120 : 420) * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
  particles = particles.filter((p) => p.life < p.max)
  for (const f of floats) { f.life += dt; f.y -= 26 * dt }
  floats = floats.filter((f) => f.life < f.max)
  for (const r of ripples) r.life += dt
  ripples = ripples.filter((r) => r.life < r.max)
  // 气泡
  if (bubbles.length < 26 && Math.random() < dt * 22) {
    bubbles.push({ x: rand(10, W - 10), y: WATER_BOTTOM - rand(0, 40), r: rand(1.2, 3.2), sp: rand(14, 34), ph: rand(0, TAU) })
  }
  for (const b of bubbles) {
    b.y -= b.sp * dt
    b.x += Math.sin(waveT * 2 + b.ph) * 6 * dt
  }
  bubbles = bubbles.filter((b) => b.y > WATER_TOP + 6)
}

// ── 绘制 ──
function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const pal = PALETTES[modeIdx.value]
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  ctx.clearRect(0, 0, W, H)
  drawSky(ctx, pal)
  drawHills(ctx, pal)
  drawWater(ctx, pal, dark)
  drawBubbles(ctx)
  drawFishAll(ctx)
  drawLineAndHook(ctx, pal)
  drawParticles(ctx)
  drawFloats(ctx)
  if (phase === 'charge') drawCharge(ctx)
  if (phase === 'bite') drawBiteRing(ctx)
  if (phase === 'fight' && fight) drawFightBar(ctx)
  drawHud(ctx, pal)
  if (dark) { ctx.fillStyle = 'rgba(10,18,32,0.30)'; ctx.fillRect(0, 0, W, H) }
  drawVignette(ctx)
}
function drawSky(ctx, pal) {
  const g = ctx.createLinearGradient(0, 0, 0, SKY_H + 10)
  g.addColorStop(0, pal.sky[0])
  g.addColorStop(1, pal.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, SKY_H + 10)
  // 日/月 + 光芒
  const sx = pal.sunX * W
  const sy = 30
  const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, 96)
  halo.addColorStop(0, pal.sun)
  halo.addColorStop(0.22, pal.sun + 'aa')
  halo.addColorStop(0.55, pal.sun + '33')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(sx, sy, 96, 0, TAU)
  ctx.fill()
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = pal.sun
  ctx.lineWidth = 2
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + waveT * 0.12
    const r1 = 20 + Math.sin(waveT * 1.6 + i) * 3
    const r2 = r1 + 12 + ((i * 7) % 10)
    ctx.beginPath()
    ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1)
    ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2)
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = pal.sun
  ctx.beginPath()
  ctx.arc(sx, sy, 16, 0, TAU)
  ctx.fill()
  // 云（缓慢漂移）
  const drift = (waveT * 6) % (W + 160)
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 137 + drift) % (W + 160)) - 80
    const cy = 14 + ((i * 53) % 34)
    const s = 0.7 + ((i * 37) % 40) / 100
    ctx.beginPath()
    ctx.ellipse(cx, cy, 26 * s, 8 * s, 0, 0, TAU)
    ctx.ellipse(cx + 18 * s, cy - 4 * s, 18 * s, 6.5 * s, 0, 0, TAU)
    ctx.ellipse(cx - 20 * s, cy + 2 * s, 15 * s, 5.5 * s, 0, 0, TAU)
    ctx.fill()
  }
  // 飞鸟
  ctx.strokeStyle = 'rgba(60,70,90,0.35)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const bx = 60 + i * 46 + Math.sin(waveT * 0.4 + i) * 12
    const by = 26 + ((i * 17) % 20)
    const w = 4.5
    ctx.beginPath()
    ctx.moveTo(bx - w, by)
    ctx.quadraticCurveTo(bx - w / 2, by - 3.2, bx, by)
    ctx.quadraticCurveTo(bx + w / 2, by - 3.2, bx + w, by)
    ctx.stroke()
  }
}
function drawHills(ctx, pal) {
  const base = WATER_TOP + 1
  const layer = (color, amp, off, alpha) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, base)
    for (let x = 0; x <= W; x += 6) {
      const y = base - amp * (0.55 + 0.45 * Math.sin(x * 0.017 + off))
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, base)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  layer(pal.hills, 30, 1.2, 0.62)
  layer(pal.hills2, 17, 3.1, 0.88)
  // 远岸树影
  ctx.globalAlpha = 0.5
  ctx.fillStyle = pal.hills2
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 47
    const h = 8 + ((i * 29) % 11)
    ctx.beginPath()
    ctx.moveTo(x - 5, base - 6)
    ctx.lineTo(x, base - 6 - h)
    ctx.lineTo(x + 5, base - 6)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
function drawWater(ctx, pal, dark) {
  const g = ctx.createLinearGradient(0, WATER_TOP, 0, H)
  g.addColorStop(0, pal.water[0])
  g.addColorStop(0.45, pal.water[1])
  g.addColorStop(1, pal.water[2])
  ctx.fillStyle = g
  ctx.fillRect(0, WATER_TOP, W, H - WATER_TOP)
  // 深度分区明暗：浅水偏亮、深水偏暗
  const usable0 = WATER_BOTTOM - WATER_TOP
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.fillRect(0, WATER_TOP, W, usable0 * 0.33)
  ctx.fillStyle = 'rgba(0,22,44,0.06)'
  ctx.fillRect(0, WATER_TOP + usable0 * 0.33, W, usable0 * 0.33)
  ctx.fillStyle = 'rgba(0,16,36,0.13)'
  ctx.fillRect(0, WATER_TOP + usable0 * 0.66, W, usable0 * 0.34)
  // 水面反光带（远山倒影）
  ctx.globalAlpha = 0.22
  ctx.fillStyle = pal.hills2
  ctx.fillRect(0, WATER_TOP + 2, W, 12)
  ctx.globalAlpha = 1
  // 水下光柱（从日光位置斜射下来）
  const sx = pal.sunX * W
  ctx.save()
  ctx.globalAlpha = 0.1
  for (let i = 0; i < 5; i++) {
    const bx = sx - 60 + i * 30 + Math.sin(waveT * 0.5 + i) * 10
    const w = 16 + ((i * 13) % 14)
    const g2 = ctx.createLinearGradient(bx, WATER_TOP, bx, H)
    g2.addColorStop(0, pal.sun)
    g2.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g2
    ctx.beginPath()
    ctx.moveTo(bx, WATER_TOP)
    ctx.lineTo(bx + w, WATER_TOP)
    ctx.lineTo(bx + w * 2.6, H)
    ctx.lineTo(bx + w * 0.6, H)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // 日光柱（波光）
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 26; i++) {
    const yy = WATER_TOP + 10 + ((i * 37) % (H - WATER_TOP - 20))
    const len = 12 + ((i * 53) % 26)
    const jitter = Math.sin(waveT * 2.4 + i * 1.7) * 14
    ctx.fillStyle = `rgba(255,255,255,${0.10 + ((i * 29) % 22) / 100})`
    ctx.fillRect(sx - len / 2 + jitter, yy, len, 1.6)
  }
  ctx.globalAlpha = 1
  // 光斑（焦散）
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 131 + waveT * 11) % (W + 120)) - 60
    const cy = WATER_TOP + 60 + ((i * 97) % (H - WATER_TOP - 120))
    const rr = 70 + ((i * 43) % 50)
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr)
    cg.addColorStop(0, 'rgba(255,255,255,0.10)')
    cg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, TAU)
    ctx.fill()
  }
  // 波纹线
  for (let i = 0; i < 9; i++) {
    const y = WATER_TOP + 18 + i * ((H - WATER_TOP - 26) / 9)
    const a = 0.16 * (1 - i / 11) * (dark ? 0.7 : 1)
    ctx.strokeStyle = `rgba(255,255,255,${a})`
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= W; x += 14) {
      const yy = y + Math.sin((x * 0.028) + waveT * 1.5 + i * 0.8) * (2 + (i % 3))
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  // 水面亮线
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let x = 0; x <= W; x += 10) {
    const yy = WATER_TOP + Math.sin(x * 0.05 + waveT * 2) * 1.8
    x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
  }
  ctx.stroke()
  // 深度分区参考线
  const usable = WATER_BOTTOM - WATER_TOP
  ctx.setLineDash([4, 8])
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  for (const t of [0.33, 0.66]) {
    const y = WATER_TOP + usable * t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(24, y)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '9px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('浅', 4, WATER_TOP + usable * 0.16)
  ctx.fillText('中', 4, WATER_TOP + usable * 0.5)
  ctx.fillText('深', 4, WATER_TOP + usable * 0.84)
}
function drawBubbles(ctx) {
  for (const b of bubbles) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.45, 0, TAU)
    ctx.fill()
  }
}
function drawFishAll(ctx) {
  for (const f of fish) {
    if (f.state === 'land') continue
    drawFish(ctx, f, 1)
  }
  // 上岸飞行中的鱼
  if (phase === 'land' && landFrom && fight?.f) {
    const k = Math.min(1, landT / 0.62)
    const x = lerp(landFrom.x, ROD_TIP.x, k)
    const y = lerp(landFrom.y, ROD_TIP.y, k) - Math.sin(k * Math.PI) * 46
    const f = fight.f
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.5 + k * 0.6)
    const s = f.size * 1.05
    ctx.drawImage(IMGS[f.i], -s / 2, -s / 2, s, s)
    ctx.restore()
    if (Math.random() < 0.6) particles.push({ x, y, vx: rand(-20, 20), vy: rand(-30, 10), life: 0, max: 0.5, kind: 'spark', color: RARITY[f.r].color, size: rand(1.2, 2.4) })
  }
}
function drawFish(ctx, f, alpha) {
  const im = IMGS[f.i]
  const bob = Math.sin(f.t * 2.1 + f.seed) * (f.r >= 2 ? 2.4 : 1.5)
  const rot = Math.sin(f.t * 2.6 + f.seed) * 0.045
  const s = f.size
  const y = f.y + bob
  // 水底投影
  ctx.save()
  ctx.globalAlpha = 0.16 * alpha
  ctx.fillStyle = '#03151f'
  ctx.beginPath()
  ctx.ellipse(f.x, f.y + s * 0.52, s * 0.4, s * 0.12, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
  // 快速游动拖影
  const fast = f.state === 'flee' || f.state === 'approach'
  if (fast) {
    for (let i = 1; i <= 2; i++) {
      ctx.save()
      ctx.globalAlpha = 0.16 / i
      ctx.translate(f.x - f.dir * i * 9, y)
      if (f.dir < 0) ctx.scale(-1, 1)
      ctx.drawImage(im, -s / 2, -s / 2, s, s)
      ctx.restore()
    }
  }
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(f.x, y)
  if (f.dir < 0) ctx.scale(-1, 1)
  ctx.rotate(rot)
  // 稀有鱼光晕
  if (f.r >= 1) {
    const gr = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 0.78)
    gr.addColorStop(0, RARITY[f.r].glow)
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.78, 0, TAU)
    ctx.fill()
  }
  if (im && im.complete && im.naturalWidth) {
    ctx.drawImage(im, -s / 2, -s / 2, s, s)
  } else {
    ctx.fillStyle = RARITY[f.r].color
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.45, s * 0.24, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  // 传说鱼闪光
  if (f.r === 3 && Math.random() < 0.22) {
    particles.push({ x: f.x + rand(-s / 2, s / 2), y: y + rand(-s / 3, s / 3), vx: 0, vy: -18, life: 0, max: 0.55, kind: 'spark', color: '#ffe08a', size: rand(1.2, 2.2) })
  }
}
function quadPt(p0, c, p1, t) {
  const mt = 1 - t
  return { x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x, y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y }
}
function drawLineAndHook(ctx, pal) {
  const tension = phase === 'fight' && fight ? clamp(Math.abs(fight.fy - fight.zy) * 2, 0, 1) : 0
  const bend = tension * 7
  const tip = { x: ROD_TIP.x - bend * 0.6, y: ROD_TIP.y + bend * 0.3 }
  const base = { x: ROD_BASE.x, y: ROD_BASE.y }
  const ctrl = { x: W + 10, y: H * 0.52 + bend * 1.6 }
  // 竿身：按曲线分段绘制，由粗到细
  const N = 26
  let prev = base
  for (let i = 1; i <= N; i++) {
    const t = i / N
    const p = quadPt(base, ctrl, tip, t)
    ctx.strokeStyle = i < 4 ? '#5a3a20' : '#7a5230'
    ctx.lineWidth = lerp(10.5, 2.8, t)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    prev = p
  }
  // 竿身高光
  ctx.strokeStyle = 'rgba(255,232,200,0.30)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  let hp = quadPt(base, ctrl, tip, 0.1)
  ctx.moveTo(hp.x - 2, hp.y - 3)
  for (let i = 2; i <= N; i++) {
    const p = quadPt(base, ctrl, tip, i / N)
    ctx.lineTo(p.x - 1, p.y - 1.5)
  }
  ctx.stroke()
  // 卷线器
  const rp = quadPt(base, ctrl, tip, 0.14)
  ctx.fillStyle = '#c9a86a'
  ctx.beginPath()
  ctx.arc(rp.x - 5, rp.y + 4, 8.5, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#6b4a2a'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(rp.x - 7, rp.y + 2, 2.2, 0, TAU)
  ctx.fill()
  // 鱼线（带垂度）
  const dist = Math.hypot(hook.x - tip.x, hook.y - tip.y)
  const sag = Math.min(46, dist * 0.11) * (phase === 'fight' ? 0.2 : 1)
  const mx = (tip.x + hook.x) / 2
  const my = (tip.y + hook.y) / 2 + sag
  ctx.strokeStyle = phase === 'fight' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)'
  ctx.lineWidth = phase === 'fight' ? 1.5 : 1
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.quadraticCurveTo(mx, my, hook.x, hook.y)
  ctx.stroke()
  // 浮漂（鱼钩入水时停在钩的 x 处）
  if (hook.inWater) {
    const bx = hook.x
    const by = WATER_TOP - 1 + Math.sin(waveT * 2.2) * 1.4
    ctx.save()
    ctx.translate(bx, by)
    ctx.fillStyle = '#e2604a'
    ctx.beginPath()
    ctx.ellipse(0, -4, 4.4, 5.6, 0, Math.PI, TAU)
    ctx.fill()
    ctx.fillStyle = '#fdf6ec'
    ctx.beginPath()
    ctx.ellipse(0, -4, 4.4, 5.6, 0, 0, Math.PI)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,40,30,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, -4, 4.4, 5.6, 0, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = '#3a2a20'
    ctx.fillRect(-1, -12, 2, 5)
    ctx.restore()
    // 浮漂涟漪
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(bx, WATER_TOP + 2, 12 + Math.sin(waveT * 3) * 2.5, 3.4, 0, 0, TAU)
    ctx.stroke()
  }
  // 鱼钩
  drawHook(ctx, tension)
}
function drawHook(ctx, tension) {
  const x = hook.x
  const y = hook.y
  if (!hook.inWater && phase !== 'sink' && phase !== 'charge' && phase !== 'ready') return
  ctx.save()
  ctx.translate(x, y)
  if (phase === 'fight') ctx.rotate(Math.sin(waveT * 22) * 0.12 * (1 - tension * 0.5))
  // 饵
  const wig = Math.sin(waveT * 6) * 1.2
  ctx.fillStyle = '#e2604a'
  ctx.beginPath()
  ctx.ellipse(0, 6 + wig, 4.6, 3.4, 0.3, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.beginPath()
  ctx.arc(-1.4, 5 + wig, 1.2, 0, TAU)
  ctx.fill()
  // 钩身
  ctx.strokeStyle = '#e8eef5'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, HOOK_R, -0.35, Math.PI - 0.5)
  ctx.stroke()
  // 倒刺
  ctx.strokeStyle = '#c9d4e0'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(HOOK_R * Math.cos(-0.35), HOOK_R * Math.sin(-0.35))
  ctx.lineTo(HOOK_R * Math.cos(-0.35) - 2.4, HOOK_R * Math.sin(-0.35) - 2.2)
  ctx.stroke()
  // 高光
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.arc(-0.6, -0.6, HOOK_R - 1.6, -0.1, 1.2)
  ctx.stroke()
  ctx.restore()
  // 入水涟漪
  if (hook.inWater) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x, WATER_TOP + 1, 9 + Math.sin(waveT * 3) * 2, 3, 0, 0, TAU)
    ctx.stroke()
  }
}
function drawCharge(ctx) {
  // 力度条
  const bx = 22
  const by = 150
  const bh = 190
  ctx.fillStyle = 'rgba(20,30,44,0.35)'
  rr(ctx, bx - 4, by - 4, 14, bh + 8, 7)
  ctx.fill()
  const k = clamp(charge / 0.9, 0, 1)
  const g = ctx.createLinearGradient(0, by + bh, 0, by)
  g.addColorStop(0, '#7fd08a')
  g.addColorStop(0.6, '#e8c34a')
  g.addColorStop(1, '#e2604a')
  ctx.fillStyle = g
  rr(ctx, bx, by + bh * (1 - k), 6, bh * k, 3)
  ctx.fill()
  // 预估落点
  const ty = WATER_TOP + 34 + k * (WATER_BOTTOM - WATER_TOP - 84)
  ctx.setLineDash([5, 6])
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(aimX, WATER_TOP)
  ctx.lineTo(aimX, ty)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(aimX, ty, 4, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(aimX, ty, 8 + Math.sin(waveT * 6) * 2, 0, TAU)
  ctx.stroke()
}
function drawBiteRing(ctx) {
  const k = 1 - biteT / biteMax
  ctx.save()
  ctx.translate(hook.x, hook.y)
  ctx.strokeStyle = `rgba(255,214,90,${0.9 - k * 0.6})`
  ctx.lineWidth = 3 - k * 1.6
  ctx.beginPath()
  ctx.arc(0, 0, 14 + k * 22, 0, TAU)
  ctx.stroke()
  // 「！」
  ctx.fillStyle = '#ffd65a'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'rgba(60,40,10,0.65)'
  ctx.lineWidth = 3
  const yy = -34 - Math.sin(waveT * 10) * 2
  ctx.strokeText('!', 0, yy)
  ctx.fillText('!', 0, yy)
  ctx.restore()
  // 咬钩剩余时间条
  const w = 46
  const x = clamp(hook.x - w / 2, 6, W - w - 6)
  ctx.fillStyle = 'rgba(20,30,44,0.5)'
  rr(ctx, x, hook.y + 16, w, 5, 2.5)
  ctx.fill()
  ctx.fillStyle = '#ffd65a'
  rr(ctx, x, hook.y + 16, w * (biteT / biteMax), 5, 2.5)
  ctx.fill()
}
function drawFightBar(ctx) {
  const f = fight
  // 面板
  ctx.fillStyle = 'rgba(18,30,44,0.42)'
  rr(ctx, BAR.x - 5, BAR.y - 8, BAR.w + 10, BAR.h + 16, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 判定区
  const zy = BAR.y + (f.zy - f.zoneH / 2) * BAR.h
  const zh = f.zoneH * BAR.h
  const inZone = Math.abs(f.fy - f.zy) < f.zoneH / 2
  ctx.fillStyle = inZone ? 'rgba(126,214,150,0.55)' : 'rgba(126,214,150,0.28)'
  rr(ctx, BAR.x, clamp(zy, BAR.y, BAR.y + BAR.h - zh), BAR.w, zh, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(180,255,205,0.75)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  // 鱼
  const fy = BAR.y + f.fy * BAR.h
  ctx.save()
  ctx.translate(BAR.x + BAR.w / 2, clamp(fy, BAR.y + 10, BAR.y + BAR.h - 10))
  if (f.f.dir < 0) ctx.scale(-1, 1)
  const s = Math.min(24, f.f.size * 0.52)
  const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 0.8)
  gr.addColorStop(0, RARITY[f.f.r].glow)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gr
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.8, 0, TAU)
  ctx.fill()
  if (IMGS[f.f.i]?.complete) ctx.drawImage(IMGS[f.f.i], -s / 2, -s / 2, s, s)
  ctx.restore()
  // 进度条
  ctx.fillStyle = 'rgba(18,30,44,0.5)'
  rr(ctx, METER.x, METER.y, METER.w, METER.h, 4)
  ctx.fill()
  const pg = ctx.createLinearGradient(0, METER.y + METER.h, 0, METER.y)
  pg.addColorStop(0, '#7fd08a')
  pg.addColorStop(1, '#ffd65a')
  ctx.fillStyle = pg
  const ph = METER.h * clamp(f.prog, 0, 1)
  rr(ctx, METER.x, METER.y + METER.h - ph, METER.w, ph, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  rr(ctx, METER.x, METER.y, METER.w, METER.h, 4)
  ctx.stroke()
  // 张力提示
  if (!inZone) {
    ctx.fillStyle = 'rgba(255,120,90,0.9)'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('张力！', METER.x + 2, BAR.y - 14)
  }
}
function drawParticles(ctx) {
  for (const p of particles) {
    const t = 1 - p.life / p.max
    ctx.globalAlpha = Math.max(0, t)
    if (p.kind === 'spark') {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * t, 0, TAU)
      ctx.fill()
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, TAU)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  for (const r of ripples) {
    const t = r.life / r.max
    ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.55})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.ellipse(r.x, r.y, 6 + t * 30, 2.5 + t * 10, 0, 0, TAU)
    ctx.stroke()
  }
}
function drawFloats(ctx) {
  ctx.textAlign = 'center'
  for (const f of floats) {
    const t = 1 - f.life / f.max
    ctx.globalAlpha = Math.max(0, t)
    ctx.font = 'bold 15px system-ui, sans-serif'
    ctx.strokeStyle = 'rgba(30,20,10,0.55)'
    ctx.lineWidth = 3
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
}
function drawHud(ctx, pal) {
  // 时段标签
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(pal.label, 6, 14)
  // 连击
  if (streak >= 2) {
    const s = clamp(1 + Math.sin(waveT * 6) * 0.03, 0.9, 1.1)
    ctx.save()
    ctx.translate(64, 30)
    ctx.scale(s, s)
    ctx.fillStyle = 'rgba(20,30,44,0.42)'
    rr(ctx, -46, -13, 92, 24, 12)
    ctx.fill()
    ctx.fillStyle = '#ffd65a'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`🔥 连击 ×${streak}`, 0, 4)
    ctx.restore()
  }
  // 待机提示（画布内）
  if (phase === 'ready') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(started.value ? '按住水面蓄力抛竿' : '点击下方「开始游戏」', W / 2, H - 16)
  }
}
function drawVignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(10,16,26,0.34)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  const m = MODES[mode.value]
  fish = []
  particles = []
  floats = []
  bubbles = []
  ripples = []
  fight = null
  biteFish = null
  landFrom = null
  resetHook()
  phase = 'ready'
  charge = 0
  power = 0
  streak = 0
  combo.value = 0
  maxCombo.value = 0
  score.value = 0
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  caughtList.value = []
  baitN.value = 1
  speedN.value = 1
  baitUntil = 0
  speedOn = false
  spawnAccum = 0
  timeAccum = 0
  held = false
  downPos = null
  reelFrom = null
  started.value = false
  hint.value = '点击「开始游戏」后，按住水面蓄力抛竿'
  running = true
  for (let i = 0; i < 8; i++) spawnFish()
  startLoop()
}
// 点击「开始游戏」后本局才计时、才可抛竿
function startGame() {
  if (overFlag) return
  started.value = true
  timeLeft.value = MODES[mode.value].dur
  timeAccum = 0
  hint.value = '按住水面蓄力抛竿'
  beep(880, 0.08)
  setTimeout(() => beep(1175, 0.1), 90)
}
function settle() {
  if (overFlag) return
  overFlag = true
  over.value = true
  running = false
  stopLoop()
  fight = null
  biteFish = null
  phase = 'ready'
  const m = MODES[mode.value]
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const extra = Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    const gold = m.gold + extra
    player.gainGameCoins(gold)
    ui.pushLog(`🎣 垂钓渔翁：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🎣 垂钓渔翁：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mf = player.minigames
  if (!mf.fishing) mf.fishing = { best: 0 }
  mf.fishing.best = Math.max(mf.fishing.best ?? 0, score.value)
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() {
  if (loopId) clearInterval(loopId)
  loopId = null
}

// ── 道具 ──
function useBait() {
  if (baitN.value <= 0 || over.value) return
  baitN.value--
  baitUntil = performance.now() + 15000
  beep(520, 0.1)
  ui.pushLog('🎣 撒下鱼饵：15 秒内鱼更主动咬钩、稀有鱼更愿意靠近', 'info')
}
function useSpeed() {
  if (speedN.value <= 0 || over.value) return
  speedN.value--
  speedOn = true
  beep(700, 0.1)
  ui.pushLog('🎣 换上加速钩：本局判定条加宽 40%', 'info')
}

onMounted(() => {
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  reset()
})
onUnmounted(() => {
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  stopLoop()
})
</script>

<template>
  <div class="fh-page">
    <div class="fh-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="fh-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="fh-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="fh-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="fh-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="fh-chip">💰 <b class="mono">{{ MODES[mode].gold }}</b> 币</span>
      <span class="fh-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="fh-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="fh-canvas" :width="W" :height="H" @pointerdown="onDown" @pointermove="onMove"></canvas>

    <div class="fh-hint">{{ hint }}</div>

    <div class="fh-keys">
      <button v-if="!started" class="fh-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="fh-reset" @click="reset()">🔄 重置本局</button>
      <button class="fh-prop" :disabled="baitN <= 0 || over || !started" @click="useBait()">🪱 鱼饵 ×{{ baitN }}</button>
      <button class="fh-prop" :disabled="speedN <= 0 || over || !started" @click="useSpeed()">⚡ 加速钩 ×{{ speedN }}</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="fh-mask">
      <div class="fh-result">
        <div class="fh-result-head">
          <b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b>
        </div>
        <div class="fh-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ MODES[mode].target }}</span>
          <span class="dim">最高连击 ×{{ maxCombo }}</span>
          <span v-if="passed" class="fh-gold">+{{ goldText }} 游戏币</span>
        </div>
        <div class="fh-result-title">🐟 本局渔获（{{ caughtList.reduce((s, c) => s + c.n, 0) }} 条）</div>
        <div class="fh-caught">
          <div v-for="c in caughtList" :key="c.id" class="fh-caught-item" :style="{ borderColor: RARITY[c.r].color }">
            <img :src="itemImage(c.id)" alt="" @error="$event.target.style.display = 'none'" />
            <div class="fh-caught-name">{{ c.name }}</div>
            <div class="fh-caught-meta" :style="{ color: RARITY[c.r].color }">{{ RARITY[c.r].name }} · {{ c.score }}分 ×{{ c.n }}</div>
          </div>
          <div v-if="!caughtList.length" class="dim">（空军……一条也没钓到）</div>
        </div>
        <button class="fh-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="fh-fire">
        <span v-for="i in 20" :key="i" class="fh-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="fh-info-mask" @click.self="showInfo = false">
      <div class="fh-info-box">
        <div class="fh-info-head"><b>🎣 垂钓渔翁 · 十模式说明</b><button class="fh-info-close" @click="showInfo = false">✕</button></div>
        <div class="fh-info-list">
          <div class="fh-info-row fh-info-rule">
            开始：点击下方「▶ 开始游戏」后才开始计时与操作（未开始时水面鱼群会照常游动）。<br />
            玩法三步：<b>① 蓄力抛竿</b>——按住水面蓄力（左侧力度条），松手抛投；力度越大鱼钩落得越深，
            <b>深水才会出现史诗 / 传说鱼</b>。<br />
            <b>② 咬钩提竿</b>——鱼会靠近鱼钩试探，咬钩瞬间弹出「！」和倒计时条，<b>立刻点击提竿</b>；手慢鱼就跑了（连击清零）。<br />
            <b>③ 收线角力</b>——中鱼后右侧出现判定条：<b>按住</b>让绿色判定区上浮、<b>松开</b>下沉，
            把鱼保持在绿区内蓄满左侧进度条即可入护；让鱼跑出绿区进度会倒退，退到 0 就断线跑鱼。<br />
            收杆：抛竿后可<b>轻点水面收杆</b>（拖动是移动鱼钩，轻点才是收杆）；咬钩瞬间的点击优先用于提竿。<br />
            连击：连续入护不断线，单条得分最高 ×1.5（×1 → ×1.1 → … → ×1.5）。<br />
            道具：🪱 鱼饵（15 秒内鱼更主动咬钩、稀有鱼更愿意靠近）×1 · ⚡ 加速钩（本局判定条加宽 40%）×1
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="fh-info-row">
            <b class="fh-info-name">{{ m.label }}</b>
            <span class="fh-info-desc">{{ m.desc }}</span>
          </div>
          <div class="fh-info-row fh-info-rule">
            鱼类图鉴：{{ FISH.map((f) => f.name + '(' + RARITY[f.r].name + ' ' + f.score + '分)').join('、') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fh-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.fh-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.fh-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.fh-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.fh-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.fh-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.fh-canvas { width: min(420px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); cursor: crosshair; touch-action: none; }
.fh-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.fh-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.fh-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.fh-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.fh-prop { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.fh-prop:disabled { opacity: 0.45; cursor: not-allowed; }

/* 结算弹窗 */
.fh-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.fh-result { width: min(560px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.fh-result-head { font-size: 18px; }
.fh-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.fh-gold { color: var(--good-strong); font-weight: 800; }
.fh-result-title { font-size: 13px; font-weight: 800; color: var(--primary-strong); margin-top: 4px; }
.fh-caught { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.fh-caught-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px; border-radius: 12px; background: rgba(255, 251, 244, 0.9); border: 2px solid rgba(150, 110, 70, 0.25); }
.fh-caught-item img { width: 44px; height: 44px; object-fit: contain; }
.fh-caught-name { font-size: 12px; font-weight: 700; }
.fh-caught-meta { font-size: 11px; font-weight: 700; }
.fh-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.fh-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.fh-spark { position: absolute; font-size: 22px; color: var(--gold); animation: fhSpark 1.1s ease-out forwards; }
@keyframes fhSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.fh-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.fh-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.fh-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.fh-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.fh-info-list { display: flex; flex-direction: column; gap: 8px; }
.fh-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
/* 规则行含 <br> 与 <b>，必须是块级（flex 会把文本节点拆成多个弹性项，导致换行失效、排版错乱） */
.fh-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.fh-info-rule b { color: var(--primary-strong); }
.fh-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.fh-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
