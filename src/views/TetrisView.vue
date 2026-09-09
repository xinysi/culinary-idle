<script setup>
// 俄罗斯方块（2026-09-09 新增，第 22 款）：食材箱下落消行
// 十模式：时长 × 下落速度 × 初始垃圾行；消 1/2/3/4 行 = 10/30/60/100 分 × 连消加成
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 棋盘 ──
const MAX_COLS = 10
const ROWS = 20
const CELL = 26
const PAD = 16
const PANEL_W = 92
const W = PAD * 2 + MAX_COLS * CELL + PANEL_W
const H = PAD * 2 + ROWS * CELL
let cols = MAX_COLS // 每模式可变（窄井）
function wellX() { return PAD + (MAX_COLS - cols) * CELL / 2 }
const TAU = Math.PI * 2

// ── 方块（7 种，对应 7 种食材）──
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
}
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const SKIN = {
  I: { id: 'carrot', color: '#e8a24a' },
  O: { id: 'apple', color: '#d95a38' },
  T: { id: 'tomato', color: '#e06a5a' },
  S: { id: 'strawberry', color: '#e0607a' },
  Z: { id: 'grape', color: '#9a7ae0' },
  J: { id: 'banana', color: '#e8c34a' },
  L: { id: 'pineapple', color: '#e0b13a' },
}
const IMGS = {}
for (const t of TYPES) {
  const im = new Image()
  im.src = itemImage(SKIN[t].id)
  IMGS[t] = im
}

