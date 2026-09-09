<script setup>
// 夜市套圈（2026-09-09 新增，第 27 款）：拖拽甩出竹圈，抛物线飞出，套中桌上的食材得分
// 十模式：时长 40~100 秒 × 目标 3~10 个 × 大小/远近 × 移动靶 × 风偏 × 限时
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, count: 3, rScale: 1.25, near: 0.75, move: 0, wind: 0, target: 650, gold: 45, desc: '40 秒 · 目标 650 分 · 3 个大目标，近距离，无风 · +45 币' },
  m2: { label: '模式2', dur: 45, count: 4, rScale: 1.1, near: 0.85, move: 0, wind: 0, target: 720, gold: 55, desc: '45 秒 · 目标 720 分 · 4 个目标，摆得更远一点 · +55 币' },
  m3: { label: '模式3', dur: 50, count: 5, rScale: 1.0, near: 0.9, move: 0, wind: 0, target: 790, gold: 60, desc: '50 秒 · 目标 790 分 · 5 个标准大小目标 · +60 币' },
  m4: { label: '模式4', dur: 55, count: 5, rScale: 0.9, near: 1.0, move: 1, wind: 0, target: 855, gold: 70, desc: '55 秒 · 目标 855 分 · **目标会左右移动** · +70 币' },
  m5: { label: '模式5', dur: 60, count: 6, rScale: 0.85, near: 1.0, move: 1, wind: 1, target: 915, gold: 80, desc: '60 秒 · 目标 915 分 · **有风偏**（顶部箭头），要提前量 · +80 币' },
  m6: { label: '模式6', dur: 65, count: 6, rScale: 0.75, near: 1.05, move: 1, wind: 1, target: 975, gold: 90, desc: '65 秒 · 目标 975 分 · 目标更小 + 风偏 · +90 币' },
  m7: { label: '模式7', dur: 70, count: 7, rScale: 0.7, near: 1.1, move: 2, wind: 1, target: 1035, gold: 100, desc: '70 秒 · 目标 1035 分 · 7 个目标，移动更快 · +100 币' },
  m8: { label: '模式8', dur: 80, count: 8, rScale: 0.62, near: 1.15, move: 2, wind: 1, target: 1165, gold: 120, desc: '80 秒 · 目标 1165 分 · 8 个小目标 + 强风 · +120 币' },
  m9: { label: '模式9', dur: 90, count: 9, rScale: 0.55, near: 1.2, move: 2, wind: 2, target: 1285, gold: 140, desc: '90 秒 · 目标 1285 分 · 小目标 + 最快移动 + 强风 · +140 币' },
  m10: { label: '模式10', dur: 100, count: 10, rScale: 0.5, near: 1.25, move: 2, wind: 2, target: 1405, gold: 160, desc: '100 秒 · 目标 1405 分 · 满桌小目标 + 强风 + 极速移动 · +160 币' },
}
const FOODS = ['🍡', '🥟', '🍢', '🧁', '🍤', '🥠', '🍠', '🧇', '🍥', '🥮']
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const throws = ref(0)
const hits = ref(0)
const combo = ref(0)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.ringtoss?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const W = 720
const H = 520
const LAUNCH = { x: W / 2, y: H - 46 }
const canvasEl = ref(null)
let canvas = null
let ctx = null
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let targets = [] // { x, y, r, pts, icon, vx }
let fly = null // { sx, sy, tx, ty, t, dur, arc }
let drag = null
let aim = null
let floats = []
let wind = 0
let comboAt = 0
let t0 = 0

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
  targets = []
  floats = []
  fly = null
  drag = null
  aim = null
  wind = m.wind ? (Math.random() < 0.5 ? -1 : 1) * (m.wind === 2 ? 46 : 26) : 0
  const baseR = 34 * m.rScale
  const placed = []
  for (let i = 0; i < m.count; i++) {
    for (let t = 0; t < 120; t++) {
      const r = baseR * rand(0.85, 1.15)
      const x = rand(60 + r, W - 60 - r)
      const y = rand(120 + r, 130 + r + 250 * m.near)
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 18)) {
        placed.push({ x, y, r })
        const pts = r < baseR * 0.75 ? 60 : r < baseR * 0.95 ? 40 : 25
        targets.push({ x, y, r, pts, icon: FOODS[i % FOODS.length], vx: m.move ? (Math.random() < 0.5 ? -1 : 1) * (m.move === 2 ? 60 : 34) : 0, phase: Math.random() * 6.28 })
        break
      }
    }
  }
  score.value = 0
  throws.value = 0
  hits.value = 0
  combo.value = 0
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  timeAccum = 0
  draw()
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
  t0 += dt
  if (started.value && !overFlag) {
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) { settle(); return } }
    for (const t of targets) {
      if (!t.vx) continue
      t.x += t.vx * dt
      if (t.x < 60 + t.r) { t.x = 60 + t.r; t.vx = -t.vx }
      if (t.x > W - 60 - t.r) { t.x = W - 60 - t.r; t.vx = -t.vx }
    }
    if (fly) {
      fly.t += dt
      if (fly.t >= fly.dur) { resolveThrow(fly); fly = null }
    }
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

