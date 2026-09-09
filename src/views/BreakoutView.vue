<script setup>
// 锅铲打砖块（2026-09-09 新增，第 19 款；同日扩展玩法）：经典 Breakout——锅铲当挡板，食材当砖块
// 十模式差异：砖块随模式变小变多、砖阵离锅铲更远；道具掉落 / 移动砖块 / 多球 逐步加入
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 画布 ──
const W = 760
const H = 640
const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rand = (a, b) => a + Math.random() * (b - a)

// ── 砖块食材（分值 / 耐久 / 权重）──
const ING = [
  { id: 'apple', name: '苹果', score: 10, hp: 1, w: 22 },
  { id: 'carrot', name: '胡萝卜', score: 12, hp: 1, w: 20 },
  { id: 'tomato', name: '番茄', score: 15, hp: 1, w: 18 },
  { id: 'strawberry', name: '草莓', score: 18, hp: 1, w: 15 },
  { id: 'grape', name: '葡萄', score: 25, hp: 2, w: 10 },
  { id: 'banana', name: '香蕉', score: 30, hp: 2, w: 8 },
  { id: 'pineapple', name: '菠萝', score: 40, hp: 2, w: 5 },
  { id: 'mango', name: '芒果', score: 50, hp: 3, w: 2 },
]

// ── 十模式 ──
// rows/cols/bh/gap/padX：砖块数量与大小（越高越多越小）；move：顶部第几行左右移动；balls：初始球数；power：破砖掉道具概率
const MODES = {
  m1: { label: '模式1', dur: 40, spd: 300, pw: 150, rows: 3, cols: 5, bh: 46, gap: 8, padX: 46, move: 0, balls: 1, power: 0, target: 100, gold: 45, desc: '40 秒 · 目标 100 分 · 标准玩法：慢球宽铲、3 行大砖 · +45 币' },
  m2: { label: '模式2', dur: 45, spd: 330, pw: 140, rows: 3, cols: 6, bh: 42, gap: 7, padX: 46, move: 0, balls: 1, power: 0.08, target: 120, gold: 55, desc: '45 秒 · 目标 120 分 · 道具登场（加宽铲 / 分身球 / 减速）· +55 币' },
  m3: { label: '模式3', dur: 50, spd: 360, pw: 130, rows: 4, cols: 7, bh: 38, gap: 6, padX: 40, move: 1, balls: 1, power: 0.08, target: 145, gold: 60, desc: '50 秒 · 目标 145 分 · 顶行砖块左右移动 · +60 币' },
  m4: { label: '模式4', dur: 55, spd: 390, pw: 122, rows: 4, cols: 8, bh: 36, gap: 6, padX: 36, move: 0, balls: 2, power: 0.1, target: 175, gold: 70, desc: '55 秒 · 目标 175 分 · 双球开局 · +70 币' },
  m5: { label: '模式5', dur: 60, spd: 420, pw: 114, rows: 5, cols: 8, bh: 34, gap: 6, padX: 36, move: 1, balls: 2, power: 0.1, target: 245, gold: 80, desc: '60 秒 · 目标 245 分 · 双球 + 移动砖 · +80 币' },
  m6: { label: '模式6', dur: 65, spd: 455, pw: 108, rows: 5, cols: 9, bh: 32, gap: 5, padX: 30, move: 1, balls: 2, power: 0.12, target: 310, gold: 90, desc: '65 秒 · 目标 310 分 · 9 列小砖 · +90 币' },
  m7: { label: '模式7', dur: 70, spd: 490, pw: 102, rows: 6, cols: 9, bh: 30, gap: 5, padX: 30, move: 1, balls: 2, power: 0.12, target: 385, gold: 100, desc: '70 秒 · 目标 385 分 · 6 行砖 · +100 币' },
  m8: { label: '模式8', dur: 80, spd: 525, pw: 96, rows: 6, cols: 10, bh: 28, gap: 5, padX: 26, move: 2, balls: 3, power: 0.15, target: 520, gold: 120, desc: '80 秒 · 目标 520 分 · 三球 + 两行移动砖 · +120 币' },
  m9: { label: '模式9', dur: 90, spd: 560, pw: 90, rows: 7, cols: 10, bh: 26, gap: 5, padX: 26, move: 2, balls: 3, power: 0.15, target: 650, gold: 140, desc: '90 秒 · 目标 650 分 · 7 行细砖 · +140 币' },
  m10: { label: '模式10', dur: 100, spd: 600, pw: 84, rows: 7, cols: 11, bh: 25, gap: 4, padX: 22, move: 2, balls: 3, power: 0.2, target: 815, gold: 160, desc: '100 秒 · 目标 815 分 · 满砖阵 + 三球 + 移动砖 + 高频道具 · +160 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const canvas = ref(null)
const mode = ref('m1')
const score = ref(0)
const timeLeft = ref(40)
const lives = ref(3)
const combo = ref(0)
const maxCombo = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const best = computed(() => player.minigames?.breakout?.best ?? 0)
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)
const goldText = computed(() => {
  const m = MODES[mode.value]
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})
const effectText = computed(() => {
  const t = []
  if (wideT > 0) t.push('宽铲')
  if (slowT > 0) t.push('减速')
  return t.join(' · ')
})

// ── 内部状态 ──
let bricks = []
let balls = []
let drops = []
let sparks = []
let floats = []
let rowOff = []
let rowVel = []
let paddle = { x: W / 2, w: 150, h: 16, baseW: 150 }
let wave = 1
let wideT = 0
let slowT = 0
let timeAccum = 0
let waveT = 0
let shake = 0
let comboAt = 0
let running = false
let overFlag = false
let lastTs = 0
let loopId = null
let keyDir = 0

const IMGS = ING.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})

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

