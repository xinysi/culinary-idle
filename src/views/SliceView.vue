<script setup>
// 切菜大师（2026-09-09 新增，第 16 款）：水果忍者式划切——食材从下方抛起，按住拖动划开得分
// 连击加成 · 锅盖是干扰物（切到扣 1 命）· 漏切不扣命只断连击 · 十模式（时长/出料率/同屏/抛速/干扰物比例）
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 画布 ──
const W = 420
const H = 560
const GRAV = 900
const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rand = (a, b) => a + Math.random() * (b - a)

// ── 食材（图鉴真实图片；分值/权重/半径）──
const ING = [
  { id: 'apple', name: '苹果', score: 10, w: 22, r: 34 },
  { id: 'carrot', name: '胡萝卜', score: 12, w: 20, r: 34 },
  { id: 'tomato', name: '番茄', score: 15, w: 18, r: 33 },
  { id: 'strawberry', name: '草莓', score: 18, w: 16, r: 30 },
  { id: 'grape', name: '葡萄', score: 22, w: 12, r: 30 },
  { id: 'pineapple', name: '菠萝', score: 28, w: 8, r: 38 },
  { id: 'mango', name: '芒果', score: 35, w: 5, r: 34 },
  { id: 'watermelon', name: '西瓜', score: 45, w: 3, r: 40 },
]

// ── 十模式（时长 × 出料率 × 同屏上限 × 抛速 × 干扰物比例 × 目标分）──
const MODES = {
  m1: { label: '模式1', dur: 30, rate: 1.15, max: 3, spd: 1.0, decoy: 0, target: 280, gold: 35, desc: '30 秒 · 目标 280 分 · 慢出料、无干扰 · +35 币' },
  m2: { label: '模式2', dur: 40, rate: 1.3, max: 4, spd: 1.05, decoy: 0.04, target: 420, gold: 45, desc: '40 秒 · 目标 420 分 · 开始出现锅盖 · +45 币' },
  m3: { label: '模式3', dur: 45, rate: 1.45, max: 4, spd: 1.1, decoy: 0.06, target: 530, gold: 55, desc: '45 秒 · 目标 530 分 · +55 币' },
  m4: { label: '模式4', dur: 50, rate: 1.6, max: 5, spd: 1.15, decoy: 0.08, target: 650, gold: 65, desc: '50 秒 · 目标 650 分 · +65 币' },
  m5: { label: '模式5', dur: 55, rate: 1.75, max: 5, spd: 1.2, decoy: 0.09, target: 780, gold: 75, desc: '55 秒 · 目标 780 分 · 出料明显变快 · +75 币' },
  m6: { label: '模式6', dur: 60, rate: 1.9, max: 6, spd: 1.25, decoy: 0.1, target: 920, gold: 85, desc: '60 秒 · 目标 920 分 · +85 币' },
  m7: { label: '模式7', dur: 65, rate: 2.05, max: 6, spd: 1.3, decoy: 0.11, target: 1080, gold: 95, desc: '65 秒 · 目标 1080 分 · +95 币' },
  m8: { label: '模式8', dur: 75, rate: 2.2, max: 7, spd: 1.35, decoy: 0.12, target: 1340, gold: 110, desc: '75 秒 · 目标 1340 分 · 高分食材更多 · +110 币' },
  m9: { label: '模式9', dur: 85, rate: 2.4, max: 7, spd: 1.4, decoy: 0.13, target: 1650, gold: 125, desc: '85 秒 · 目标 1650 分 · +125 币' },
  m10: { label: '模式10', dur: 100, rate: 2.6, max: 8, spd: 1.5, decoy: 0.15, target: 2100, gold: 150, desc: '100 秒 · 目标 2100 分 · 满屏乱飞的厨房 · +150 币' },
}
const showInfo = ref(false)