function resolveThrow(f) {
  const m = cfg.value
  throws.value++
  // 落点（含风偏；与绘制中的落点完全一致）
  const windOff = m.wind ? wind : 0
  let lx = f.tx + windOff
  let ly = f.ty
  let best = null
  let bestD = 1e9
  for (const t of targets) {
    const d = Math.hypot(t.x - lx, t.y - ly)
    if (d < t.r * 0.85 && d < bestD) { best = t; bestD = d }
  }
  if (best) {
    hits.value++
    combo.value++
    comboAt = performance.now()
    const mult = 1 + Math.min(0.5, Math.max(0, combo.value - 1) * 0.1)
    const gain = Math.round(best.pts * mult)
    score.value += gain
    floats.push({ x: best.x, y: best.y - best.r - 6, life: 0, max: 1.1, text: `+${gain}`, good: true })
    beep(880, 0.08)
    setTimeout(() => beep(1175, 0.09), 70)
    best.hitAt = t0
  } else {
    combo.value = 0
    floats.push({ x: lx, y: ly, life: 0, max: 0.9, text: '✗', good: false })
    beep(220, 0.09, 'sawtooth', 0.05)
  }
  // 被套中的目标短时间隐藏后重新出现（换个位置）
  if (best) {
    setTimeout(() => {
      if (overFlag) return
      const m2 = cfg.value
      const baseR = 34 * m2.rScale
      for (let k = 0; k < 80; k++) {
        const x = rand(60 + best.r, W - 60 - best.r)
        const y = rand(120 + best.r, 130 + best.r + 250 * m2.near)
        if (targets.every((t) => t === best || Math.hypot(t.x - x, t.y - y) > t.r + best.r + 18)) { best.x = x; best.y = y; break }
      }
      best.r = baseR * rand(0.85, 1.15)
      best.pts = best.r < baseR * 0.75 ? 60 : best.r < baseR * 0.95 ? 40 : 25
    }, 700)
  }
}

