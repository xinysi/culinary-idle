<script setup>
// 丰收打地鼠（2026-09-09 新增，第 17 款）：田垄里冒出食材，点中收获；石头/虫子是干扰物，点错扣 1 命
// 连击加成 · 金色食材高分 · 十模式（时长/冒出频率/同屏/停留时长/干扰物比例）
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 画布与坑位 ──
const W = 720
const H = 389
const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rand = (a, b) => a + Math.random() * (b - a)
// 坑洞精灵（256×256；坑口实测 188×137、中心 131.5,133）
const HOLE_S = 152 // 绘制边长
const HOLE_K = HOLE_S / 256
const PIT_CX = 131.5
const PIT_CY = 133
const HOLE_RX = 46 // 命中半径（略小于可见坑口）
const HOLE_RY = 30
const ITEM_LIFT = 34 // 冒出物显示在坑口上方的高度
const ITEM_SIZE = 68
const HOLES = []
for (const y of [95, 218, 341]) {
  for (const x of [160, 360, 560]) {
    HOLES.push({ x, y, item: null, cd: 0 })
  }
}

// ── 食材（图鉴真实图片）──
const ING = [
  { id: 'apple', name: '苹果', score: 10, w: 24, r: 30 },
  { id: 'carrot', name: '胡萝卜', score: 12, w: 22, r: 30 },
  { id: 'tomato', name: '番茄', score: 15, w: 20, r: 29 },
  { id: 'strawberry', name: '草莓', score: 18, w: 16, r: 26 },
  { id: 'grape', name: '葡萄', score: 22, w: 10, r: 26 },
  { id: 'banana', name: '香蕉', score: 25, w: 8, r: 28 },
]

// ── 十模式 ──
const MODES = {
  m1: { label: '模式1', dur: 30, rate: 0.85, max: 1, life: 1.5, decoy: 0, gold2: 0.03, target: 285, gold: 35, desc: '30 秒 · 目标 285 分 · 一次只冒一个、无干扰 · +35 币' },
  m2: { label: '模式2', dur: 35, rate: 0.8, max: 1, life: 1.4, decoy: 0.06, gold2: 0.04, target: 355, gold: 40, desc: '35 秒 · 目标 355 分 · 开始混入石头 · +40 币' },
  m3: { label: '模式3', dur: 40, rate: 0.75, max: 2, life: 1.3, decoy: 0.1, gold2: 0.05, target: 430, gold: 45, desc: '40 秒 · 目标 430 分 · 可同时冒两个 · +45 币' },
  m4: { label: '模式4', dur: 45, rate: 0.7, max: 2, life: 1.2, decoy: 0.14, gold2: 0.05, target: 520, gold: 50, desc: '45 秒 · 目标 520 分 · +50 币' },
  m5: { label: '模式5', dur: 50, rate: 0.65, max: 2, life: 1.1, decoy: 0.18, gold2: 0.06, target: 625, gold: 55, desc: '50 秒 · 目标 625 分 · 干扰物明显变多 · +55 币' },
  m6: { label: '模式6', dur: 55, rate: 0.6, max: 3, life: 1.0, decoy: 0.2, gold2: 0.06, target: 745, gold: 60, desc: '55 秒 · 目标 745 分 · 三洞齐冒 · +60 币' },
  m7: { label: '模式7', dur: 60, rate: 0.55, max: 3, life: 0.95, decoy: 0.22, gold2: 0.07, target: 885, gold: 70, desc: '60 秒 · 目标 885 分 · +70 币' },
  m8: { label: '模式8', dur: 70, rate: 0.5, max: 3, life: 0.9, decoy: 0.24, gold2: 0.07, target: 1135, gold: 80, desc: '70 秒 · 目标 1135 分 · 停留时间变短 · +80 币' },
  m9: { label: '模式9', dur: 80, rate: 0.45, max: 4, life: 0.85, decoy: 0.26, gold2: 0.08, target: 1440, gold: 90, desc: '80 秒 · 目标 1440 分 · +90 币' },
  m10: { label: '模式10', dur: 90, rate: 0.4, max: 4, life: 0.8, decoy: 0.28, gold2: 0.08, target: 1825, gold: 100, desc: '90 秒 · 目标 1825 分 · 满地乱冒的丰收田 · +100 币' },
}
const showInfo = ref(false)

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
const best = computed(() => player.minigames?.whack?.best ?? 0)
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)
const goldText = computed(() => {
  const m = MODES[mode.value]
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

// ── 内部状态 ──
let sparks = []
let floats = []
let spawnAccum = 0
let timeAccum = 0
let waveT = 0
let shake = 0
let comboAt = 0
let graceT = 0 // 点错后的短暂无敌
let running = false
let overFlag = false
let lastTs = 0
let loopId = null

const IMGS = ING.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})

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

