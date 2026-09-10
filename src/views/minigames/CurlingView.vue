<script setup>
// 汤圆冰壶（2026-09-09 新增，第 25 款）：拖拽蓄力推出汤圆，沿冰面滑向圆心，撞开对手汤圆
// 十模式：时长 40~100 秒 × 对手汤圆 0~8 × 砧板障碍 0~8 × 冰面摩擦 × 圆心大小 × 弧线冰面
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, opp: 0, blocks: 0, fric: 0.980, ring: 1.15, curl: 0, target: 225, gold: 45, desc: '40 秒 · 目标 225 分 · 空场练习：冰面好控制，专注瞄准圆心 · +45 币' },
  m2: { label: '模式2', dur: 45, opp: 2, blocks: 0, fric: 0.980, ring: 1.10, curl: 0, target: 245, gold: 55, desc: '45 秒 · 目标 245 分 · 2 个对手汤圆挡路，可以撞开 · +55 币' },
  m3: { label: '模式3', dur: 50, opp: 3, blocks: 2, fric: 0.978, ring: 1.05, curl: 0, target: 265, gold: 60, desc: '50 秒 · 目标 265 分 · 3 个对手 + 2 块砧板障碍 · +60 币' },
  m4: { label: '模式4', dur: 55, opp: 3, blocks: 2, fric: 0.988, ring: 1.00, curl: 0, target: 290, gold: 70, desc: '55 秒 · 目标 290 分 · **冰面更滑**，汤圆滑得更远更难停 · +70 币' },
  m5: { label: '模式5', dur: 60, opp: 4, blocks: 4, fric: 0.986, ring: 0.95, curl: 0, target: 310, gold: 80, desc: '60 秒 · 目标 310 分 · 4 对手 + 4 障碍 · +80 币' },
  m6: { label: '模式6', dur: 65, opp: 4, blocks: 4, fric: 0.984, ring: 0.85, curl: 0, target: 330, gold: 90, desc: '65 秒 · 目标 330 分 · **圆心缩小**，精度要求更高 · +90 币' },
  m7: { label: '模式7', dur: 70, opp: 5, blocks: 3, fric: 0.986, ring: 0.95, curl: 1, target: 350, gold: 100, desc: '70 秒 · 目标 350 分 · **弧线冰面**：汤圆会拐弯，要算提前量 · +100 币' },
  m8: { label: '模式8', dur: 80, opp: 6, blocks: 6, fric: 0.988, ring: 0.90, curl: 0, target: 400, gold: 120, desc: '80 秒 · 目标 400 分 · 6 对手 + 6 障碍的拥挤冰面 · +120 币' },
  m9: { label: '模式9', dur: 90, opp: 6, blocks: 5, fric: 0.990, ring: 0.80, curl: 1, target: 445, gold: 140, desc: '90 秒 · 目标 445 分 · 小环 + 弧线，极限瞄准 · +140 币' },
  m10: { label: '模式10', dur: 100, opp: 8, blocks: 8, fric: 0.992, ring: 0.75, curl: 1, target: 495, gold: 160, desc: '100 秒 · 目标 495 分 · 满场混战 + 最滑冰面 + 弧线 · +160 币' },
}
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const shots = ref(0)
const combo = ref(0)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.curling?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const W = 720
const H = 520
const STONE_R = 15
const LAUNCH = { x: W / 2, y: H - 56 }
const CX = W / 2
const CY = 168
const canvasEl = ref(null)
let canvas = null
let ctx = null
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let running = false
let stones = [] // { x, y, vx, vy, mine, r, hue, alive }
let blocks = [] // { x, y, w, h }
let shotsLeftToKeep = []
let drag = null // { x0, y0, x, y }
let aim = null // { dir:{x,y}, power }
let flying = null // 正在滑行的我方汤圆
let floats = []
let comboAt = 0
let curlSign = 1

function rand(a, b) { return a + Math.random() * (b - a) }
function ringR(i) { const s = cfg.value.ring; return [30, 62, 96][i] * s }