// ── 交互 ──
function pointerPos(e) {
  const r = canvas.getBoundingClientRect()
  const p = e.touches ? e.touches[0] : e
  return { x: (p.clientX - r.left) * (W / r.width), y: (p.clientY - r.top) * (H / r.height) }
}
function canThrow() { return started.value && !overFlag && !fly }
function onDown(e) {
  if (!canThrow()) return
  e.preventDefault()
  const p = pointerPos(e)
  drag = { x: p.x, y: p.y }
  updateAim(p)
}
function onMove(e) {
  if (!drag || !canThrow()) return
  e.preventDefault()
  updateAim(pointerPos(e))
}
function updateAim(p) {
  const dx = p.x - LAUNCH.x
  const dy = p.y - LAUNCH.y
  const len = Math.hypot(dx, dy)
  if (len < 10) { aim = null; return }
  const maxD = 400
  const dist = Math.min(maxD, len * 1.55)
  aim = { dir: { x: dx / len, y: dy / len }, dist, tx: LAUNCH.x + (dx / len) * dist, ty: LAUNCH.y + (dy / len) * dist }
}
function onUp(e) {
  if (!drag || !canThrow()) { drag = null; aim = null; return }
  e.preventDefault()
  if (aim) {
    fly = { sx: LAUNCH.x, sy: LAUNCH.y, tx: aim.tx, ty: aim.ty, t: 0, dur: 0.9 }
    beep(360, 0.06, 'square', 0.05)
  }
  drag = null
  aim = null
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
    ui.pushLog(`🎯 夜市套圈：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🎯 夜市套圈：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.ringtoss) mg.ringtoss = { best: 0 }
  mg.ringtoss.best = Math.max(mg.ringtoss.best ?? 0, score.value)
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
  // 夜市地面
  const g = ctx.createLinearGradient(0, 0, 0, H)
  if (dark) { g.addColorStop(0, '#1c1512'); g.addColorStop(1, '#2a1f18') } else { g.addColorStop(0, '#f6e8d2'); g.addColorStop(1, '#e3cba9') }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // 摊位灯笼光晕
  for (let i = 0; i < 6; i++) {
    const x = 60 + i * 120
    const rg = ctx.createRadialGradient(x, 30, 4, x, 30, 120)
    rg.addColorStop(0, dark ? 'rgba(255,180,110,0.16)' : 'rgba(255,190,120,0.30)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(x - 120, 0, 240, 190)
    ctx.font = '20px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏮', x, 26)
  }
  // 桌面透视线
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(150,110,70,0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i < 7; i++) {
    const y = 110 + i * 60
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(W - 30, y)
    ctx.stroke()
  }
  // 风箭头
  if (cfg.value.wind) {
    ctx.fillStyle = dark ? 'rgba(160,210,255,0.8)' : 'rgba(70,130,190,0.85)'
    ctx.font = '700 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const dir = wind < 0 ? '←' : '→'
    ctx.fillText(`风 ${dir} ${Math.abs(wind) > 30 ? '强' : '弱'}`, W / 2, 22)
  }
  // 目标（盘子 + 食材）
  for (const t of targets) {
    // 盘子投影
    ctx.beginPath()
    ctx.ellipse(t.x, t.y + t.r * 0.28, t.r * 0.95, t.r * 0.34, 0, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(90,60,30,0.14)'
    ctx.fill()
    // 盘面
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(255,252,246,0.20)' : 'rgba(255,252,246,0.88)'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(210,170,120,0.65)' : 'rgba(150,110,70,0.55)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    // 计分圈（实线细描边 = 判定范围）
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r * 0.85, 0, Math.PI * 2)
    ctx.strokeStyle = dark ? 'rgba(140,216,153,0.55)' : 'rgba(76,156,76,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.globalAlpha = dark ? 1 : 0.95
    ctx.font = `${Math.round(t.r * 1.05)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(t.icon, t.x, t.y + 1)
    ctx.globalAlpha = 1
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = dark ? 'rgba(255,185,142,0.9)' : 'rgba(217,90,56,0.85)'
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.fillText(String(t.pts), t.x, t.y + t.r + 16)
  }
  // 待发的竹圈
  if (canThrow()) {
    ctx.beginPath()
    ctx.arc(LAUNCH.x, LAUNCH.y, 26, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(217,90,56,0.85)'
    ctx.lineWidth = 6
    ctx.stroke()
  }
  // 瞄准虚线
  if (aim) {
    ctx.strokeStyle = 'rgba(217,90,56,0.7)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(LAUNCH.x, LAUNCH.y)
    ctx.lineTo(aim.tx, aim.ty)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(aim.tx, aim.ty, 26, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(217,90,56,0.45)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // 飞行中的圈（带抛物线与缩放）
  if (fly) {
    const k = Math.min(1, fly.t / fly.dur)
    const wOff = cfg.value.wind ? wind * k : 0
    const x = fly.sx + (fly.tx - fly.sx) * k + wOff
    const y = fly.sy + (fly.ty - fly.sy) * k - Math.sin(k * Math.PI) * 70
    const scale = 1 - 0.14 * k
    // 影子
    ctx.beginPath()
    ctx.ellipse(fly.sx + (fly.tx - fly.sx) * k + wOff, fly.sy + (fly.ty - fly.sy) * k, 24 * scale, 10 * scale, 0, 0, Math.PI * 2)
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(90,60,30,0.18)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 26 * scale, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(217,90,56,0.95)'
    ctx.lineWidth = 6 * scale
    ctx.stroke()
  }
  // 飘字
  for (const f of floats) {
    const a = Math.max(0, 1 - f.life / f.max)
    ctx.globalAlpha = a
    ctx.fillStyle = f.good ? (dark ? '#8cd899' : '#4c9c4c') : (dark ? '#ffb9a8' : '#d95a38')
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
  <div class="rt-page">
    <div class="rt-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="rt-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="rt-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="rt-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="rt-chip">🪀 命中 <b class="mono">{{ hits }}</b>/{{ throws }}</span>
      <span class="rt-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="rt-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="rt-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="rt-stage">
      <canvas
        ref="canvasEl"
        class="rt-canvas"
        :width="W"
        :height="H"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointerleave="onUp"
      />
    </div>

    <div class="rt-keys">
      <button v-if="!started" class="rt-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="rt-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <div v-if="over" class="rt-mask">
      <div class="rt-result">
        <div class="rt-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="rt-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>命中 <b class="mono">{{ hits }}</b>/{{ throws }}</span>
          <span v-if="passed" class="rt-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="rt-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="rt-fire">
        <span v-for="i in 20" :key="i" class="rt-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="rt-info-mask" @click.self="showInfo = false">
      <div class="rt-info-box">
        <div class="rt-info-head"><b>🎯 夜市套圈 · 十模式说明</b><button class="rt-info-close" @click="showInfo = false">✕</button></div>
        <div class="rt-info-list">
          <div class="rt-info-row rt-info-rule">通用规则：<b>按住画面往目标方向拖拽</b>，拖得越远竹圈飞得越远，松手甩出 · 竹圈套中食材得分，<b>目标越小、越远分越高</b>（60/40/25 分）· 连续套中叠加连击（最高 ×1.5）· 套中的目标会换个位置重新出现 · 有风时顶部显示风向，落点会被吹偏 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="rt-info-row">
            <b class="rt-info-name">{{ m.label }}</b>
            <span class="rt-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rt-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.rt-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.rt-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.rt-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.rt-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.rt-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.rt-stage { width: min(720px, 98%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.rt-canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; }
.rt-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.rt-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.rt-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.rt-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.rt-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.rt-result-head { font-size: 18px; }
.rt-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.rt-gold { color: var(--good-strong); font-weight: 800; }
.rt-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.rt-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.rt-spark { position: absolute; font-size: 22px; color: var(--gold); animation: rtSpark 1.1s ease-out forwards; }
@keyframes rtSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.rt-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.rt-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.rt-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.rt-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.rt-info-list { display: flex; flex-direction: column; gap: 8px; }
.rt-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.rt-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.rt-info-rule b { color: var(--primary-strong); }
.rt-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.rt-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