// ── 砖块布局 ──
function buildWave() {
  const m = MODES[mode.value]
  const padY = 62
  const bw = (W - m.padX * 2 - m.gap * (m.cols - 1)) / m.cols
  bricks = []
  rowOff = new Array(m.rows).fill(0)
  rowVel = new Array(m.rows).fill(0)
  const pool = []
  for (let i = 0; i < ING.length; i++) for (let k = 0; k < ING[i].w; k++) pool.push(i)
  for (let r = 0; r < m.rows; r++) {
    if (r < m.move) rowVel[r] = (r % 2 ? 1 : -1) * rand(34, 58)
    for (let c = 0; c < m.cols; c++) {
      let i = pool[Math.floor(Math.random() * pool.length)]
      if (r === 0 && Math.random() < 0.5) i = Math.min(ING.length - 1, i + 3)
      const ing = ING[i]
      bricks.push({
        i, row: r, bx: m.padX + c * (bw + m.gap), y: padY + r * (m.bh + m.gap),
        w: bw, h: m.bh, hp: ing.hp, maxHp: ing.hp, score: ing.score,
      })
    }
  }
  wave = (wave || 0) + 1
}
function brickX(b) {
  const m = MODES[mode.value]
  return b.bx + (b.row < m.move ? rowOff[b.row] : 0)
}
function resetBalls() {
  const m = MODES[mode.value]
  balls = []
  for (let i = 0; i < m.balls; i++) {
    balls.push({ x: paddle.x + (i - (m.balls - 1) / 2) * 26, y: H - 130, vx: 0, vy: 0, r: 8, stuck: true })
  }
}
function launchBalls() {
  const m = MODES[mode.value]
  for (const b of balls) {
    if (!b.stuck) continue
    const ang = rand(-0.5, 0.5)
    const sp = m.spd
    b.vx = Math.sin(ang) * sp
    b.vy = -Math.cos(ang) * sp
    b.stuck = false
  }
}