// ── 十套背景（每个模式一套，程序化绘制；浅色为主，保证食材看得清）──
const BG = [
  { name: '木案板', base: ['#f7e8d3', '#dcbf9a'], pattern: 'planks', tint: 'rgba(120,80,40,' },
  { name: '大理石台', base: ['#f6f7f9', '#dde2e8'], pattern: 'marble', tint: 'rgba(150,160,175,' },
  { name: '青瓷台面', base: ['#e9f5f2', '#c2ded7'], pattern: 'glaze', tint: 'rgba(110,150,140,' },
  { name: '竹席', base: ['#f4ecd4', '#d8c79a'], pattern: 'bamboo', tint: 'rgba(140,110,50,' },
  { name: '铁板烧', base: ['#3d4147', '#22252a'], pattern: 'iron', tint: 'rgba(200,210,220,' },
  { name: '石桌', base: ['#e2e4e0', '#bfc3bd'], pattern: 'stone', tint: 'rgba(120,126,120,' },
  { name: '白瓷砖', base: ['#fcfcfc', '#e4e7ea'], pattern: 'tile', tint: 'rgba(160,170,180,' },
  { name: '深色石板', base: ['#4d4e52', '#2d2e32'], pattern: 'slate', tint: 'rgba(180,186,196,' },
  { name: '红木桌', base: ['#8d4c2f', '#5d2e1b'], pattern: 'wood', tint: 'rgba(230,170,120,' },
  { name: '夜市摊', base: ['#1e2c47', '#0e192b'], pattern: 'night', tint: 'rgba(255,210,140,' },
]
const modeIdx = computed(() => Math.max(0, Number(mode.value.slice(1)) - 1))
// 确定性伪随机（同一模式每帧图案一致）
function makeRng(seed) {
  let s = (seed >>> 0) || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
// 热气粒子（预生成一次，按 sin 曲线淡入淡出，循环无跳变）
const STEAM = Array.from({ length: 9 }, () => ({
  x: rand(30, W - 30),
  ph: Math.random(),
  sp: rand(0.09, 0.2),
  r: rand(18, 40),
  wob: rand(0, TAU),
}))

// ── 响应式状态 ──
const canvas = ref(null)
const mode = ref('m1')
const score = ref(0)
const timeLeft = ref(30)
const lives = ref(3)
const combo = ref(0)
const maxCombo = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const best = computed(() => player.minigames?.slice?.best ?? 0)
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)
const goldText = computed(() => {
  const m = MODES[mode.value]
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

// ── 内部状态 ──
let items = [] // { kind:'ing'|'decoy', i, x, y, vx, vy, r, rot, rotV, sliced }
let halves = [] // 切开的半块
let sparks = [] // 粒子
let floats = [] // 飘字
let trail = [] // { x, y, t }
let slicing = false
let lastPoint = null
let spawnAccum = 0
let timeAccum = 0
let waveT = 0
let shake = 0
let comboAt = 0
let graceT = 0 // 锅盖受伤后的短暂无敌
let running = false
let overFlag = false
let lastTs = 0
let loopId = null

const IMGS = ING.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})
const imgOf = (i) => IMGS[i]