// ── 十模式 ──
const MODES = {
  m1: { label: '模式1', dur: 60, drop: 1.0, garbage: 0, cols: 10, target: 200, gold: 70, desc: '60 秒 · 目标 200 分 · 标准 10 列 · +70 币' },
  m2: { label: '模式2', dur: 60, drop: 0.75, garbage: 0, cols: 10, target: 260, gold: 70, desc: '60 秒 · 目标 260 分 · 下落更快 · +70 币' },
  m3: { label: '模式3', dur: 70, drop: 0.8, garbage: 0, cols: 8, target: 340, gold: 85, desc: '70 秒 · 目标 340 分 · **窄井 8 列**（更挤）· +85 币' },
  m4: { label: '模式4', dur: 70, drop: 0.8, garbage: 0, cols: 6, target: 420, gold: 90, desc: '70 秒 · 目标 420 分 · **极窄井 6 列** · +90 币' },
  m5: { label: '模式5', dur: 80, drop: 0.7, garbage: 0, cols: 10, noPreview: true, target: 520, gold: 105, desc: '80 秒 · 目标 520 分 · **无预览**（看不到下一个方块）· +105 币' },
  m6: { label: '模式6', dur: 80, drop: 0.7, garbage: 0, cols: 10, blind: true, target: 640, gold: 110, desc: '80 秒 · 目标 640 分 · **盲盒**（当前方块闪烁难辨）· +110 币' },
  m7: { label: '模式7', dur: 90, drop: 0.6, garbage: 3, cols: 10, target: 780, gold: 130, desc: '90 秒 · 目标 780 分 · 开局 3 行垃圾 · +130 币' },
  m8: { label: '模式8', dur: 90, drop: 0.6, garbage: 0, cols: 10, riseSec: 12, target: 920, gold: 135, desc: '90 秒 · 目标 920 分 · **上升垃圾**（每 12 秒底部升一行）· +135 币' },
  m9: { label: '模式9', dur: 100, drop: 0.5, garbage: 0, cols: 10, pool: ['S', 'Z', 'J', 'L', 'T'], target: 1100, gold: 155, desc: '100 秒 · 目标 1100 分 · **窄池**（只有 S/Z/J/L/T 五种难方块）· +155 币' },
  m10: { label: '模式10', dur: 120, drop: 0.4, garbage: 0, cols: 8, riseSec: 10, target: 1400, gold: 190, desc: '120 秒 · 目标 1400 分 · **地狱**：窄井 + 每 10 秒上升垃圾 · +190 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const canvas = ref(null)
const mode = ref('m1')
const score = ref(0)
const timeLeft = ref(60)
const lines = ref(0)
const level = ref(1)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const nextType = ref('T')
const best = computed(() => player.minigames?.tetris?.best ?? 0)
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)
const goldText = computed(() => {
  const m = MODES[mode.value]
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

// ── 内部状态 ──
let board = []
let piece = null
let dropAccum = 0
let timeAccum = 0
let waveT = 0
let shake = 0
let floats = []
let sparks = []
let running = false
let overFlag = false
let lastTs = 0
let loopId = null
let softDrop = false
let riseAccum = 0

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

// ── 方块逻辑 ──
function emptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(cols).fill(null))
}
function rotateMatrix(m) {
  const n = m.length
  const out = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c]
  return out
}
function randomType() {
  const pool = MODES[mode.value].pool || TYPES
  return pool[Math.floor(Math.random() * pool.length)]
}
function spawn(type) {
  const t = type || randomType()
  const m = SHAPES[t].map((row) => row.slice())
  const x = Math.floor((cols - m[0].length) / 2)
  const p = { type: t, m, x, y: 0 }
  // 起始位置若已冲突 → 游戏结束
  if (collide(p, 0, 0)) { settle(); return }
  piece = p
}
function collide(p, dx, dy, mat) {
  const m = mat || p.m
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue
      const nx = p.x + c + dx
      const ny = p.y + r + dy
      if (nx < 0 || nx >= cols || ny >= ROWS) return true
      if (ny >= 0 && board[ny][nx]) return true
    }
  }
  return false
}
function tryMove(dx, dy) {
  if (!piece) return false
  if (collide(piece, dx, dy)) return false
  piece.x += dx
  piece.y += dy
  return true
}
function tryRotate() {
  if (!piece) return false
  const rm = rotateMatrix(piece.m)
  // 简单踢墙：原位 → 左 → 右 → 上
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]) {
    if (!collide(piece, dx, dy, rm)) {
      piece.m = rm
      piece.x += dx
      piece.y += dy
      beep(620, 0.04, 'triangle', 0.05)
      return true
    }
  }
  return false
}
function lockPiece() {
  if (!piece) return
  for (let r = 0; r < piece.m.length; r++) {
    for (let c = 0; c < piece.m[r].length; c++) {
      if (!piece.m[r][c]) continue
      const ny = piece.y + r
      const nx = piece.x + c
      if (ny < 0) { settle(); return }
      board[ny][nx] = piece.type
    }
  }
  piece = null
  clearLines()
  if (!overFlag) { spawn(nextType.value); nextType.value = randomType() }
}
function clearLines() {
  let cleared = 0
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((c) => c)) {
      board.splice(r, 1)
      board.unshift(new Array(cols).fill(null))
      cleared++
      r++
    }
  }
  if (!cleared) return
  const base = [0, 10, 30, 60, 100][cleared] || 100
  const gain = Math.round(base * (1 + (level.value - 1) * 0.1))
  score.value += gain
  lines.value += cleared
  level.value = 1 + Math.floor(lines.value / 8)
  floats.push({ x: wellX() + cols * CELL / 2, y: PAD + 40, text: `消 ${cleared} 行 +${gain}`, life: 0, max: 1.1, color: '#ffd65a' })
  for (let i = 0; i < 12 * cleared; i++) {
    sparks.push({ x: wellX() + Math.random() * cols * CELL, y: PAD + Math.random() * ROWS * CELL, vx: rand(-80, 80), vy: rand(-160, -40), life: 0, max: rand(0.3, 0.7), color: '#ffe08a', size: rand(1.4, 2.6) })
  }
  shake = Math.min(1, 0.4 + cleared * 0.2)
  beep(880 + cleared * 120, 0.08)
  if (cleared >= 4) setTimeout(() => beep(1568, 0.16), 90)
}
function rand(a, b) { return a + Math.random() * (b - a) }
function softDropOnce() {
  if (tryMove(0, 1)) score.value += 1
}
function hardDrop() {
  if (!piece) return
  let n = 0
  while (tryMove(0, 1)) n++
  score.value += n * 2
  beep(420, 0.05, 'square', 0.05)
  lockPiece()
}
function garbageRow() {
  const row = new Array(cols).fill(null)
  const hole = Math.floor(Math.random() * cols)
  for (let c = 0; c < cols; c++) if (c !== hole) row[c] = TYPES[Math.floor(Math.random() * TYPES.length)]
  return row
}
function addGarbage(n) {
  for (let i = 0; i < n; i++) board.push(garbageRow())
  while (board.length > ROWS) board.shift()
}
// 上升垃圾：底部升一行，顶部被顶出的行若有方块则判负
function riseGarbage() {
  const top = board.shift()
  if (top.some((c) => c)) { settle(); return }
  board.push(garbageRow())
  shake = 0.7
  beep(200, 0.18, 'sawtooth', 0.06)
}