// ── 输入 ──
function toCanvasX(e) {
  const cv = canvas.value
  const rect = cv.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * W
}
function movePaddle(x) {
  paddle.x = clamp(x, paddle.w / 2, W - paddle.w / 2)
}
function onDown(e) {
  if (!running || overFlag || !started.value) return
  movePaddle(toCanvasX(e))
  if (balls.some((b) => b.stuck)) launchBalls()
}
function onMove(e) {
  if (!running || overFlag || !started.value) return
  movePaddle(toCanvasX(e))
}
function onKey(e) {
  if (!running || overFlag || !started.value) return
  if (e.key === 'ArrowLeft') keyDir = -1
  else if (e.key === 'ArrowRight') keyDir = 1
  else if (e.key === ' ' || e.key === 'ArrowUp') launchBalls()
}
function onKeyUp(e) {
  if (e.key === 'ArrowLeft' && keyDir < 0) keyDir = 0
  if (e.key === 'ArrowRight' && keyDir > 0) keyDir = 0
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
      if (combo.value > 0 && performance.now() - comboAt > 2000) combo.value = 0
      // 道具计时
      if (wideT > 0) {
        wideT -= dt
        if (wideT <= 0) paddle.w = paddle.baseW
      }
      if (slowT > 0) slowT -= dt
      if (keyDir) movePaddle(paddle.x + keyDir * 620 * dt)
      // 移动砖块行
      for (let r = 0; r < m.move; r++) {
        rowOff[r] += rowVel[r] * dt
        let minX = 1e9
        let maxX = -1e9
        for (const b of bricks) {
          if (b.row !== r) continue
          minX = Math.min(minX, b.bx + rowOff[r])
          maxX = Math.max(maxX, b.bx + rowOff[r] + b.w)
        }
        if (minX < 6 && rowVel[r] < 0) rowVel[r] = -rowVel[r]
        if (maxX > W - 6 && rowVel[r] > 0) rowVel[r] = -rowVel[r]
      }
      // 球
      const py = H - 70
      const spdMul = slowT > 0 ? 0.75 : 1
      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const ball = balls[bi]
        if (ball.stuck) {
          ball.x = paddle.x + (bi - (balls.length - 1) / 2) * 26
          ball.y = H - 130
          continue
        }
        ball.x += ball.vx * spdMul * dt
        ball.y += ball.vy * spdMul * dt
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); beep(500, 0.04) }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); beep(500, 0.04) }
        if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); beep(500, 0.04) }
        // 挡板
        if (ball.vy > 0 && ball.y + ball.r >= py && ball.y - ball.r <= py + paddle.h && Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r) {
          const off = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1)
          const ang = off * (Math.PI / 3)
          const sp = Math.hypot(ball.vx, ball.vy) || m.spd
          ball.vx = Math.sin(ang) * sp
          ball.vy = -Math.cos(ang) * sp
          ball.y = py - ball.r
          beep(660, 0.05, 'triangle')
        }
        // 砖块
        for (let k = bricks.length - 1; k >= 0; k--) {
          const b = bricks[k]
          const bx = brickX(b)
          const cx = clamp(ball.x, bx, bx + b.w)
          const cy = clamp(ball.y, b.y, b.y + b.h)
          const dx = ball.x - cx
          const dy = ball.y - cy
          if (dx * dx + dy * dy <= ball.r * ball.r) {
            const ox = (ball.r + b.w / 2) - Math.abs(ball.x - (bx + b.w / 2))
            const oy = (ball.r + b.h / 2) - Math.abs(ball.y - (b.y + b.h / 2))
            if (ox < oy) ball.vx = ball.x < bx + b.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx)
            else ball.vy = ball.y < b.y + b.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy)
            hitBrick(b)
            break
          }
        }
        if (ball.y > H + ball.r) balls.splice(bi, 1)
      }
      if (balls.length === 0 && !overFlag) {
        lives.value--
        shake = 1
        floats.push({ x: W / 2, y: H - 150, text: '掉球！-1 ❤', life: 0, max: 1.2, color: '#e06a5a' })
        beep(160, 0.3, 'sawtooth', 0.08)
        if (lives.value <= 0) settle()
        else resetBalls()
      }
      // 道具下落
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.y += 220 * dt
        if (d.y > H + 20) { drops.splice(i, 1); continue }
        if (d.y + 12 >= py && d.y - 12 <= py + paddle.h && Math.abs(d.x - paddle.x) <= paddle.w / 2 + 14) {
          applyDrop(d)
          drops.splice(i, 1)
        }
      }
      // 清空一波 → 下一波
      if (bricks.length === 0 && started.value && !overFlag) {
        buildWave()
        m.spd = Math.round(m.spd * 1.05)
        resetBalls()
        floats.push({ x: W / 2, y: 50, text: `第 ${wave} 波！球速提升`, life: 0, max: 1.4, color: '#ffd65a' })
        beep(880, 0.1)
        setTimeout(() => beep(1175, 0.12), 100)
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
function applyDrop(d) {
  if (d.kind === 'wide') {
    wideT = 9
    paddle.w = paddle.baseW * 1.45
    floats.push({ x: d.x, y: d.y - 20, text: '宽铲 9 秒', life: 0, max: 1.2, color: '#7fd08a' })
    beep(980, 0.08)
  } else if (d.kind === 'slow') {
    slowT = 7
    floats.push({ x: d.x, y: d.y - 20, text: '减速 7 秒', life: 0, max: 1.2, color: '#8fc0e8' })
    beep(760, 0.08)
  } else {
    const src = balls.find((b) => !b.stuck) || balls[0]
    if (src && balls.length < 6) {
      const sp = Math.hypot(src.vx, src.vy) || MODES[mode.value].spd
      const a = Math.atan2(src.vy, src.vx) + rand(-0.6, 0.6)
      balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, stuck: false })
    }
    floats.push({ x: d.x, y: d.y - 20, text: '分身球！', life: 0, max: 1.2, color: '#ffd65a' })
    beep(1180, 0.09)
  }
}
function hitBrick(b) {
  b.hp--
  const bx = brickX(b)
  if (b.hp > 0) {
    for (let i = 0; i < 5; i++) sparks.push({ x: bx + b.w / 2, y: b.y + b.h / 2, vx: rand(-90, 90), vy: rand(-120, 20), life: 0, max: rand(0.25, 0.5), color: '#ffe08a', size: rand(1.2, 2.4) })
    beep(720, 0.05, 'square', 0.05)
    return
  }
  const now = performance.now()
  combo.value = now - comboAt < 2000 ? combo.value + 1 : 1
  comboAt = now
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  const mult = 1 + Math.min(0.5, 0.1 * (combo.value - 1))
  const gain = Math.round(b.score * mult)
  score.value += gain
  floats.push({ x: bx + b.w / 2, y: b.y + b.h / 2, text: `+${gain}`, life: 0, max: 0.8, color: '#ffd65a' })
  for (let i = 0; i < 10; i++) sparks.push({ x: bx + b.w / 2, y: b.y + b.h / 2, vx: rand(-150, 150), vy: rand(-150, 30), life: 0, max: rand(0.3, 0.6), color: '#ffe08a', size: rand(1.4, 2.8) })
  bricks.splice(bricks.indexOf(b), 1)
  beep(880 + combo.value * 30, 0.06, 'triangle')
  const m = MODES[mode.value]
  if (m.power > 0 && Math.random() < m.power) {
    const kinds = ['wide', 'slow', 'multi']
    drops.push({ x: bx + b.w / 2, y: b.y + b.h / 2, vy: 0, kind: kinds[Math.floor(Math.random() * kinds.length)] })
  }
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
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 6, rand(-1, 1) * shake * 6)
  drawBackdrop(ctx, dark)
  for (const b of bricks) drawBrick(ctx, b)
  drawDrops(ctx)
  drawPaddle(ctx, dark)
  for (const b of balls) drawBall(ctx, b)
  drawSparks(ctx)
  drawFloats(ctx)
  drawHud(ctx, dark)
  ctx.restore()
}
function drawBackdrop(ctx, dark) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  if (dark) { g.addColorStop(0, '#241a14'); g.addColorStop(1, '#15100c') } else { g.addColorStop(0, '#f7ecdc'); g.addColorStop(1, '#e2cbaa') }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(120,80,40,0.10)'
  ctx.lineWidth = 1
  for (let i = 0; i < 34; i++) {
    const y = i * 22 + 8
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 2)
    ctx.stroke()
  }
  const rg = ctx.createRadialGradient(W / 2, 40, 20, W / 2, 40, 460)
  rg.addColorStop(0, dark ? 'rgba(255,210,150,0.06)' : 'rgba(255,255,255,0.3)')
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(120,80,40,0.2)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, H - 20)
  ctx.lineTo(W, H - 20)
  ctx.stroke()
}
function drawBrick(ctx, b) {
  const im = IMGS[b.i]
  const x = brickX(b)
  const y = b.y
  ctx.save()
  ctx.fillStyle = 'rgba(255,252,246,0.9)'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x, y, b.w, b.h, 8) : ctx.rect(x, y, b.w, b.h)
  ctx.fill()
  ctx.strokeStyle = 'rgba(150,110,70,0.45)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  const s = Math.min(b.h - 6, b.w - 10, 40)
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x + (b.w - s) / 2, y + (b.h - s) / 2, s, s)
  if (b.maxHp > 1) {
    ctx.fillStyle = 'rgba(217,90,56,0.9)'
    ctx.beginPath()
    ctx.arc(x + b.w - 11, y + 11, 8, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(b.hp), x + b.w - 11, y + 15)
  }
  ctx.restore()
}
function drawDrops(ctx) {
  for (const d of drops) {
    ctx.save()
    ctx.translate(d.x, d.y)
    const col = d.kind === 'wide' ? '#7fd08a' : d.kind === 'slow' ? '#8fc0e8' : '#ffd65a'
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 15)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(1, col)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(90,60,20,0.5)'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = '#3a2a10'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(d.kind === 'wide' ? '↔' : d.kind === 'slow' ? '🐢' : '●', 0, 5)
    ctx.restore()
  }
}
function drawPaddle(ctx, dark) {
  const py = H - 70
  ctx.save()
  ctx.translate(paddle.x, py)
  const g = ctx.createLinearGradient(0, -8, 0, 10)
  g.addColorStop(0, dark ? '#b9c3cc' : '#d8e0e8')
  g.addColorStop(1, dark ? '#6d7681' : '#98a4b0')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(-paddle.w / 2, 0, paddle.w, paddle.h, 8) : ctx.rect(-paddle.w / 2, 0, paddle.w, paddle.h)
  ctx.fill()
  ctx.strokeStyle = wideT > 0 ? '#7fd08a' : 'rgba(60,70,80,0.5)'
  ctx.lineWidth = wideT > 0 ? 2.4 : 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(-paddle.w / 2 + 6, 3, paddle.w - 12, 4, 2) : ctx.rect(-paddle.w / 2 + 6, 3, paddle.w - 12, 4)
  ctx.fill()
  ctx.fillStyle = '#7a5230'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(-7, paddle.h - 2, 14, 16, 5) : ctx.rect(-7, paddle.h - 2, 14, 16)
  ctx.fill()
  ctx.restore()
}
function drawBall(ctx, ball) {
  ctx.save()
  const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.r)
  g.addColorStop(0, '#fff7e6')
  g.addColorStop(1, slowT > 0 ? '#7fc0e8' : '#e0a13a')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.r, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(120,80,20,0.5)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
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
  for (let i = 0; i < 3; i++) ctx.fillText(i < lives.value ? '❤️' : '🖤', 10 + i * 22, 26)
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(90,60,30,0.55)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(`第 ${wave} 波`, 10, 48)
  if (effectText.value) {
    ctx.fillStyle = '#7fd08a'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillText('⚡ ' + effectText.value, 10, 66)
  }
  if (combo.value >= 2) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(20,30,44,0.4)'
    ctx.fillRect(W - 104, 10, 92, 26)
    ctx.fillStyle = '#ffd65a'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.fillText(`🔥 连击 ×${combo.value}`, W - 58, 28)
  }
  if (!started.value) {
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(90,60,30,0.65)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('点击下方「开始游戏」，移动鼠标控制锅铲', W / 2, H / 2)
  } else if (balls.some((b) => b.stuck) && !overFlag) {
    ctx.textAlign = 'center'
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(90,60,30,0.7)'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('点击/空格 发球', W / 2, H - 130)
  }
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  const m = MODES[mode.value]
  wave = 0
  bricks = []
  balls = []
  drops = []
  sparks = []
  floats = []
  rowOff = []
  rowVel = []
  paddle = { x: W / 2, w: m.pw, h: 16, baseW: m.pw }
  wideT = 0
  slowT = 0
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  lives.value = 3
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  shake = 0
  comboAt = 0
  keyDir = 0
  hint.value = '点击「开始游戏」后，移动鼠标控制锅铲'
  running = true
  startLoop()
}
function startGame() {
  if (overFlag) return
  started.value = true
  timeLeft.value = MODES[mode.value].dur
  timeAccum = 0
  buildWave()
  resetBalls()
  hint.value = '移动锅铲接球 · 点击/空格 发球'
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
    ui.pushLog(`🍳 锅铲打砖块：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🍳 锅铲打砖块：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.breakout) mg.breakout = { best: 0 }
  mg.breakout.best = Math.max(mg.breakout.best ?? 0, score.value)
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
  <div class="bk-page">
    <div class="bk-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="bk-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="bk-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="bk-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="bk-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="bk-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="bk-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="bk-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="bk-canvas" :width="W" :height="H" @pointerdown="onDown" @pointermove="onMove"></canvas>

    <div class="bk-hint">{{ hint }}</div>

    <div class="bk-keys">
      <button v-if="!started" class="bk-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="bk-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="bk-mask">
      <div class="bk-result">
        <div class="bk-result-head"><b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b></div>
        <div class="bk-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ MODES[mode].target }}</span>
          <span class="dim">最高连击 ×{{ maxCombo }}</span>
          <span v-if="passed" class="bk-gold">+{{ goldText }} 游戏币</span>
        </div>
        <button class="bk-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="bk-fire">
        <span v-for="i in 20" :key="i" class="bk-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="bk-info-mask" @click.self="showInfo = false">
      <div class="bk-info-box">
        <div class="bk-info-head"><b>🍳 锅铲打砖块 · 十模式说明</b><button class="bk-info-close" @click="showInfo = false">✕</button></div>
        <div class="bk-info-list">
          <div class="bk-info-row bk-info-rule">
            玩法：<b>移动鼠标/手指</b>控制锅铲（← → 也可，空格发球），点击发球；球碰到砖块得分，
            <b>清空一波自动刷新下一波</b>（球速再涨 5%）。<br />
            砖块耐久：普通食材 1 下，葡萄/香蕉/菠萝 2 下，芒果 3 下（右上角数字是剩余耐久）；分越高越硬。<br />
            挡板接球位置影响反弹角度；球全部掉下去扣 1 条命（共 3 条）。<br />
            <b>模式变化</b>：模式越高砖块越多越小、砖阵离锅铲越远；2 起有<b>道具</b>（↔ 加宽铲 9 秒 / 🐢 减速 7 秒 / ● 分身球）、
            3 起顶行<b>砖块左右移动</b>、4 起<b>多球</b>开局（掉光所有球才扣命）。<br />
            连击：2 秒内连续破砖累计连击，单块得分最高 ×1.5；限时结束按得分结算（超出目标最多 +50%）。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="bk-info-row">
            <b class="bk-info-name">{{ m.label }}</b>
            <span class="bk-info-desc">{{ m.desc }}</span>
          </div>
          <div class="bk-info-row bk-info-rule">
            砖块图鉴：{{ ING.map((f) => f.name + '(' + f.score + '分/' + f.hp + '耐)').join('、') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bk-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.bk-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.bk-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.bk-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.bk-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.bk-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.bk-canvas { width: min(760px, 98%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); cursor: none; touch-action: none; }
.bk-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.bk-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.bk-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.bk-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.bk-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.bk-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.bk-result-head { font-size: 18px; }
.bk-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.bk-gold { color: var(--good-strong); font-weight: 800; }
.bk-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.bk-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.bk-spark { position: absolute; font-size: 22px; color: var(--gold); animation: bkSpark 1.1s ease-out forwards; }
@keyframes bkSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.bk-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.bk-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.bk-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.bk-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.bk-info-list { display: flex; flex-direction: column; gap: 8px; }
.bk-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.bk-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.bk-info-rule b { color: var(--primary-strong); }
.bk-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.bk-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