// ── 音效 ──
let soundCtx = null
function beep(freq, dur, type = 'sine', vol = 0.06) {
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

// ── 开局 ──
function buildBoard() {
  const m = cfg.value
  stones = []
  blocks = []
  floats = []
  flying = null
  drag = null
  aim = null
  // 对手汤圆：环内随机
  const placed = []
  for (let i = 0; i < m.opp; i++) {
    for (let t = 0; t < 80; t++) {
      const a = Math.random() * Math.PI * 2
      const d = rand(20, ringR(1) * 1.15)
      const x = CX + Math.cos(a) * d
      const y = CY + Math.sin(a) * d * 0.82
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > STONE_R * 2.6)) {
        placed.push({ x, y })
        stones.push({ x, y, vx: 0, vy: 0, mine: false, alive: true })
        break
      }
    }
  }
  // 砧板障碍：放在发射线到圆心之间
  for (let i = 0; i < m.blocks; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rand(70, W - 70)
      const y = rand(CY + ringR(2) * 0.9, H - 150)
      const w = rand(58, 96)
      const h = rand(20, 30)
      const clash = blocks.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 40 && Math.abs(b.y - y) < (b.h + h) / 2 + 40)
      const nearLaunch = Math.hypot(x - LAUNCH.x, y - LAUNCH.y) < 110
      if (!clash && !nearLaunch) { blocks.push({ x, y, w, h }); break }
    }
  }
  shotsLeftToKeep = []
  score.value = 0
  shots.value = 0
  combo.value = 0
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  timeAccum = 0
  curlSign = Math.random() < 0.5 ? -1 : 1
  draw()
}
function startGame() {
  if (started.value) return
  started.value = true
  running = true
  lastTs = 0
  beep(880, 0.08)
}
function reset() {
  stopLoop()
  buildBoard()
  started.value = false
  running = false
  startLoop()
}

// ── 主循环 ──
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  if (started.value && !overFlag) {
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) settle() }
    stepStones(dt)
  }
  for (const f of floats) { f.life += dt; f.y -= 42 * dt }
  floats = floats.filter((f) => f.life < f.max)
  draw()
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function stepStones(dt) {
  const m = cfg.value
  const decay = Math.pow(m.fric, dt * 60)
  for (const s of stones) {
    if (!s.alive) continue
    if (Math.abs(s.vx) < 0.5 && Math.abs(s.vy) < 0.5) { s.vx = 0; s.vy = 0; continue }
    // 弧线冰面：侧向加速度（与速度垂直）
    if (m.curl && s.mine) {
      const sp = Math.hypot(s.vx, s.vy)
      if (sp > 30) {
        const nx = -s.vy / sp
        const ny = s.vx / sp
        s.vx += nx * curlSign * 46 * dt
        s.vy += ny * curlSign * 46 * dt
      }
    }
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vx *= decay
    s.vy *= decay
    // 边界
    if (s.x < STONE_R) { s.x = STONE_R; s.vx = -s.vx * 0.7 }
    if (s.x > W - STONE_R) { s.x = W - STONE_R; s.vx = -s.vx * 0.7 }
    if (s.y < STONE_R) { s.y = STONE_R; s.vy = -s.vy * 0.7 }
    if (s.y > H - STONE_R) { s.y = H - STONE_R; s.vy = -s.vy * 0.7 }
    // 砧板
    for (const b of blocks) {
      const l = b.x - b.w / 2, r = b.x + b.w / 2, t = b.y - b.h / 2, bo = b.y + b.h / 2
      const nx = Math.max(l, Math.min(s.x, r))
      const ny = Math.max(t, Math.min(s.y, bo))
      const d = Math.hypot(s.x - nx, s.y - ny)
      if (d < STONE_R) {
        const nX = d > 0.001 ? (s.x - nx) / d : 0
        const nY = d > 0.001 ? (s.y - ny) / d : -1
        s.x = nx + nX * STONE_R
        s.y = ny + nY * STONE_R
        const dot = s.vx * nX + s.vy * nY
        if (dot < 0) { s.vx -= 2 * dot * nX * 0.85; s.vy -= 2 * dot * nY * 0.85 }
      }
    }
  }
  // 汤圆互撞
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      const a = stones[i], b = stones[j]
      if (!a.alive || !b.alive) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d > STONE_R * 2 || d < 0.001) continue
      const nx = dx / d, ny = dy / d
      const push = (STONE_R * 2 - d) / 2
      a.x -= nx * push; a.y -= ny * push
      b.x += nx * push; b.y += ny * push
      const va = a.vx * nx + a.vy * ny
      const vb = b.vx * nx + b.vy * ny
      const diff = va - vb
      if (diff > 0) {
        a.vx -= nx * diff * 0.92; a.vy -= ny * diff * 0.92
        b.vx += nx * diff * 0.92; b.vy += ny * diff * 0.92
        if (flying && (a === flying || b === flying)) beep(420, 0.05, 'triangle', 0.05)
      }
    }
  }
  // 我方汤圆停下 → 计分
  if (flying && Math.abs(flying.vx) < 0.5 && Math.abs(flying.vy) < 0.5) {
    scoreShot(flying)
    flying = null
  }
}
function scoreShot(s) {
  const dist = Math.hypot(s.x - CX, s.y - CY)
  const maxR = ringR(2) * 1.35
  const pts = Math.round((100 * Math.max(0, Math.min(1, 1 - dist / maxR))) / 5) * 5
  if (pts >= 60) { combo.value++; comboAt = performance.now() } else combo.value = 0
  const mult = 1 + Math.min(0.5, Math.max(0, combo.value - 1) * 0.1)
  const gain = Math.round(pts * mult)
  score.value += gain
  floats.push({ x: s.x, y: s.y - 22, life: 0, max: 1.1, text: `+${gain}`, good: pts >= 60 })
  beep(pts >= 60 ? 880 : 520, 0.08, 'triangle', 0.06)
  if (pts >= 60) setTimeout(() => beep(1175, 0.09), 70)
  // 场上最多留 4 个我方汤圆，最旧的淡出
  shotsLeftToKeep.push(s)
  if (shotsLeftToKeep.length > 4) { const old = shotsLeftToKeep.shift(); old.alive = false }
}

