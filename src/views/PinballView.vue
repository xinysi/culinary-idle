<script setup>
// 厨房弹珠台（2026-09-09 新增，第 28 款）：锅铲当挡板拍击弹珠，撞食材得分
// 十模式：时长 40~100 秒 × 弹珠台机关数 3~14 × 重力 × 挡板长度 × 移动机关
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, bumpers: 3, grav: 900, fl: 1, move: 0, target: 555, gold: 45, desc: '40 秒 · 目标 555 分 · 3 个食材机关，慢球好控制 · +45 币' },
  m2: { label: '模式2', dur: 45, bumpers: 4, grav: 950, fl: 1, move: 0, target: 625, gold: 55, desc: '45 秒 · 目标 625 分 · 4 个机关 · +55 币' },
  m3: { label: '模式3', dur: 50, bumpers: 5, grav: 1000, fl: 1, move: 1, target: 695, gold: 60, desc: '50 秒 · 目标 695 分 · **机关会左右移动** · +60 币' },
  m4: { label: '模式4', dur: 55, bumpers: 6, grav: 1050, fl: 0.95, move: 1, target: 760, gold: 70, desc: '55 秒 · 目标 760 分 · 6 个机关 · +70 币' },
  m5: { label: '模式5', dur: 60, bumpers: 7, grav: 1100, fl: 0.92, move: 1, target: 830, gold: 80, desc: '60 秒 · 目标 830 分 · 球更快，挡板略短 · +80 币' },
  m6: { label: '模式6', dur: 65, bumpers: 8, grav: 1150, fl: 0.88, move: 1, target: 900, gold: 90, desc: '65 秒 · 目标 900 分 · 8 个机关 · +90 币' },
  m7: { label: '模式7', dur: 70, bumpers: 9, grav: 1200, fl: 0.85, move: 2, target: 970, gold: 100, desc: '70 秒 · 目标 970 分 · 机关移动更快 · +100 币' },
  m8: { label: '模式8', dur: 80, bumpers: 10, grav: 1250, fl: 0.82, move: 2, target: 1110, gold: 120, desc: '80 秒 · 目标 1110 分 · 10 个机关 · +120 币' },
  m9: { label: '模式9', dur: 90, bumpers: 12, grav: 1300, fl: 0.78, move: 2, target: 1245, gold: 140, desc: '90 秒 · 目标 1245 分 · 12 个机关，挡板更短 · +140 币' },
  m10: { label: '模式10', dur: 100, bumpers: 14, grav: 1350, fl: 0.72, move: 3, target: 1385, gold: 160, desc: '100 秒 · 目标 1385 分 · 满台机关 + 最快球速 · +160 币' },
}
const FOODS = ['🍅', '🍇', '🍋', '🥕', '🍄', '🌰', '🍑', '🫑', '🥑', '🍆', '🌽', '🍍', '🥦', '🍎']
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const balls = ref(3)
const combo = ref(0)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.pinball?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const W = 720
const H = 520
const R = 11
const canvasEl = ref(null)
let canvas = null
let ctx = null
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let ball = null // { x, y, vx, vy }
let bumpers = [] // { x, y, r, icon, pts, vx }
let flippers = [] // { px, py, len, ang, targetAng, dir, active }
let floats = []
let guides = [] // 两侧回球导轨：把边路的球导向挡板
let drops = [] // 掉落靶（打中消失，全清有奖励）
let spinners = [] // 旋转风车（撞到加分并加速旋转）
let kickers = [] // 弹射孔（吸入 0.5 秒后弹出 +60）
let topAt = 0 // 顶部通道奖励冷却
let dropClearAt = 0
let respawnAt = 0
let comboAt = 0
let keyLeft = false
let keyRight = false
let stuckAccum = 0

function rand(a, b) { return a + Math.random() * (b - a) }

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