// ── 音效 ──
let soundCtx = null
function beep(freq, dur, type = 'sine', vol = 0.07) {
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

// ── 出料 ──
function pickIng() {
  const total = ING.reduce((s, f) => s + f.w, 0)
  let r = Math.random() * total
  for (let i = 0; i < ING.length; i++) { r -= ING[i].w; if (r <= 0) return i }
  return 0
}
function spawn() {
  const m = MODES[mode.value]
  const decoy = Math.random() < m.decoy
  const x = rand(70, W - 70)
  const vx = (W / 2 - x) * rand(0.15, 0.4) + rand(-40, 40)
  const vy = -rand(830, 990) * m.spd
  if (decoy) {
    items.push({ kind: 'decoy', i: -1, x, y: H + 44, vx, vy, r: 34, rot: 0, rotV: rand(-1.4, 1.4), sliced: false })
  } else {
    const i = pickIng()
    items.push({ kind: 'ing', i, x, y: H + 44, vx, vy, r: ING[i].r, rot: rand(0, TAU), rotV: rand(-2.2, 2.2), sliced: false })
  }
}

// ── 输入：按住拖动形成刀锋轨迹 ──
function toCanvas(e) {
  const cv = canvas.value
  const rect = cv.getBoundingClientRect()
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
}
function onDown(e) {
  if (!running || overFlag || !started.value) return
  slicing = true
  const p = toCanvas(e)
  lastPoint = p
  trail.push({ x: p.x, y: p.y, t: performance.now() })
}
function onMove(e) {
  if (!running || overFlag || !started.value || !slicing) return
  const p = toCanvas(e)
  if (lastPoint) {
    trail.push({ x: p.x, y: p.y, t: performance.now() })
    if (trail.length > 26) trail.shift()
    checkSlice(lastPoint, p)
  }
  lastPoint = p
}
function onUp() {
  slicing = false
  lastPoint = null
}
// 线段与圆相交 → 切开
function checkSlice(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  for (const it of items) {
    if (it.sliced || it.y > H + 30) continue
    let t = 0
    if (len2 > 0) t = clamp(((it.x - a.x) * dx + (it.y - a.y) * dy) / len2, 0, 1)
    const px = a.x + dx * t
    const py = a.y + dy * t
    const d = Math.hypot(it.x - px, it.y - py)
    if (d <= it.r * 0.9) sliceItem(it, Math.atan2(dy, dx))
  }
}
function sliceItem(it, cutAngle) {
  it.sliced = true
  if (it.kind === 'decoy') {
    // 切到锅盖：扣 1 命 + 断连击 + 震屏（0.9 秒无敌，避免一刀划到两个锅盖连掉两命）
    combo.value = 0
    shake = 1
    if (graceT <= 0) {
      lives.value--
      graceT = 0.9
      floats.push({ x: it.x, y: it.y, text: '锅盖！-1 ❤', life: 0, max: 1.0, color: '#e06a5a' })
      beep(150, 0.28, 'sawtooth', 0.09)
      if (lives.value <= 0) settle()
    } else {
      floats.push({ x: it.x, y: it.y, text: '锅盖！', life: 0, max: 0.8, color: '#e06a5a' })
      beep(190, 0.14, 'sawtooth', 0.05)
    }
    for (let i = 0; i < 12; i++) {
      sparks.push({ x: it.x, y: it.y, vx: rand(-140, 140), vy: rand(-180, 20), life: 0, max: rand(0.3, 0.7), color: '#cfd8e0', size: rand(1.5, 3) })
    }
    return
  }
  // 连击窗口 0.8 秒
  const now = performance.now()
  combo.value = now - comboAt < 800 ? combo.value + 1 : 1
  comboAt = now
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  const mult = 1 + Math.min(0.5, 0.1 * (combo.value - 1))
  const gain = Math.round(ING[it.i].score * mult)
  score.value += gain
  floats.push({ x: it.x, y: it.y - 6, text: `+${gain}`, life: 0, max: 0.9, color: '#ffd65a' })
  if (combo.value >= 3) floats.push({ x: it.x, y: it.y - 30, text: `连击 ×${combo.value}`, life: 0, max: 0.9, color: '#7fd08a' })
  // 两个半块朝刀锋法线方向分开
  const nx = Math.cos(cutAngle + Math.PI / 2)
  const ny = Math.sin(cutAngle + Math.PI / 2)
  for (const side of [-1, 1]) {
    halves.push({
      i: it.i, x: it.x, y: it.y, r: it.r, cutAngle, side,
      vx: it.vx * 0.5 + nx * side * rand(90, 170), vy: it.vy * 0.4 + ny * side * rand(90, 170),
      rot: it.rot, rotV: it.rotV + side * rand(1.5, 3.5), life: 0, max: 1.1,
    })
  }
  for (let i = 0; i < 10; i++) {
    sparks.push({ x: it.x, y: it.y, vx: rand(-160, 160), vy: rand(-160, 60), life: 0, max: rand(0.3, 0.6), color: '#ffe08a', size: rand(1.4, 2.8) })
  }
  beep(760 + combo.value * 60, 0.06, 'triangle', 0.06)
}

// ── 主循环 ──
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  waveT += dt
  if (running && !overFlag) {
    const m = MODES[mode.value]
    if (started.value) {
      timeAccum += dt
      if (timeAccum >= 1) {
        timeAccum -= 1
        timeLeft.value = Math.max(0, timeLeft.value - 1)
        if (timeLeft.value <= 0) settle()
      }
      // 连击窗口过期
      if (combo.value > 0 && performance.now() - comboAt > 800) combo.value = 0
      // 出料
      spawnAccum += dt
      const interval = 1 / m.rate
      if (spawnAccum >= interval) {
        spawnAccum = 0
        const alive = items.filter((x) => !x.sliced && x.y < H + 20).length
        if (alive < m.max) spawn()
      }
    }
    // 食材飞行
    for (const it of items) {
      it.x += it.vx * dt
      it.y += it.vy * dt
      it.vy += GRAV * dt
      it.rot += it.rotV * dt
    }
    items = items.filter((it) => !it.sliced && it.y < H + 70)
    // 半块
    for (const h of halves) {
      h.life += dt
      h.x += h.vx * dt
      h.y += h.vy * dt
      h.vy += GRAV * dt
      h.rot += h.rotV * dt
    }
    halves = halves.filter((h) => h.life < h.max)
  }
  // 粒子/飘字/轨迹
  for (const s of sparks) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 620 * dt }
  sparks = sparks.filter((s) => s.life < s.max)
  for (const f of floats) { f.life += dt; f.y -= 30 * dt }
  floats = floats.filter((f) => f.life < f.max)
  const tNow = performance.now()
  trail = trail.filter((p) => tNow - p.t < 220)
  if (shake > 0) shake = Math.max(0, shake - dt * 3)
  if (graceT > 0) graceT = Math.max(0, graceT - dt)
  draw()
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