// ── 冒出 ──
function pickIng() {
  const total = ING.reduce((s, f) => s + f.w, 0)
  let r = Math.random() * total
  for (let i = 0; i < ING.length; i++) { r -= ING[i].w; if (r <= 0) return i }
  return 0
}
function spawn() {
  const m = MODES[mode.value]
  const upCount = HOLES.filter((h) => h.item).length
  if (upCount >= m.max) return
  const free = HOLES.filter((h) => !h.item && h.cd <= 0)
  if (!free.length) return
  const hole = free[Math.floor(Math.random() * free.length)]
  const roll = Math.random()
  let kind = 'ing'
  let i = 0
  if (roll < m.decoy) kind = Math.random() < 0.5 ? 'rock' : 'bug'
  else {
    i = pickIng()
    if (Math.random() < m.gold2) kind = 'gold'
  }
  hole.item = { kind, i, t: 0, life: m.life * (kind === 'gold' ? 1.35 : 1), hit: false, hitT: 0, seed: rand(0, TAU) }
}

// ── 点击 ──
function toCanvas(e) {
  const cv = canvas.value
  const rect = cv.getBoundingClientRect()
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
}
function onDown(e) {
  if (!running || overFlag || !started.value) return
  const p = toCanvas(e)
  // 从最上方的洞开始命中判定（后画的在上）
  for (let k = HOLES.length - 1; k >= 0; k--) {
    const h = HOLES[k]
    if (!h.item || h.item.hit) continue
    const it = h.item
    if (popK(it) <= 0.15) continue
    const cy = h.y - ITEM_LIFT
    if (Math.hypot(p.x - h.x, (p.y - cy) * 0.92) <= ITEM_SIZE * 0.52) { hitHole(h); return }
  }
}
// 出现程度 0→1（淡入），life 末段/被点中后淡出
function popK(it) {
  const t = it.t
  const inK = clamp(t / 0.16, 0, 1)
  const outK = it.hit ? clamp(it.hitT / 0.14, 0, 1) : clamp((t - (it.life - 0.2)) / 0.2, 0, 1)
  return clamp(inK - outK, 0, 1)
}
function hitHole(h) {
  const it = h.item
  it.hit = true
  it.hitT = 0
  if (it.kind === 'rock' || it.kind === 'bug') {
    combo.value = 0
    shake = 1
    if (graceT <= 0) {
      lives.value--
      graceT = 0.6
      floats.push({ x: h.x, y: h.y - 54, text: it.kind === 'rock' ? '石头！-1 ❤' : '虫子！-1 ❤', life: 0, max: 1.0, color: '#e06a5a' })
      beep(150, 0.26, 'sawtooth', 0.09)
      if (lives.value <= 0) settle()
    } else {
      floats.push({ x: h.x, y: h.y - 54, text: '点错了！', life: 0, max: 0.8, color: '#e06a5a' })
      beep(190, 0.14, 'sawtooth', 0.05)
    }
    for (let i = 0; i < 10; i++) sparks.push({ x: h.x, y: h.y - 38, vx: rand(-130, 130), vy: rand(-150, 20), life: 0, max: rand(0.3, 0.6), color: '#b9a08a', size: rand(1.5, 3) })
    return
  }
  const now = performance.now()
  combo.value = now - comboAt < 1200 ? combo.value + 1 : 1
  comboAt = now
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  const mult = 1 + Math.min(0.5, 0.1 * (combo.value - 1))
  const base = it.kind === 'gold' ? ING[it.i].score * 3 : ING[it.i].score
  const gain = Math.round(base * mult)
  score.value += gain
  floats.push({ x: h.x, y: h.y - 54, text: `+${gain}`, life: 0, max: 0.9, color: it.kind === 'gold' ? '#ffd65a' : '#eaf6c8' })
  for (let i = 0; i < 8; i++) sparks.push({ x: h.x, y: h.y - 38, vx: rand(-90, 90), vy: rand(-160, -20), life: 0, max: rand(0.3, 0.6), color: it.kind === 'gold' ? '#ffe08a' : '#bfe08a', size: rand(1.4, 2.6) })
  beep(it.kind === 'gold' ? 1180 : 780 + combo.value * 40, 0.06, 'triangle', 0.06)
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
      if (combo.value > 0 && performance.now() - comboAt > 1200) combo.value = 0
      spawnAccum += dt
      if (spawnAccum >= m.rate) { spawnAccum = 0; spawn() }
    }
    for (const h of HOLES) {
      if (h.cd > 0) h.cd -= dt
      const it = h.item
      if (!it) continue
      it.t += dt
      if (it.hit) it.hitT += dt
      const gone = it.hit ? it.hitT > 0.12 : it.t > it.life
      if (gone) {
        // 漏掉食材只断连击
        if (!it.hit && it.kind !== 'rock' && it.kind !== 'bug') combo.value = 0
        h.item = null
        h.cd = 0.12
      }
    }
  }
  for (const s of sparks) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 620 * dt }
  sparks = sparks.filter((s) => s.life < s.max)
  for (const f of floats) { f.life += dt; f.y -= 34 * dt }
  floats = floats.filter((f) => f.life < f.max)
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
  drawField(ctx, dark)
  // 坑洞整张画在下层，冒出物直接淡入显示在坑洞上方（不做切割/遮挡）
  for (const h of HOLES) drawHole(ctx, h)
  for (const h of HOLES) drawPop(ctx, h)
  drawSparks(ctx)
  drawFloats(ctx)
  drawHud(ctx, dark)
  ctx.restore()
}
// ── 素材：俯视像素草地背景 + 坑洞精灵 ──
const BG_IMG = (() => {
  const im = new Image()
  im.src = 'images/wk-bg.jpg?v=3' // 换图后带版本号，避免浏览器沿用旧缓存
  return im
})()
const HOLE_IMG = (() => {
  const im = new Image()
  im.src = 'images/wk-hole.png?v=2'
  return im
})()
function drawField(ctx, dark) {
  if (BG_IMG.complete && BG_IMG.naturalWidth) {
    // 裁掉底部 60px：去掉生成器水印
    ctx.drawImage(BG_IMG, 0, 0, BG_IMG.naturalWidth, BG_IMG.naturalHeight - 60, 0, 0, W, H)
  } else {
    ctx.fillStyle = dark ? '#1b3320' : '#8bc96c'
    ctx.fillRect(0, 0, W, H)
  }
  if (dark) {
    ctx.fillStyle = 'rgba(10,16,26,0.5)'
    ctx.fillRect(0, 0, W, H)
  }
  // 暗角：聚焦中间
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.86)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, dark ? 'rgba(0,0,0,0.35)' : 'rgba(20,50,10,0.16)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
}
// 坑洞精灵：整张绘制，以坑口中心对齐到坑位
function drawHole(ctx, h) {
  if (!HOLE_IMG.complete || !HOLE_IMG.naturalWidth) return
  ctx.drawImage(HOLE_IMG, h.x - PIT_CX * HOLE_K, h.y - PIT_CY * HOLE_K, HOLE_S, HOLE_S)
}
function drawPop(ctx, h) {
  const it = h.item
  if (!it) return
  const k = popK(it)
  if (k <= 0.02) return
  const cy = h.y - ITEM_LIFT
  const wob = Math.sin(waveT * 6 + it.seed) * 1.6
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(h.x + wob, cy)
  // 淡入时轻微放大，避免生硬
  const popScale = 0.86 + 0.14 * k
  ctx.scale(popScale, popScale)
  if (it.kind === 'rock') { ctx.scale(0.9, 0.9); drawRock(ctx) }
  else if (it.kind === 'bug') { ctx.scale(0.9, 0.9); drawBug(ctx) }
  else {
    const im = IMGS[it.i]
    const s = ITEM_SIZE
    if (it.kind === 'gold') {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, s * 0.62)
      g.addColorStop(0, 'rgba(255,214,90,0.75)')
      g.addColorStop(1, 'rgba(255,214,90,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.62, 0, TAU)
      ctx.fill()
    }
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -s / 2, -s / 2, s, s)
    else {
      ctx.fillStyle = '#d98a4a'
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.42, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}
function drawRock(ctx) {
  ctx.fillStyle = '#8d8b86'
  ctx.beginPath()
  ctx.moveTo(-26, 18)
  ctx.lineTo(-18, -12)
  ctx.lineTo(2, -24)
  ctx.lineTo(22, -10)
  ctx.lineTo(26, 18)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(-18, -12)
  ctx.lineTo(2, -24)
  ctx.lineTo(6, -6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5f5d59'
  ctx.lineWidth = 2
  ctx.stroke()
}
function drawBug(ctx) {
  ctx.fillStyle = '#4a3a2a'
  ctx.beginPath()
  ctx.ellipse(0, 0, 20, 13, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#2c231a'
  ctx.beginPath()
  ctx.arc(-13, -6, 7, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#2c231a'
  ctx.lineWidth = 2
  for (const sx of [-8, 0, 8]) {
    ctx.beginPath()
    ctx.moveTo(sx, 8)
    ctx.lineTo(sx + 5, 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(sx, -8)
    ctx.lineTo(sx + 5, -20)
    ctx.stroke()
  }
  ctx.strokeStyle = '#e0c56a'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-16, -10)
  ctx.lineTo(-22, -20)
  ctx.moveTo(-16, -10)
  ctx.lineTo(-8, -22)
  ctx.stroke()
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
  ctx.textAlign = 'left'
  ctx.font = '16px system-ui, sans-serif'
  for (let i = 0; i < 3; i++) ctx.fillText(i < lives.value ? '❤️' : '🖤', 10 + i * 22, 28)
  if (combo.value >= 2) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(20,30,44,0.4)'
    const w = 92
    ctx.fillRect(W - w - 12, 10, w, 26)
    ctx.fillStyle = '#ffd65a'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(`🔥 连击 ×${combo.value}`, W - w / 2 - 12, 28)
  }
  if (!started.value) {
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(60,70,40,0.7)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('点击下方「开始游戏」，然后点食材收获', W / 2, H / 2 + 60)
  }
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  for (const h of HOLES) { h.item = null; h.cd = 0 }
  sparks = []
  floats = []
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
  hint.value = '点击「开始游戏」后点食材收获'
  running = true
  startLoop()
}
function startGame() {
  if (overFlag) return
  started.value = true
  timeLeft.value = MODES[mode.value].dur
  timeAccum = 0
  hint.value = '点中食材得分！别点石头和虫子'
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
    ui.pushLog(`🌾 丰收打地鼠：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🌾 丰收打地鼠：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.whack) mg.whack = { best: 0 }
  mg.whack.best = Math.max(mg.whack.best ?? 0, score.value)
}

onMounted(() => {
  window.addEventListener('pointercancel', () => {})
  reset()
})
onUnmounted(() => { stopLoop() })
</script>

<template>
  <div class="wk-page">
    <div class="wk-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="wk-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="wk-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="wk-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="wk-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="wk-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="wk-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="wk-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="wk-canvas" :width="W" :height="H" @pointerdown="onDown"></canvas>

    <div class="wk-hint">{{ hint }}</div>

    <div class="wk-keys">
      <button v-if="!started" class="wk-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="wk-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="wk-mask">
      <div class="wk-result">
        <div class="wk-result-head"><b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b></div>
        <div class="wk-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ MODES[mode].target }}</span>
          <span class="dim">最高连击 ×{{ maxCombo }}</span>
          <span v-if="passed" class="wk-gold">+{{ goldText }} 游戏币</span>
        </div>
        <button class="wk-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="wk-fire">
        <span v-for="i in 20" :key="i" class="wk-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="wk-info-mask" @click.self="showInfo = false">
      <div class="wk-info-box">
        <div class="wk-info-head"><b>🌾 丰收打地鼠 · 十模式说明</b><button class="wk-info-close" @click="showInfo = false">✕</button></div>
        <div class="wk-info-list">
          <div class="wk-info-row wk-info-rule">
            玩法：田垄的洞里会冒出食材，<b>点中即收获得分</b>；<b>石头 / 虫子</b>是干扰物，
            点错扣 1 条命（共 3 条命，命耗尽立即结算）。<br />
            金色食材是普通食材的 3 倍分，停留时间也更长。<br />
            连击：1.2 秒内连续点中累计连击，单次得分最高 ×1.5（×1 → ×1.1 → … → ×1.5）；漏掉食材或点错会清零。<br />
            限时结束后按得分结算，达标发游戏币（超出目标最多 +50%）。<br />
            开始：点击下方「▶ 开始游戏」后才开始计时与冒出。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="wk-info-row">
            <b class="wk-info-name">{{ m.label }}</b>
            <span class="wk-info-desc">{{ m.desc }}</span>
          </div>
          <div class="wk-info-row wk-info-rule">
            食材图鉴：{{ ING.map((f) => f.name + '(' + f.score + '分)').join('、') }}（金色 ×3）
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wk-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.wk-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.wk-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.wk-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.wk-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.wk-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.wk-canvas { width: min(720px, 96%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); cursor: pointer; touch-action: none; }
.wk-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.wk-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.wk-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.wk-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.wk-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.wk-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.wk-result-head { font-size: 18px; }
.wk-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.wk-gold { color: var(--good-strong); font-weight: 800; }
.wk-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.wk-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.wk-spark { position: absolute; font-size: 22px; color: var(--gold); animation: wkSpark 1.1s ease-out forwards; }
@keyframes wkSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.wk-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.wk-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.wk-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.wk-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.wk-info-list { display: flex; flex-direction: column; gap: 8px; }
.wk-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.wk-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.wk-info-rule b { color: var(--primary-strong); }
.wk-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.wk-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