function buildBoard() {
  const m = cfg.value
  bumpers = []
  floats = []
  // 机关排布：每局随机选一种图案（网格 / 菱形 / 散点），行列数与抖动随机
  const placed = []
  // 对称图案（每局随机一种）：弧阵 / 菱形 / 双翼 / 三角
  const pattern = ['arc', 'diamond', 'wings', 'tri'][Math.floor(Math.random() * 4)]
  const spots = []
  const cx = W / 2
  if (pattern === 'arc') {
    for (let i = 0; i < m.bumpers; i++) {
      const a = -1.05 + (i / Math.max(1, m.bumpers - 1)) * 2.1
      spots.push({ x: cx + Math.sin(a) * 250, y: 300 - Math.cos(a) * 150 })
    }
  } else if (pattern === 'diamond') {
    const step = 76
    const cells = []
    for (let gy = -2; gy <= 2; gy++) for (let gx = -3; gx <= 3; gx++) {
      if (Math.abs(gx) + Math.abs(gy) > 2) continue
      cells.push({ x: cx + gx * step, y: 240 + gy * step * 0.7 })
    }
    cells.sort((a, b) => (Math.abs(a.x - cx) + Math.abs(a.y - 240)) - (Math.abs(b.x - cx) + Math.abs(b.y - 240)))
    for (const c of cells) { if (spots.length >= m.bumpers) break; spots.push(c) }
  } else if (pattern === 'wings') {
    const half = Math.ceil(m.bumpers / 2)
    for (let i = 0; i < m.bumpers; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const k = Math.floor(i / 2)
      spots.push({ x: cx + side * (120 + (k % 3) * 78), y: 170 + Math.floor(k / 3) * 84 + (k % 3) * 8 })
    }
  } else {
    let k = 0
    for (let row = 0; k < m.bumpers; row++) {
      const cnt = row + 1
      for (let i = 0; i < cnt && k < m.bumpers; i++, k++) spots.push({ x: cx + (i - (cnt - 1) / 2) * 92, y: 168 + row * 82 })
    }
  }
  for (const sp of spots) {
    const r = rand(15, 23)
    if (!placed.every((p) => Math.hypot(p.x - sp.x, p.y - sp.y) > p.r + r + 12)) continue
    placed.push({ x: sp.x, y: sp.y, r })
    bumpers.push({ x: sp.x, y: sp.y, r, icon: FOODS[(placed.length - 1) % FOODS.length], pts: r < 17 ? 50 : r < 20 ? 20 : 10, vx: m.move ? (Math.random() < 0.5 ? -1 : 1) * (m.move === 3 ? 74 : m.move === 2 ? 54 : 34) : 0 })
  }
  // 掉落靶：一排小方块，打中消失并得分；全清 +200 并 3 秒后重置
  drops = []
  const dn = 3 + Math.floor(Math.random() * (m.bumpers >= 8 ? 4 : m.bumpers >= 5 ? 3 : 2))
  const rowsD = m.bumpers >= 8 && Math.random() < 0.45 ? 2 : 1
  const dw = rand(38, 50), gap = rand(12, 22)
  const startY = rand(378, 400)
  for (let r0 = 0; r0 < rowsD; r0++) {
    const cnt = Math.max(2, Math.round(dn / rowsD))
    const startX = W / 2 - (cnt * dw + (cnt - 1) * gap) / 2 + dw / 2
    for (let i = 0; i < cnt; i++) drops.push({ x: startX + i * (dw + gap), y: startY + r0 * (24 + rand(0, 8)), w: dw, h: 16, alive: true })
  }
  // 旋转风车：模式 4 起 1 个、模式 7 起 2 个
  spinners = []
  const spinN = m.bumpers >= 11 ? 2 : m.bumpers >= 7 ? 2 : m.bumpers >= 4 ? 1 : 0
  for (let i = 0; i < spinN; i++) {
    spinners.push({ x: cx + (spinN === 1 ? 0 : (i === 0 ? -1 : 1) * rand(120, 190)), y: rand(196, 268), ang: Math.random() * 6.28, spin: 0 })
  }
  // 弹射孔：模式 6 起 1 个、模式 9 起 2 个
  kickers = []
  const kickN = m.bumpers >= 12 ? 2 : m.bumpers >= 8 ? 1 : 0
  for (let i = 0; i < kickN; i++) {
    kickers.push({ x: cx + (kickN === 1 ? rand(-200, 200) : (i === 0 ? -1 : 1) * rand(150, 210)), y: rand(150, 230), r: 21, hold: 0 })
  }
  // 弹弓（经典弹珠台元素）：每局随机 2~4 个、左右不对称、位置与高度随机
  const slingN = 2 + (m.bumpers >= 9 ? 2 : m.bumpers >= 6 ? 1 : 0) + (Math.random() < 0.4 ? 1 : 0)
  const slingSpots = []
  for (let i = 0; i < slingN; i++) {
    for (let t = 0; t < 80; t++) {
      const side = Math.random() < 0.5 ? -1 : 1
      const x = W / 2 + side * rand(148, 238)
      const y = rand(322, 368)
      if (x < 66 || x > W - 66) continue
      if (slingSpots.every((p) => Math.hypot(p.x - x, p.y - y) > 96)) { slingSpots.push({ x, y }); break }
    }
  }
  for (const sp of slingSpots) bumpers.push({ x: sp.x, y: sp.y, r: rand(24, 30), icon: Math.random() < 0.5 ? '🧄' : '🧅', pts: 5, vx: 0, sling: true })
  flippers = [
    { px: W / 2 - 112, py: H - 58, len: 100 * m.fl, ang: 0.42, targetAng: 0.42, dir: 1 },
    { px: W / 2 + 112, py: H - 58, len: 100 * m.fl, ang: Math.PI - 0.42, targetAng: Math.PI - 0.42, dir: -1 },
  ]
  // 回球导轨：从侧壁斜下延伸到挡板根部（边路的球会滑到挡板上，而不是直接漏掉）
  guides = [
    { x1: 26, y1: H - 210, x2: W / 2 - 116, y2: H - 62 },
    { x1: W - 26, y1: H - 210, x2: W / 2 + 116, y2: H - 62 },
  ]
  score.value = 0
  balls.value = 3
  combo.value = 0
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  timeAccum = 0
  keyLeft = false
  keyRight = false
  stuckAccum = 0
  spawnBall()
  draw()
}
function spawnBall() {
  // 从右下角发射：沿右侧墙冲上去，撞顶部圆弧后落进机关区（经典弹珠台发球）
  ball = { x: W / 2 + rand(-170, 170), y: 128, vx: rand(-130, 130), vy: 70 }
  respawnAt = 0
}
function startGame() {
  if (started.value) return
  started.value = true
  lastTs = 0
  beep(880, 0.08)
}
function reset() {
  stopLoop()
  buildBoard()
  started.value = false
  startLoop()
}