// ── 交互 ──
function pointerPos(e) {
  const r = canvas.getBoundingClientRect()
  const p = e.touches ? e.touches[0] : e
  return { x: (p.clientX - r.left) * (W / r.width), y: (p.clientY - r.top) * (H / r.height) }
}
function canShoot() { return started.value && !overFlag && !flying }
function onDown(e) {
  if (!canShoot()) return
  e.preventDefault()
  const p = pointerPos(e)
  drag = { x0: p.x, y0: p.y, x: p.x, y: p.y }
}
function onMove(e) {
  if (!drag || !canShoot()) return
  e.preventDefault()
  const p = pointerPos(e)
  drag.x = p.x
  drag.y = p.y
  updateAim()
}
function updateAim() {
  const dx = drag.x - LAUNCH.x
  const dy = drag.y - LAUNCH.y
  const len = Math.hypot(dx, dy)
  if (len < 8) { aim = null; return }
  aim = { dir: { x: dx / len, y: dy / len }, power: Math.max(0.15, Math.min(1, len / 250)) }
}
function onUp(e) {
  if (!drag || !canShoot()) { drag = null; aim = null; return }
  e.preventDefault()
  updateAim()
  if (aim) {
    const speed = 660 * aim.power
    flying = { x: LAUNCH.x, y: LAUNCH.y, vx: aim.dir.x * speed, vy: aim.dir.y * speed, mine: true, alive: true }
    stones.push(flying)
    shots.value++
    beep(320, 0.07, 'square', 0.05)
  }
  drag = null
  aim = null
}