// ── 输入 ──
function onKey(e) {
  if (!running || overFlag || !started.value) return
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) e.preventDefault()
  if (e.key === 'ArrowLeft') tryMove(-1, 0)
  else if (e.key === 'ArrowRight') tryMove(1, 0)
  else if (e.key === 'ArrowDown') { softDrop = true; if (tryMove(0, 1)) score.value += 1 }
  else if (e.key === 'ArrowUp') tryRotate()
  else if (e.key === ' ') hardDrop()
}
function onKeyUp(e) {
  if (e.key === 'ArrowDown') softDrop = false
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
      // 上升垃圾
      if (m.riseSec) {
        riseAccum += dt
        if (riseAccum >= m.riseSec) { riseAccum = 0; riseGarbage() }
      }
      // 下落
      if (piece) {
        const interval = Math.max(0.09, m.drop / (1 + (level.value - 1) * 0.12))
        dropAccum += dt
        if (dropAccum >= interval) {
          dropAccum = 0
          if (!tryMove(0, 1)) lockPiece()
        }
      }
    }
  }
  for (const s of sparks) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 620 * dt }
  sparks = sparks.filter((s) => s.life < s.max)
  for (const f of floats) { f.life += dt; f.y -= 30 * dt }
  floats = floats.filter((f) => f.life < f.max)
  if (shake > 0) shake = Math.max(0, shake - dt * 3)
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
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 5, rand(-1, 1) * shake * 5)
  // 背景
  const g = ctx.createLinearGradient(0, 0, 0, H)
  if (dark) { g.addColorStop(0, '#241a14'); g.addColorStop(1, '#15100c') } else { g.addColorStop(0, '#f7ecdc'); g.addColorStop(1, '#e2cbaa') }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // 井（按 cols 居中）
  const wx = wellX()
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(90,60,30,0.12)'
  ctx.fillRect(wx - 2, PAD - 2, cols * CELL + 4, ROWS * CELL + 4)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(120,80,40,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(wx - 2, PAD - 2, cols * CELL + 4, ROWS * CELL + 4)
  // 网格
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,80,40,0.12)'
  ctx.lineWidth = 1
  for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(wx + c * CELL, PAD); ctx.lineTo(wx + c * CELL, PAD + ROWS * CELL); ctx.stroke() }
  for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(wx, PAD + r * CELL); ctx.lineTo(wx + cols * CELL, PAD + r * CELL); ctx.stroke() }
  // 已落方块
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c]) drawCell(ctx, wx + c * CELL, PAD + r * CELL, board[r][c])
    }
  }
  // 当前方块（盲盒模式闪烁）
  if (piece) {
    const isBlind = MODES[mode.value].blind
    ctx.save()
    if (isBlind) ctx.globalAlpha = 0.22 + 0.5 * (Math.sin(waveT * 7) > 0 ? 1 : 0)
    for (let r = 0; r < piece.m.length; r++) {
      for (let c = 0; c < piece.m[r].length; c++) {
        if (piece.m[r][c]) drawCell(ctx, wx + (piece.x + c) * CELL, PAD + (piece.y + r) * CELL, piece.type)
      }
    }
    ctx.restore()
  }
  // 右侧面板：下一个 + 等级
  const px = PAD + MAX_COLS * CELL + 12
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,252,246,0.75)'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(px, PAD, PANEL_W - 20, 130, 12) : ctx.rect(px, PAD, PANEL_W - 20, 130)
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(120,80,40,0.3)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(90,60,30,0.7)'
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(MODES[mode.value].noPreview ? '? ? ?' : '下一个', px + (PANEL_W - 20) / 2, PAD + 18)
  // 预览（无预览模式跳过）
  const pm = SHAPES[MODES[mode.value].noPreview ? 'O' : nextType.value]
  const ps = 18
  const pw = pm[0].length * ps
  const ph = pm.length * ps
  const ox = px + (PANEL_W - 20 - pw) / 2
  const oy = PAD + 34 + (60 - ph) / 2
  if (!MODES[mode.value].noPreview) {
    for (let r = 0; r < pm.length; r++) {
      for (let c = 0; c < pm[r].length; c++) {
        if (pm[r][c]) drawCell(ctx, ox + c * ps, oy + r * ps, nextType.value, ps)
      }
    }
  }
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(90,60,30,0.7)'
  ctx.font = 'bold 12px system-ui, sans-serif'
  ctx.fillText(`等级 ${level.value}`, px + (PANEL_W - 20) / 2, PAD + 112)
  // 粒子 / 飘字
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, 1 - s.life / s.max)
    ctx.fillStyle = s.color
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, TAU); ctx.fill()
  }
  ctx.globalAlpha = 1
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
  if (!started.value) {
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(90,60,30,0.65)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('点击下方「开始游戏」', W / 2, H / 2)
  }
  ctx.restore()
}
function drawCell(ctx, x, y, type, size) {
  const s = size || CELL
  const skin = SKIN[type]
  ctx.save()
  ctx.fillStyle = skin.color
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x + 1, y + 1, s - 2, s - 2, 4) : ctx.rect(x + 1, y + 1, s - 2, s - 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1
  ctx.stroke()
  const im = IMGS[type]
  if (im && im.complete && im.naturalWidth) {
    const is = s * 0.78
    ctx.drawImage(im, x + (s - is) / 2, y + (s - is) / 2, is, is)
  }
  ctx.restore()
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  const m = MODES[mode.value]
  cols = m.cols || MAX_COLS
  board = emptyBoard()
  piece = null
  dropAccum = 0
  timeAccum = 0
  shake = 0
  softDrop = false
  score.value = 0
  lines.value = 0
  level.value = 1
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  floats = []
  sparks = []
  nextType.value = randomType()
  hint.value = '点击「开始游戏」后开始消行'
  running = true
  startLoop()
}
function startGame() {
  if (overFlag) return
  started.value = true
  cols = MODES[mode.value].cols || MAX_COLS
  board = emptyBoard()
  timeLeft.value = MODES[mode.value].dur
  timeAccum = 0
  riseAccum = 0
  if (MODES[mode.value].garbage > 0) addGarbage(MODES[mode.value].garbage)
  spawn(nextType.value)
  nextType.value = randomType()
  hint.value = '← → 移动 · ↑ 旋转 · ↓ 软降 · 空格 直落'
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
    ui.pushLog(`🧱 俄罗斯方块：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🧱 俄罗斯方块：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.tetris) mg.tetris = { best: 0 }
  mg.tetris.best = Math.max(mg.tetris.best ?? 0, score.value)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  reset()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  stopLoop()
})
</script>

<template>
  <div class="tt-page">
    <div class="tt-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="tt-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="tt-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="tt-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="tt-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="tt-chip">🧹 <b class="mono">{{ lines }}</b> 行</span>
      <span class="tt-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="tt-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="tt-canvas" :width="W" :height="H"></canvas>

    <div class="tt-hint">{{ hint }}</div>

    <div class="tt-keys">
      <button v-if="!started" class="tt-start" @click="startGame()">▶ 开始游戏</button>
      <template v-else>
        <button class="tt-btn" @click="tryMove(-1, 0)">←</button>
        <button class="tt-btn" @click="tryRotate()">↻</button>
        <button class="tt-btn" @click="tryMove(1, 0)">→</button>
        <button class="tt-btn" @click="softDropOnce()">↓</button>
        <button class="tt-btn tt-btn-wide" @click="hardDrop()">⤓ 直落</button>
        <button class="tt-reset" @click="reset()">🔄 重置本局</button>
      </template>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="tt-mask">
      <div class="tt-result">
        <div class="tt-result-head"><b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b></div>
        <div class="tt-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ MODES[mode].target }}</span>
          <span class="dim">消行 {{ lines }}</span>
          <span v-if="passed" class="tt-gold">+{{ goldText }} 游戏币</span>
        </div>
        <button class="tt-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="tt-fire">
        <span v-for="i in 20" :key="i" class="tt-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="tt-info-mask" @click.self="showInfo = false">
      <div class="tt-info-box">
        <div class="tt-info-head"><b>🧱 俄罗斯方块 · 十模式说明</b><button class="tt-info-close" @click="showInfo = false">✕</button></div>
        <div class="tt-info-list">
          <div class="tt-info-row tt-info-rule">
            玩法：食材箱从上方落下，<b>← →</b> 移动、<b>↑</b> 旋转、<b>↓</b> 软降、<b>空格</b> 直落（触屏用下方按钮）。<br />
            填满一整行即消除：<b>1/2/3/4 行 = 10/30/60/100 分</b>，随等级（每消 8 行升 1 级）再 ×1.1。<br />
            方块种类：I/O/T/S/Z/J/L 对应胡萝卜/苹果/番茄/草莓/葡萄/香蕉/菠萝。<br />
            模式 5 起开局有<b>垃圾行</b>（带一个空洞），越高的模式越多、下落越快。<br />
            堆到顶部即结束；限时结束按得分结算，达标发游戏币（超出目标最多 +50%）。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="tt-info-row">
            <b class="tt-info-name">{{ m.label }}</b>
            <span class="tt-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tt-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.tt-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.tt-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.tt-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.tt-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.tt-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.tt-canvas { width: min(360px, 96%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); touch-action: none; }
.tt-hint {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
  min-height: 18px;
}
.tt-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.tt-start {
  padding: 12px 34px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #e8703f, #c9542e);
  border: none;
  box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35);
}
.tt-btn { width: 52px; height: 44px; border-radius: 12px; font-weight: 800; font-size: 17px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.tt-btn-wide { width: 96px; font-size: 14px; }
.tt-reset { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.tt-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.tt-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.tt-result-head { font-size: 18px; }
.tt-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.tt-gold { color: var(--good-strong); font-weight: 800; }
.tt-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.tt-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.tt-spark { position: absolute; font-size: 22px; color: var(--gold); animation: ttSpark 1.1s ease-out forwards; }
@keyframes ttSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.tt-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.tt-info-box {
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
.tt-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.tt-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.tt-info-list { display: flex; flex-direction: column; gap: 8px; }
.tt-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.tt-info-rule {
  display: block;
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.7;
}
.tt-info-rule b { color: var(--primary-strong); }
.tt-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.tt-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}
</style>