function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  if (started.value && !overFlag) {
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) { settle(); return } }
    step(dt)
  }
  for (const f of floats) { f.life += dt; f.y -= 44 * dt }
  floats = floats.filter((f) => f.life < f.max)
  draw()
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function step(dt) {
  const m = cfg.value
  // 机关移动
  for (const b of bumpers) {
    if (!b.vx) continue
    b.x += b.vx * dt
    if (b.x < 90 + b.r) { b.x = 90 + b.r; b.vx = -b.vx }
    if (b.x > W - 90 - b.r) { b.x = W - 90 - b.r; b.vx = -b.vx }
  }
  // 挡板角度动画
  for (const fl of flippers) {
    const want = fl.active ? (fl.dir > 0 ? -0.5 : Math.PI + 0.5) : (fl.dir > 0 ? 0.42 : Math.PI - 0.42)
    fl.targetAng = want
    const d = fl.targetAng - fl.ang
    fl.ang += Math.max(-14 * dt, Math.min(14 * dt, d))
  }
  if (!ball) {
    if (respawnAt && performance.now() >= respawnAt) spawnBall()
    return
  }
  // 物理
  ball.vy += m.grav * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  // 侧壁
  if (ball.x < 24 + R) { ball.x = 24 + R; ball.vx = Math.abs(ball.vx) * 0.92 }
  if (ball.x > W - 24 - R) { ball.x = W - 24 - R; ball.vx = -Math.abs(ball.vx) * 0.92 }
  // 右侧发射道：道内左壁挡住球（球从道底冲到顶部后从左侧进入台面）
  const laneX = W - 74
  if (ball.x > laneX - R && ball.y > 210 && ball.x < laneX) { ball.x = laneX - R; ball.vx = Math.abs(ball.vx) * 0.8 }
  // 顶部墙
  if (ball.y < 40 + R) { ball.y = 40 + R; ball.vy = Math.abs(ball.vy) * 0.92 }
  // 机关碰撞
  for (const b of bumpers) {
    const d = Math.hypot(ball.x - b.x, ball.y - b.y)
    if (d < b.r + R && d > 0.001) {
      const nx = (ball.x - b.x) / d
      const ny = (ball.y - b.y) / d
      ball.x = b.x + nx * (b.r + R)
      ball.y = b.y + ny * (b.r + R)
      const dot = ball.vx * nx + ball.vy * ny
      ball.vx -= 2 * dot * nx
      ball.vy -= 2 * dot * ny
      const sp = Math.hypot(ball.vx, ball.vy)
      const boost = Math.max(sp, 300) * (b.sling ? 1.35 : 1.06)
      const cur = Math.max(sp, 1)
      ball.vx = (ball.vx / cur) * boost
      ball.vy = (ball.vy / cur) * boost
      // 计分（1.2 秒连击）
      const now = performance.now()
      if (now - comboAt < 1200) combo.value++
      else combo.value = 1
      comboAt = now
      const mult = 1 + Math.min(0.5, Math.max(0, combo.value - 1) * 0.1)
      const gain = Math.round(b.pts * mult)
      score.value += gain
      floats.push({ x: b.x, y: b.y - b.r - 4, life: 0, max: 0.9, text: `+${gain}`, good: true })
      beep(660 + Math.min(8, combo.value) * 60, 0.06, 'triangle', 0.05)
    }
  }
  // 旋转风车：持续自转，撞到则加速 + 15 分
  for (const sp of spinners) {
    sp.ang += (2.2 + sp.spin) * dt
    sp.spin = Math.max(0, sp.spin - dt * 3)
    const hw = 34, hh = 7
    const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang)
    for (const sgn of [-1, 1]) {
      const tx = sp.x + ca * hw * sgn
      const ty = sp.y + sa * hw * sgn
      const segX = tx - sp.x, segY = ty - sp.y
      const segL2 = segX * segX + segY * segY
      let t = ((ball.x - sp.x) * segX + (ball.y - sp.y) * segY) / segL2
      t = Math.max(0, Math.min(1, t))
      const px = sp.x + segX * t, py = sp.y + segY * t
      const d = Math.hypot(ball.x - px, ball.y - py)
      const rad = R + hh
      if (d < rad && d > 0.001) {
        const nx = (ball.x - px) / d, ny = (ball.y - py) / d
        ball.x = px + nx * rad; ball.y = py + ny * rad
        const dot = ball.vx * nx + ball.vy * ny
        if (dot < 0) { ball.vx -= 2 * dot * nx * 0.9; ball.vy -= 2 * dot * ny * 0.9 }
        sp.spin = Math.min(9, sp.spin + 3)
        score.value += 15
        floats.push({ x: sp.x, y: sp.y - 20, life: 0, max: 0.8, text: '+15', good: true })
        beep(560, 0.05, 'square', 0.04)
      }
    }
  }
  // 弹射孔：球进入后 0.5 秒弹出 + 60 分
  for (const k of kickers) {
    if (k.hold > 0) {
      k.hold -= dt
      ball.x = k.x; ball.y = k.y; ball.vx = 0; ball.vy = 0
      if (k.hold <= 0) {
        ball.vx = rand(-180, 180); ball.vy = -680
        score.value += 60
        floats.push({ x: k.x, y: k.y - 26, life: 0, max: 1, text: '+60', good: true })
        beep(1046, 0.1); setTimeout(() => beep(1568, 0.12), 90)
      }
      break
    }
    if (Math.hypot(ball.x - k.x, ball.y - k.y) < k.r && Math.abs(ball.vy) < 520) { k.hold = 0.5; beep(320, 0.08, 'sine', 0.05) }
  }
  // 掉落靶碰撞
  for (const d of drops) {
    if (!d.alive) continue
    const nx = Math.max(d.x - d.w / 2, Math.min(ball.x, d.x + d.w / 2))
    const ny = Math.max(d.y - d.h / 2, Math.min(ball.y, d.y + d.h / 2))
    const dd = Math.hypot(ball.x - nx, ball.y - ny)
    if (dd < R) {
      const ux = dd > 0.001 ? (ball.x - nx) / dd : 0
      const uy = dd > 0.001 ? (ball.y - ny) / dd : -1
      ball.x = nx + ux * R
      ball.y = ny + uy * R
      const dot = ball.vx * ux + ball.vy * uy
      if (dot < 0) { ball.vx -= 2 * dot * ux * 0.9; ball.vy -= 2 * dot * uy * 0.9 }
      d.alive = false
      score.value += 30
      floats.push({ x: d.x, y: d.y - 16, life: 0, max: 0.9, text: '+30', good: true })
      beep(740, 0.06, 'triangle', 0.05)
      if (drops.every((x) => !x.alive)) {
        score.value += 200
        floats.push({ x: W / 2, y: 360, life: 0, max: 1.2, text: '全清 +200', good: true })
        beep(1046, 0.12); setTimeout(() => beep(1568, 0.16), 120)
        dropClearAt = performance.now() + 3000
      }
    }
  }
  if (dropClearAt && performance.now() >= dropClearAt) { dropClearAt = 0; for (const d of drops) d.alive = true }
  // 顶部通道：球穿过顶部横带 +50（2 秒冷却）
  if (ball.y < 62 && performance.now() - topAt > 2000) {
    topAt = performance.now()
    score.value += 50
    floats.push({ x: ball.x, y: 70, life: 0, max: 0.9, text: '+50', good: true })
    beep(880, 0.07, 'triangle', 0.05)
  }
  // 回球导轨碰撞
  for (const gd of guides) {
    const segX = gd.x2 - gd.x1, segY = gd.y2 - gd.y1
    const segL2 = segX * segX + segY * segY
    let t = ((ball.x - gd.x1) * segX + (ball.y - gd.y1) * segY) / segL2
    t = Math.max(0, Math.min(1, t))
    const cx = gd.x1 + segX * t
    const cy = gd.y1 + segY * t
    const d = Math.hypot(ball.x - cx, ball.y - cy)
    const rad = R + 6
    if (d < rad && d > 0.001) {
      const nx = (ball.x - cx) / d
      const ny = (ball.y - cy) / d
      ball.x = cx + nx * rad
      ball.y = cy + ny * rad
      const dot = ball.vx * nx + ball.vy * ny
      if (dot < 0) { ball.vx -= 2 * dot * nx * 0.82; ball.vy -= 2 * dot * ny * 0.82 }
    }
  }
  // 挡板碰撞（胶囊体）
  for (const fl of flippers) {
    const tx = fl.px + Math.cos(fl.ang) * fl.len
    const ty = fl.py + Math.sin(fl.ang) * fl.len
    const segX = tx - fl.px, segY = ty - fl.py
    const segL2 = segX * segX + segY * segY
    let t = ((ball.x - fl.px) * segX + (ball.y - fl.py) * segY) / segL2
    t = Math.max(0, Math.min(1, t))
    const cx = fl.px + segX * t
    const cy = fl.py + segY * t
    const d = Math.hypot(ball.x - cx, ball.y - cy)
    const rad = R + 8
    if (d < rad && d > 0.001) {
      const nx = (ball.x - cx) / d
      const ny = (ball.y - cy) / d
      ball.x = cx + nx * rad
      ball.y = cy + ny * rad
      const dot = ball.vx * nx + ball.vy * ny
      ball.vx -= 2 * dot * nx
      ball.vy -= 2 * dot * ny
      // 挡板拍击：沿法线补一个速度
      if (fl.active) {
        const kick = 640
        ball.vx += nx * kick * 0.55
        ball.vy += ny * kick
        beep(300, 0.05, 'square', 0.05)
      } else {
        ball.vx *= 0.96
        ball.vy *= 0.96
      }
    }
  }
  // 卡球自救：位置长时间几乎不动（夹在机关/导轨间）就给一脚随机冲量
  if (Math.abs(ball.vx) < 26 && Math.abs(ball.vy) < 26 && ball.y > 120) {
    stuckAccum += dt
    if (stuckAccum > 1.2) {
      stuckAccum = 0
      const a0 = Math.random() * Math.PI * 2
      ball.vx = Math.cos(a0) * 420
      ball.vy = Math.sin(a0) * 420 - 200
      beep(240, 0.1, 'square', 0.05)
    }
  } else stuckAccum = 0
  // 落球
  if (ball.y > H + 30) {
    ball = null
    balls.value--
    beep(180, 0.25, 'sawtooth', 0.07)
    if (balls.value <= 0) { settle(); return }
    respawnAt = performance.now() + 700
  }
}