// ── 结算 ──
function settle() {
  if (overFlag) return
  overFlag = true
  over.value = true
  running = false
  stopLoop()
  const m = cfg.value
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const gold = m.gold + Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    player.gainGameCoins(gold)
    ui.pushLog(`🍡 汤圆冰壶：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🍡 汤圆冰壶：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.curling) mg.curling = { best: 0 }
  mg.curling.best = Math.max(mg.curling.best ?? 0, score.value)
}

// ── 绘制 ──
function arcTo(ctx2, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx2.beginPath()
  ctx2.moveTo(x + rr, y)
  ctx2.arcTo(x + w, y, x + w, y + h, rr)
  ctx2.arcTo(x + w, y + h, x, y + h, rr)
  ctx2.arcTo(x, y + h, x, y, rr)
  ctx2.arcTo(x, y, x + w, y, rr)
  ctx2.closePath()
}
function draw() {
  if (!ctx) return
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  // 冰面
  const g = ctx.createLinearGradient(0, 0, 0, H)
  if (dark) { g.addColorStop(0, '#20323c'); g.addColorStop(1, '#16232b') } else { g.addColorStop(0, '#eaf6fb'); g.addColorStop(1, '#cfe6f2') }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // 冰面划痕
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,170,200,0.22)'
  ctx.lineWidth = 1
  for (let i = 0; i < 22; i++) {
    const y = 30 + i * 22
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y + Math.sin(i) * 4)
    ctx.stroke()
  }
  // 圆心与环
  const rings = [
    { r: ringR(2), c: dark ? 'rgba(90,160,200,0.35)' : 'rgba(90,160,200,0.45)', fill: null },
    { r: ringR(1), c: dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)', fill: null },
    { r: ringR(0), c: dark ? 'rgba(224,112,74,0.8)' : 'rgba(224,112,74,0.9)', fill: dark ? 'rgba(224,112,74,0.25)' : 'rgba(224,112,74,0.18)' },
  ]
  for (const r of rings) {
    ctx.beginPath()
    ctx.arc(CX, CY, r.r, 0, Math.PI * 2)
    if (r.fill) { ctx.fillStyle = r.fill; ctx.fill() }
    ctx.strokeStyle = r.c
    ctx.lineWidth = 3
    ctx.stroke()
  }
  // 圆心靶心
  ctx.beginPath()
  ctx.arc(CX, CY, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#d95a38'
  ctx.fill()
  // 发射线
  ctx.strokeStyle = dark ? 'rgba(210,170,120,0.4)' : 'rgba(150,110,70,0.4)'
  ctx.setLineDash([8, 8])
  ctx.beginPath()
  ctx.moveTo(40, LAUNCH.y + 30)
  ctx.lineTo(W - 40, LAUNCH.y + 30)
  ctx.stroke()
  ctx.setLineDash([])
  // 砧板障碍
  for (const b of blocks) {
    arcTo(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8)
    ctx.fillStyle = dark ? '#6b4f39' : '#c89a6b'
    ctx.fill()
    ctx.strokeStyle = dark ? '#8a6a4d' : '#9a6b40'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // 汤圆
  for (const s of stones) {
    if (!s.alive) continue
    const gg = ctx.createRadialGradient(s.x - 5, s.y - 6, 2, s.x, s.y, STONE_R + 3)
    if (s.mine) {
      gg.addColorStop(0, '#fff8ef')
      gg.addColorStop(1, dark ? '#c9885f' : '#e8a878')
    } else {
      gg.addColorStop(0, dark ? '#8b98a0' : '#dfe6ea')
      gg.addColorStop(1, dark ? '#4d5a62' : '#9aa8b0')
    }
    ctx.beginPath()
    ctx.arc(s.x, s.y, STONE_R, 0, Math.PI * 2)
    ctx.fillStyle = gg
    ctx.fill()
    ctx.strokeStyle = s.mine ? 'rgba(217,90,56,0.75)' : 'rgba(90,110,120,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
    if (s.mine) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, STONE_R * 0.42, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(217,90,56,0.35)'
      ctx.fill()
    }
  }
  // 待发射的汤圆
  if (canShoot()) {
    ctx.beginPath()
    ctx.arc(LAUNCH.x, LAUNCH.y, STONE_R, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(255,248,239,0.55)' : 'rgba(255,255,255,0.8)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217,90,56,0.6)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // 瞄准线 + 力度
  if (aim) {
    const len = 90 + aim.power * 190
    ctx.strokeStyle = 'rgba(217,90,56,0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(LAUNCH.x, LAUNCH.y)
    ctx.lineTo(LAUNCH.x + aim.dir.x * len, LAUNCH.y + aim.dir.y * len)
    ctx.stroke()
    ctx.setLineDash([])
    // 落点预览（按当前力度模拟滑行到停下）
    {
      let px = LAUNCH.x, py = LAUNCH.y
      let vx = aim.dir.x * 660 * aim.power, vy = aim.dir.y * 660 * aim.power
      const fr = cfg.value.fric
      for (let n = 0; n < 500; n++) {
        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) break
        px += vx / 60; py += vy / 60
        vx *= fr; vy *= fr
      }
      ctx.beginPath()
      ctx.arc(px, py, STONE_R + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(217,90,56,0.55)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
    // 力度条
    const bw = 150
    arcTo(ctx, W / 2 - bw / 2, H - 24, bw, 12, 6)
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(150,110,70,0.2)'
    ctx.fill()
    arcTo(ctx, W / 2 - bw / 2, H - 24, bw * aim.power, 12, 6)
    ctx.fillStyle = '#e8703f'
    ctx.fill()
  }
  // 飘字
  for (const f of floats) {
    const a = Math.max(0, 1 - f.life / f.max)
    ctx.globalAlpha = a
    ctx.fillStyle = f.good ? (dark ? '#8cd899' : '#4c9c4c') : (dark ? '#ffb98e' : '#d95a38')
    ctx.font = '700 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(f.text, f.x, f.y)
    ctx.globalAlpha = 1
  }
}

onMounted(() => {
  canvas = canvasEl.value
  ctx = canvas.getContext('2d')
  buildBoard()
  startLoop()
})
onUnmounted(() => stopLoop())
</script>

<template>
  <div class="cu-page">
    <div class="cu-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="cu-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="cu-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="cu-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="cu-chip">🍡 投出 <b class="mono">{{ shots }}</b></span>
      <span class="cu-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="cu-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="cu-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="cu-stage">
      <canvas
        ref="canvasEl"
        class="cu-canvas"
        :width="W"
        :height="H"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointerleave="onUp"
      />
    </div>

    <div class="cu-keys">
      <button v-if="!started" class="cu-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="cu-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <div v-if="over" class="cu-mask">
      <div class="cu-result">
        <div class="cu-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="cu-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>投出 <b class="mono">{{ shots }}</b> 次</span>
          <span v-if="passed" class="cu-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="cu-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="cu-fire">
        <span v-for="i in 20" :key="i" class="cu-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="cu-info-mask" @click.self="showInfo = false">
      <div class="cu-info-box">
        <div class="cu-info-head"><b>🍡 汤圆冰壶 · 十模式说明</b><button class="cu-info-close" @click="showInfo = false">✕</button></div>
        <div class="cu-info-list">
          <div class="cu-info-row cu-info-rule">通用规则：按住冰面往目标方向拖拽，拖得越远力度越大，松手推出汤圆 · 汤圆会一直滑到停下，<b>离圆心越近得分越高</b>（正中心 100 分）· 连续两次 60 分以上有连击加成（最高 ×1.5）· 场上最多留 4 个自己的汤圆，会把后面的汤圆撞开 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="cu-info-row">
            <b class="cu-info-name">{{ m.label }}</b>
            <span class="cu-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cu-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.cu-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.cu-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.cu-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.cu-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.cu-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.cu-stage { width: min(720px, 98%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.cu-canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; }
.cu-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.cu-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.cu-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.cu-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.cu-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.cu-result-head { font-size: 18px; }
.cu-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.cu-gold { color: var(--good-strong); font-weight: 800; }
.cu-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.cu-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.cu-spark { position: absolute; font-size: 22px; color: var(--gold); animation: cuSpark 1.1s ease-out forwards; }
@keyframes cuSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.cu-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.cu-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.cu-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.cu-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.cu-info-list { display: flex; flex-direction: column; gap: 8px; }
.cu-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.cu-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.cu-info-rule b { color: var(--primary-strong); }
.cu-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.cu-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