// ── 绘制 ──
function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 7, rand(-1, 1) * shake * 7)
  drawBackdrop(ctx, dark)
  // 半块（在整颗下面）
  for (const h of halves) drawHalf(ctx, h)
  // 食材
  for (const it of items) drawItem(ctx, it)
  drawTrail(ctx)
  drawSparks(ctx)
  drawFloats(ctx)
  drawHud(ctx, dark)
  ctx.restore()
}
function drawBackdrop(ctx, dark) {
  const bg = BG[modeIdx.value]
  const rng = makeRng(modeIdx.value * 7919 + 13)
  // 1) 底色渐变
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, bg.base[0])
  g.addColorStop(1, bg.base[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // 2) 纹理
  const p = bg.pattern
  if (p === 'planks' || p === 'wood') {
    const ph = p === 'wood' ? 92 : 64
    for (let i = 0; i < Math.ceil(H / ph) + 1; i++) {
      const y = i * ph
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(0, y, W, ph)
      ctx.strokeStyle = bg.tint + '0.35)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      for (let k = 0; k < 5; k++) {
        const yy = y + 10 + rng() * (ph - 20)
        ctx.strokeStyle = bg.tint + (0.1 + rng() * 0.12) + ')'
        ctx.lineWidth = 1 + rng() * 1.6
        ctx.beginPath()
        ctx.moveTo(0, yy)
        for (let x = 0; x <= W; x += 26) ctx.lineTo(x, yy + Math.sin(x * 0.018 + rng() * 3) * 2.5)
        ctx.stroke()
      }
      if (rng() < 0.45) {
        const kx = rng() * W
        const ky = y + ph * 0.5
        ctx.strokeStyle = bg.tint + '0.3)'
        ctx.lineWidth = 2
        for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(kx, ky, k * 3.4, k * 2.2, 0, 0, TAU); ctx.stroke() }
      }
    }
  } else if (p === 'marble') {
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = bg.tint + (0.16 + rng() * 0.2) + ')'
      ctx.lineWidth = 1 + rng() * 2.6
      ctx.beginPath()
      let x = -30
      let y = rng() * H
      ctx.moveTo(x, y)
      while (x < W + 30) { x += 26 + rng() * 54; y += (rng() - 0.5) * 70; ctx.lineTo(x, y) }
      ctx.stroke()
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = bg.tint + (0.08 + rng() * 0.18) + ')'
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 1 + rng() * 2.2, 0, TAU); ctx.fill()
    }
  } else if (p === 'glaze') {
    for (let i = 0; i < 5; i++) {
      const cx = rng() * W
      const cy = rng() * H
      const rg = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190 + rng() * 130)
      rg.addColorStop(0, 'rgba(255,255,255,0.26)')
      rg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = rg
      ctx.beginPath(); ctx.arc(cx, cy, 340, 0, TAU); ctx.fill()
    }
    ctx.strokeStyle = bg.tint + '0.22)'
    ctx.lineWidth = 1
    for (let i = 0; i < 16; i++) {
      let x = rng() * W
      let y = rng() * H
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 60; y += (rng() - 0.5) * 60; ctx.lineTo(x, y) }
      ctx.stroke()
    }
  } else if (p === 'bamboo') {
    const sw = 26
    for (let x = 0; x < W; x += sw) {
      ctx.fillStyle = ((x / sw) | 0) % 2 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.07)'
      ctx.fillRect(x, 0, sw, H)
      ctx.strokeStyle = bg.tint + '0.34)'
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.strokeStyle = bg.tint + '0.24)'
    ctx.lineWidth = 1.4
    for (let y = 44; y < H; y += 92) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  } else if (p === 'iron') {
    for (let i = 0; i < 110; i++) {
      ctx.strokeStyle = bg.tint + (0.02 + rng() * 0.05) + ')'
      ctx.lineWidth = 1
      const y = rng() * H
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    const hg = ctx.createRadialGradient(W / 2, H * 0.82, 30, W / 2, H * 0.82, 340)
    hg.addColorStop(0, 'rgba(255,120,40,0.26)')
    hg.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = hg
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath()
      ctx.ellipse(rng() * W, rng() * H, 18 + rng() * 44, 5 + rng() * 10, rng() * 3, 0, TAU)
      ctx.fill()
    }
  } else if (p === 'stone') {
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = bg.tint + (0.06 + rng() * 0.2) + ')'
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 1 + rng() * 3.4, 0, TAU); ctx.fill()
    }
    ctx.strokeStyle = bg.tint + '0.18)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 6; i++) {
      let x = rng() * W
      let y = rng() * H
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 90; y += (rng() - 0.5) * 70; ctx.lineTo(x, y) }
      ctx.stroke()
    }
  } else if (p === 'tile') {
    const cs = 68
    ctx.strokeStyle = bg.tint + '0.45)'
    ctx.lineWidth = 2
    for (let x = 0; x <= W; x += cs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += cs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 1 + rng() * 2, 0, TAU); ctx.fill()
    }
  } else if (p === 'slate') {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = bg.tint + (0.04 + rng() * 0.1) + ')'
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 1 + rng() * 3, 0, TAU); ctx.fill()
    }
    ctx.strokeStyle = bg.tint + '0.22)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 9; i++) {
      let x = rng() * W
      let y = rng() * H
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 70; y += (rng() - 0.5) * 90; ctx.lineTo(x, y) }
      ctx.stroke()
    }
  } else if (p === 'night') {
    // 夜市灯串
    for (let i = 0; i < 9; i++) {
      const bx = 26 + i * 46
      const by = 24 + Math.sin(i * 1.1) * 10
      const gg = ctx.createRadialGradient(bx, by, 2, bx, by, 54)
      gg.addColorStop(0, 'rgba(255,214,120,0.85)')
      gg.addColorStop(0.3, 'rgba(255,190,90,0.32)')
      gg.addColorStop(1, 'rgba(255,190,90,0)')
      ctx.fillStyle = gg
      ctx.beginPath(); ctx.arc(bx, by, 54, 0, TAU); ctx.fill()
      ctx.fillStyle = '#ffe6a8'
      ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, TAU); ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,220,160,0.35)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 18 + Math.sin(x * 0.03) * 6)
    ctx.stroke()
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 1 + rng() * 2, 0, TAU); ctx.fill()
    }
  }
  // 3) 台面收边（底部）
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.28)' : 'rgba(90,60,30,0.16)'
  ctx.fillRect(0, H - 96, W, 96)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, H - 96); ctx.lineTo(W, H - 96); ctx.stroke()
  // 4) 氛围：热气（预生成 + sin 淡入淡出，平滑循环不跳帧）
  for (const s of STEAM) {
    const t = (waveT * s.sp + s.ph) % 1
    const a = Math.sin(t * Math.PI) * (dark ? 0.1 : 0.17)
    if (a <= 0.004) continue
    const rr = s.r * (0.7 + t * 1.0)
    const cx = s.x + Math.sin(waveT * 0.5 + s.wob) * 22
    const cy = H - 56 - t * 270
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr)
    sg.addColorStop(0, `rgba(255,255,255,${a})`)
    sg.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`)
    sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, TAU)
    ctx.fill()
  }
  // 5) 暗色适配 + 暗角
  if (dark) {
    ctx.fillStyle = 'rgba(10,14,22,0.42)'
    ctx.fillRect(0, 0, W, H)
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(20,12,6,0.3)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
}
function drawItem(ctx, it) {
  ctx.save()
  ctx.translate(it.x, it.y)
  ctx.rotate(it.rot)
  if (it.kind === 'decoy') {
    // 锅盖：金属圆盘 + 提手
    const r = it.r
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r)
    g.addColorStop(0, '#8f9aa6')
    g.addColorStop(0.6, '#5d6874')
    g.addColorStop(1, '#39424c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, r - 3, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = '#2b333b'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(-2, -2, 5, Math.PI * 0.9, Math.PI * 1.9)
    ctx.stroke()
    ctx.restore()
    return
  }
  const im = imgOf(it.i)
  const s = it.r * 2.05
  // 投影
  ctx.globalAlpha = 0.18
  ctx.fillStyle = '#3a2410'
  ctx.beginPath()
  ctx.ellipse(0, it.r * 0.7, it.r * 0.6, it.r * 0.16, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -s / 2, -s / 2, s, s)
  else {
    ctx.fillStyle = '#c98a4a'
    ctx.beginPath()
    ctx.arc(0, 0, it.r * 0.8, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
function drawHalf(ctx, h) {
  const im = imgOf(h.i)
  const t = h.life / h.max
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - t * 0.85)
  ctx.translate(h.x, h.y)
  ctx.rotate(h.rot)
  ctx.rotate(h.cutAngle)
  // 沿刀锋方向裁一半
  ctx.beginPath()
  ctx.rect(-h.r * 1.3, h.side < 0 ? -h.r * 1.3 : 0, h.r * 2.6, h.r * 1.3)
  ctx.clip()
  ctx.rotate(-h.cutAngle)
  const s = h.r * 2.05
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -s / 2, -s / 2, s, s)
  ctx.restore()
}
function drawTrail(ctx) {
  if (trail.length < 2) return
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1]
    const b = trail[i]
    const k = i / trail.length
    ctx.strokeStyle = `rgba(255,255,255,${0.18 + k * 0.5})`
    ctx.lineWidth = 1.5 + k * 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}
function drawSparks(ctx) {
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, 1 - s.life / s.max)
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
function drawFloats(ctx) {
  ctx.textAlign = 'center'
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, 1 - f.life / f.max)
    ctx.font = 'bold 15px system-ui, sans-serif'
    ctx.strokeStyle = 'rgba(30,20,10,0.6)'
    ctx.lineWidth = 3
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
}
function drawHud(ctx, dark) {
  // 背景名（每个模式一套背景）
  ctx.textAlign = 'center'
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.38)' : 'rgba(90,60,30,0.5)'
  ctx.fillText(BG[modeIdx.value].name, W / 2, 18)
  // 生命
  ctx.textAlign = 'left'
  ctx.font = '16px system-ui, sans-serif'
  for (let i = 0; i < 3; i++) ctx.fillText(i < lives.value ? '❤️' : '🖤', 10 + i * 22, 28)
  // 连击
  if (combo.value >= 2) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(20,30,44,0.4)'
    const w = 92
    ctx.beginPath()
    ctx.roundRect ? ctx.roundRect(W - w - 12, 10, w, 26, 13) : ctx.rect(W - w - 12, 10, w, 26)
    ctx.fill()
    ctx.fillStyle = '#ffd65a'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(`🔥 连击 ×${combo.value}`, W - w / 2 - 12, 28)
  }
  // 待机提示
  if (!started.value) {
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(90,60,30,0.65)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('点击下方「开始游戏」，然后按住拖动切菜', W / 2, H / 2)
  }
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  items = []
  halves = []
  sparks = []
  floats = []
  trail = []
  slicing = false
  lastPoint = null
  spawnAccum = 0
  timeAccum = 0
  shake = 0
  comboAt = 0
  graceT = 0
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  lives.value = 3
  timeLeft.value = MODES[mode.value].dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  hint.value = '点击「开始游戏」后按住拖动切菜'
  running = true
  startLoop()
}
function startGame() {
  if (overFlag) return
  started.value = true
  timeLeft.value = MODES[mode.value].dur
  timeAccum = 0
  hint.value = '按住拖动划开食材！别切到锅盖'
  beep(880, 0.08)
  setTimeout(() => beep(1175, 0.1), 90)
}
function settle() {
  if (overFlag) return
  overFlag = true
  over.value = true
  running = false
  stopLoop()
  const m = MODES[mode.value]
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const extra = Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    const gold = m.gold + extra
    player.gainGameCoins(gold)
    ui.pushLog(`🔪 切菜大师：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🔪 切菜大师：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.slice) mg.slice = { best: 0 }
  mg.slice.best = Math.max(mg.slice.best ?? 0, score.value)
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
  <div class="sk-page">
    <div class="sk-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="sk-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="sk-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="sk-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="sk-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="sk-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="sk-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="sk-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="sk-canvas" :width="W" :height="H" @pointerdown="onDown" @pointermove="onMove"></canvas>

    <div class="sk-hint">{{ hint }}</div>

    <div class="sk-keys">
      <button v-if="!started" class="sk-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="sk-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="sk-mask">
      <div class="sk-result">
        <div class="sk-result-head"><b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b></div>
        <div class="sk-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ MODES[mode].target }}</span>
          <span class="dim">最高连击 ×{{ maxCombo }}</span>
          <span v-if="passed" class="sk-gold">+{{ goldText }} 游戏币</span>
        </div>
        <button class="sk-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="sk-fire">
        <span v-for="i in 20" :key="i" class="sk-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="sk-info-mask" @click.self="showInfo = false">
      <div class="sk-info-box">
        <div class="sk-info-head"><b>🔪 切菜大师 · 十模式说明</b><button class="sk-info-close" @click="showInfo = false">✕</button></div>
        <div class="sk-info-list">
          <div class="sk-info-row sk-info-rule">
            玩法：食材从下方抛起，<b>按住并拖动</b>形成刀锋轨迹，划过食材即切开得分；<b>锅盖</b>是干扰物，
            切到扣 1 条命（共 3 条命，命耗尽立即结算）。<br />
            连击：0.8 秒内连续切开累计连击，单次得分最高 ×1.5（×1 → ×1.1 → … → ×1.5）；连击断了会清零。<br />
            漏切食材不扣命，但连击会断。限时结束后按得分结算，达标发游戏币（超出目标最多 +50%）。<br />
            开始：点击下方「▶ 开始游戏」后才开始计时与出料。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="sk-info-row">
            <b class="sk-info-name">{{ m.label }}</b>
            <span class="sk-info-desc">{{ m.desc }}</span>
          </div>
          <div class="sk-info-row sk-info-rule">
            十模式背景（每个模式一套）：{{ BG.map((b, i) => '模式' + (i + 1) + ' ' + b.name).join(' · ') }}
          </div>
          <div class="sk-info-row sk-info-rule">
            食材图鉴：{{ ING.map((f) => f.name + '(' + f.score + '分)').join('、') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.sk-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.sk-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.sk-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.sk-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.sk-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.sk-canvas { width: min(420px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); cursor: crosshair; touch-action: none; }
.sk-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.sk-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.sk-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.sk-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.sk-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.sk-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.sk-result-head { font-size: 18px; }
.sk-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.sk-gold { color: var(--good-strong); font-weight: 800; }
.sk-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.sk-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.sk-spark { position: absolute; font-size: 22px; color: var(--gold); animation: skSpark 1.1s ease-out forwards; }
@keyframes skSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.sk-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.sk-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.sk-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.sk-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.sk-info-list { display: flex; flex-direction: column; gap: 8px; }
.sk-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
/* 规则行含 <br> 与 <b>，必须块级（flex 会把文本节点拆成多个弹性项，导致换行失效） */
.sk-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.sk-info-rule b { color: var(--primary-strong); }
.sk-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.sk-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