// ── 输入 ──
function onKey(e, down) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keyLeft = down; e.preventDefault() }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keyRight = down; e.preventDefault() }
  applyFlip()
}
function applyFlip() {
  if (flippers.length < 2) return
  flippers[0].active = keyLeft || pointerLeft
  flippers[1].active = keyRight || pointerRight
}
let pointerLeft = false
let pointerRight = false
function onDown(e) {
  if (!started.value || overFlag) return
  e.preventDefault()
  const p = pointerPos(e)
  if (p.x < W / 2) pointerLeft = true
  else pointerRight = true
  applyFlip()
}
function onUp(e) {
  e.preventDefault()
  pointerLeft = false
  pointerRight = false
  applyFlip()
}
function pointerPos(e) {
  const r = canvas.getBoundingClientRect()
  const p = e.touches ? e.touches[0] : e
  return { x: (p.clientX - r.left) * (W / r.width), y: (p.clientY - r.top) * (H / r.height) }
}
function setFlipper(side, on) {
  if (side === 0) keyLeft = on
  else keyRight = on
  applyFlip()
}

// ── 结算 ──
function settle() {
  if (overFlag) return
  overFlag = true
  over.value = true
  stopLoop()
  const m = cfg.value
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const gold = m.gold + Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    player.gainGameCoins(gold)
    ui.pushLog(`🍳 厨房弹珠台：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🍳 厨房弹珠台：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.pinball) mg.pinball = { best: 0 }
  mg.pinball.best = Math.max(mg.pinball.best ?? 0, score.value)
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
  // ── 木质外框 ──
  ctx.fillStyle = dark ? '#1b120c' : '#7a5230'
  ctx.fillRect(0, 0, W, H)
  const fx = 18, fy = 18, fw = W - 36, fh = H - 36
  // ── 台面 ──
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh)
  if (dark) { g.addColorStop(0, '#2c2118'); g.addColorStop(0.55, '#221a13'); g.addColorStop(1, '#17110d') } else { g.addColorStop(0, '#f9ecd4'); g.addColorStop(0.55, '#f0dbba'); g.addColorStop(1, '#e2c69c') }
  ctx.save()
  arcTo(ctx, fx, fy, fw, fh, 24)
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  // 厨房瓷砖纹
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.028)' : 'rgba(150,110,70,0.10)'
  ctx.lineWidth = 1
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(fx, fy + i * 18); ctx.lineTo(fx + fw, fy + i * 18); ctx.stroke() }
  for (let i = 0; i < 42; i++) { ctx.beginPath(); ctx.moveTo(fx + i * 18, fy); ctx.lineTo(fx + i * 18, fy + fh); ctx.stroke() }
  // 顶部球道区（半圆）
  const arcC = { x: W / 2, y: 150 }
  const arcR = 150
  ctx.beginPath()
  ctx.arc(arcC.x, arcC.y, arcR, Math.PI, 0)
  ctx.strokeStyle = dark ? 'rgba(210,170,120,0.35)' : 'rgba(150,110,70,0.35)'
  ctx.lineWidth = 3
  ctx.stroke()
  // 球道箭头（3 条）
  for (const a of [-0.55, 0, 0.55]) {
    const ax = arcC.x + Math.sin(a) * (arcR - 16)
    const ay = arcC.y - Math.cos(a) * (arcR - 16)
    ctx.save()
    ctx.translate(ax, ay)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(-7, 6); ctx.lineTo(0, -7); ctx.lineTo(7, 6)
    ctx.closePath()
    ctx.fillStyle = dark ? 'rgba(255,185,142,0.55)' : 'rgba(217,90,56,0.55)'
    ctx.fill()
    ctx.restore()
  }
  // 玻璃反光
  const sheen = ctx.createLinearGradient(fx, fy, fx + fw * 0.7, fy + fh)
  sheen.addColorStop(0, dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.30)')
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(fx, fy, fw, fh)
  ctx.restore()
  // 台面内描边 + 内阴影
  ctx.save()
  arcTo(ctx, fx, fy, fw, fh, 24)
  ctx.strokeStyle = dark ? 'rgba(210,170,120,0.45)' : 'rgba(120,80,40,0.45)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.clip()
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.55)' : 'rgba(90,60,30,0.30)'
  ctx.shadowBlur = 22
  ctx.lineWidth = 12
  ctx.strokeStyle = 'rgba(0,0,0,0.01)'
  arcTo(ctx, fx - 6, fy - 6, fw + 12, fh + 12, 28)
  ctx.stroke()
  ctx.restore()
  // ── 右侧发射道 ──
  const laneX = W - 74
  ctx.beginPath()
  ctx.moveTo(laneX, 210)
  ctx.lineTo(laneX, H - 40)
  ctx.strokeStyle = dark ? 'rgba(210,170,120,0.5)' : 'rgba(150,110,70,0.55)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.stroke()
  // ── 顶部通道横带 ──
  ctx.fillStyle = dark ? 'rgba(210,170,120,0.10)' : 'rgba(150,110,70,0.12)'
  ctx.fillRect(fx + 6, 40, fw - 12, 26)
  ctx.strokeStyle = dark ? 'rgba(210,170,120,0.3)' : 'rgba(150,110,70,0.3)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(fx + 6, 66)
  ctx.lineTo(fx + fw - 6, 66)
  ctx.stroke()
  ctx.setLineDash([])
  // ── 掉落靶（带框）──
  for (const d of drops) {
    if (!d.alive) continue
    arcTo(ctx, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 5)
    ctx.fillStyle = dark ? 'rgba(224,138,90,0.95)' : '#e8a878'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,185,142,0.9)' : 'rgba(150,110,70,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
    arcTo(ctx, d.x - d.w / 2 + 4, d.y - d.h / 2 + 3, d.w - 8, d.h - 8, 3)
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.35)'
    ctx.fill()
  }
  // ── 回球导轨（木条 + 高光）──
  for (const gd of guides) {
    ctx.beginPath()
    ctx.moveTo(gd.x1, gd.y1)
    ctx.lineTo(gd.x2, gd.y2)
    ctx.strokeStyle = dark ? 'rgba(150,110,70,0.95)' : 'rgba(163,118,63,0.9)'
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.strokeStyle = dark ? 'rgba(210,170,120,0.4)' : 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 3
    ctx.stroke()
  }
  // ── 旋转风车 ──
  for (const sp of spinners) {
    ctx.save()
    ctx.translate(sp.x, sp.y)
    ctx.rotate(sp.ang)
    ctx.fillStyle = dark ? 'rgba(210,170,120,0.9)' : 'rgba(163,118,63,0.9)'
    arcTo(ctx, -34, -7, 68, 14, 7)
    ctx.fill()
    ctx.fillStyle = dark ? 'rgba(255,220,180,0.85)' : 'rgba(255,255,255,0.75)'
    arcTo(ctx, -34, -7, 68, 5, 3)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#d95a38'
    ctx.fill()
    ctx.restore()
  }
  // ── 弹射孔 ──
  for (const k of kickers) {
    ctx.beginPath()
    ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(90,60,30,0.45)'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,185,142,0.7)' : 'rgba(217,90,56,0.7)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(k.x, k.y, k.r * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = k.hold > 0 ? 'rgba(255,200,120,0.9)' : 'rgba(0,0,0,0.35)'
    ctx.fill()
  }
  // ── 弹弓（三角 + 橡胶带）──
  for (const b of bumpers) {
    if (!b.sling) continue
    ctx.beginPath()
    ctx.moveTo(b.x - b.r, b.y + b.r * 0.7)
    ctx.lineTo(b.x + b.r, b.y + b.r * 0.7)
    ctx.lineTo(b.x, b.y - b.r)
    ctx.closePath()
    ctx.fillStyle = dark ? 'rgba(190,90,60,0.9)' : '#d9704a'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,185,142,0.75)' : 'rgba(120,60,30,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    // 橡胶带
    ctx.beginPath()
    ctx.moveTo(b.x - b.r * 0.95, b.y + b.r * 0.62)
    ctx.lineTo(b.x + b.r * 0.95, b.y + b.r * 0.62)
    ctx.strokeStyle = dark ? 'rgba(255,230,200,0.85)' : 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.font = '18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.icon, b.x, b.y + b.r * 0.22)
    ctx.textBaseline = 'alphabetic'
  }
  // ── 食材机关（立体 + 光晕）──
  for (const b of bumpers) {
    if (b.sling) continue
    const glow = ctx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, b.r * 1.9)
    glow.addColorStop(0, b.pts >= 50 ? 'rgba(232,176,74,0.35)' : b.pts >= 20 ? 'rgba(224,138,90,0.30)' : 'rgba(201,168,120,0.25)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r * 1.9, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
    const bg = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 2, b.x, b.y, b.r)
    bg.addColorStop(0, dark ? 'rgba(255,240,220,1)' : 'rgba(255,255,255,1)')
    bg.addColorStop(0.55, b.pts >= 50 ? '#f0c060' : b.pts >= 20 ? '#e8955f' : '#d2b184')
    bg.addColorStop(1, b.pts >= 50 ? '#c08a24' : b.pts >= 20 ? '#b96a3c' : '#a3814f')
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,220,180,0.7)' : 'rgba(120,80,40,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = `${Math.round(b.r * 1.05)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.icon, b.x, b.y + 1)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = dark ? 'rgba(255,200,160,0.95)' : 'rgba(200,80,50,0.9)'
    ctx.font = '700 11px system-ui, sans-serif'
    ctx.fillText(String(b.pts), b.x, b.y + b.r + 14)
  }
  // ── 挡板 ──
  for (const fl of flippers) {
    const tx = fl.px + Math.cos(fl.ang) * fl.len
    const ty = fl.py + Math.sin(fl.ang) * fl.len
    ctx.beginPath()
    ctx.moveTo(fl.px, fl.py)
    ctx.lineTo(tx, ty)
    ctx.strokeStyle = dark ? 'rgba(90,40,20,0.6)' : 'rgba(120,60,30,0.35)'
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(fl.px, fl.py)
    ctx.lineTo(tx, ty)
    ctx.strokeStyle = dark ? '#e0704a' : '#d95a38'
    ctx.lineWidth = 13
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(fl.px, fl.py, 6, 0, Math.PI * 2)
    ctx.fillStyle = dark ? '#8a6a4d' : '#a3763f'
    ctx.fill()
  }
  // ── 弹珠 ──
  if (ball) {
    ctx.beginPath()
    ctx.ellipse(ball.x, ball.y + 9, R * 0.9, R * 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(90,60,30,0.20)'
    ctx.fill()
    const bg = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, R)
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(0.55, dark ? '#cfd8de' : '#e4ebef')
    bg.addColorStop(1, dark ? '#6d7681' : '#94a1ad')
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.strokeStyle = 'rgba(70,90,105,0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  // ── 飘字 ──
  for (const f of floats) {
    const a = Math.max(0, 1 - f.life / f.max)
    ctx.globalAlpha = a
    ctx.fillStyle = f.good ? (dark ? '#8cd899' : '#3f8f3f') : (dark ? '#ffb9a8' : '#d95a38')
    ctx.font = '700 16px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(f.text, f.x, f.y)
    ctx.globalAlpha = 1
  }
}

function onKeyDown(e) { onKey(e, true) }
function onKeyUp(e) { onKey(e, false) }

onMounted(() => {
  canvas = canvasEl.value
  ctx = canvas.getContext('2d')
  buildBoard()
  startLoop()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointerup', onUp)
})
onUnmounted(() => {
  stopLoop()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('pointerup', onUp)
})
</script>

<template>
  <div class="pb-page">
    <div class="pb-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="pb-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="pb-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="pb-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="pb-chip">⚪ 弹珠 <b class="mono">{{ balls }}</b></span>
      <span class="pb-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="pb-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="pb-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="pb-stage">
      <canvas
        ref="canvasEl"
        class="pb-canvas"
        :width="W"
        :height="H"
        @pointerdown="onDown"
        @pointerup="onUp"
        @pointerleave="onUp"
        @pointercancel="onUp"
      />
    </div>

    <div class="pb-keys">
      <button v-if="!started" class="pb-start" @click="startGame()">▶ 开始游戏</button>
      <template v-else>
        <button class="pb-flip" @pointerdown="setFlipper(0, true)" @pointerup="setFlipper(0, false)" @pointerleave="setFlipper(0, false)">◀ 左挡板</button>
        <button class="pb-flip" @pointerdown="setFlipper(1, true)" @pointerup="setFlipper(1, false)" @pointerleave="setFlipper(1, false)">右挡板 ▶</button>
        <button class="pb-reset" @click="reset()">🔄 重置本局</button>
      </template>
    </div>

    <div v-if="over" class="pb-mask">
      <div class="pb-result">
        <div class="pb-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="pb-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>剩余弹珠 <b class="mono">{{ balls }}</b></span>
          <span v-if="passed" class="pb-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="pb-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="pb-fire">
        <span v-for="i in 20" :key="i" class="pb-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="pb-info-mask" @click.self="showInfo = false">
      <div class="pb-info-box">
        <div class="pb-info-head"><b>🍳 厨房弹珠台 · 十模式说明</b><button class="pb-info-close" @click="showInfo = false">✕</button></div>
        <div class="pb-info-list">
          <div class="pb-info-row pb-info-rule">通用规则：<b>← → 键</b>（或点画面左/右半边、下方按钮）控制左右挡板拍击，把弹珠打上去撞食材机关得分 · 机关按大小给 10/20/50 分，<b>1.2 秒内连续撞击叠加连击</b>（最高 ×1.5）· 弹珠掉进底部落球口扣 1 颗（共 3 颗），弹珠用完即结束 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="pb-info-row">
            <b class="pb-info-name">{{ m.label }}</b>
            <span class="pb-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pb-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.pb-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.pb-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.pb-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.pb-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.pb-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.pb-stage { width: min(720px, 98%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.pb-canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: pointer; }
.pb-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.pb-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.pb-flip { padding: 10px 22px; height: 46px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; touch-action: none; }
.pb-reset { padding: 10px 24px; height: 46px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.pb-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.pb-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.pb-result-head { font-size: 18px; }
.pb-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.pb-gold { color: var(--good-strong); font-weight: 800; }
.pb-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.pb-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.pb-spark { position: absolute; font-size: 22px; color: var(--gold); animation: pbSpark 1.1s ease-out forwards; }
@keyframes pbSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.pb-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.pb-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.pb-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.pb-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.pb-info-list { display: flex; flex-direction: column; gap: 8px; }
.pb-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.pb-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.pb-info-rule b { color: var(--primary-strong); }
.pb-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.pb-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
