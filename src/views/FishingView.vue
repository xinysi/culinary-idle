<script setup>
// 垂钓渔翁（2026-09-09 新增）：点击抛竿 → 鱼钩下落/回收，碰到鱼即捕获（无需 QTE）
// 鱼类 4 档稀有度（普通/稀有/史诗/传说）× 分值/速度/出现权重 · 限时结算 · 十模式
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 画布与水域 ──
const W = 420
const H = 520
const SHORE_Y = 62 // 岸线
const WATER_TOP = SHORE_Y + 6
const WATER_BOTTOM = H - 8
const HOOK_R = 8
const FISH_R = 17
const MAX_FISH = 12

// ── 鱼类体系（图鉴真实鱼类图片；分值/速度/权重按稀有度）──
const RARITY = { 0: { name: '普通', color: '#8aa06a' }, 1: { name: '稀有', color: '#4f8fd9' }, 2: { name: '史诗', color: '#9a7ae0' }, 3: { name: '传说', color: '#e0a13a' } }
const FISH = [
  { id: 'crucian', name: '鲫鱼', r: 0, score: 10, speed: 42, weight: 30 },
  { id: 'fishing_ext_01', name: '沙丁鱼', r: 0, score: 15, speed: 58, weight: 28 },
  { id: 'fishing_ext2_03', name: '银鱼', r: 0, score: 18, speed: 70, weight: 26 },
  { id: 'carp', name: '鲤鱼', r: 1, score: 30, speed: 82, weight: 12 },
  { id: 'fishing_ext2_11', name: '草鱼', r: 1, score: 45, speed: 100, weight: 10 },
  { id: 'tuna', name: '金枪鱼', r: 1, score: 55, speed: 112, weight: 8 },
  { id: 'eel', name: '鳗鱼', r: 2, score: 80, speed: 140, weight: 4 },
  { id: 'abalone', name: '鲍鱼', r: 2, score: 90, speed: 152, weight: 3 },
  { id: 'bluefin', name: '蓝鳍金枪鱼', r: 2, score: 100, speed: 162, weight: 2.5 },
  { id: 'fishing_ext2_28', name: '花蟹', r: 3, score: 120, speed: 180, weight: 1 },
  { id: 'fishing_ext_28', name: '黑鱼', r: 3, score: 130, speed: 190, weight: 0.8 },
  { id: 'goldenDragonFish', name: '金龙鱼', r: 3, score: 150, speed: 200, weight: 0.6 },
]

// ── 十模式（限时 × 目标分 × 稀有度倾向）──
const MODES = {
  m1: { label: '模式1', dur: 30, target: 100, gold: 35, rm: 1.0, hook: 420, desc: '30 秒 · 目标 100 分 · +35 币' },
  m2: { label: '模式2', dur: 40, target: 200, gold: 45, rm: 1.1, hook: 440, desc: '40 秒 · 目标 200 分 · +45 币' },
  m3: { label: '模式3', dur: 50, target: 300, gold: 60, rm: 1.2, hook: 460, desc: '50 秒 · 目标 300 分 · +60 币' },
  m4: { label: '模式4', dur: 60, target: 400, gold: 75, rm: 1.35, hook: 480, desc: '60 秒 · 目标 400 分 · +75 币' },
  m5: { label: '模式5', dur: 60, target: 550, gold: 85, rm: 1.5, hook: 500, desc: '60 秒 · 目标 550 分（稀有鱼更常见）· +85 币' },
  m6: { label: '模式6', dur: 75, target: 700, gold: 105, rm: 1.65, hook: 520, desc: '75 秒 · 目标 700 分 · +105 币' },
  m7: { label: '模式7', dur: 75, target: 900, gold: 115, rm: 1.8, hook: 540, desc: '75 秒 · 目标 900 分（史诗鱼增多）· +115 币' },
  m8: { label: '模式8', dur: 90, target: 1200, gold: 140, rm: 2.0, hook: 560, desc: '90 秒 · 目标 1200 分 · +140 币' },
  m9: { label: '模式9', dur: 90, target: 1500, gold: 150, rm: 2.2, hook: 580, desc: '90 秒 · 目标 1500 分（传说鱼概率提升）· +150 币' },
  m10: { label: '模式10', dur: 120, target: 2000, gold: 200, rm: 2.5, hook: 600, desc: '120 秒 · 目标 2000 分（高稀有度扎堆）· +200 币' },
}
const showInfo = ref(false)

// ── 状态 ──
const canvas = ref(null)
const mode = ref('m1')
const score = ref(0)
const timeLeft = ref(30)
const over = ref(false)
const passed = ref(false)
const caughtList = ref([]) // { id, name, r, score, n }
const best = computed(() => player.minigames?.fishing?.best ?? 0)
const baitN = ref(1)
const speedN = ref(1)
const baitUntil = ref(0)
const hookBoost = ref(1)
let fish = []
let hook = { state: 'idle', x: W / 2, y: SHORE_Y }
let splashes = []
let loopId = null
let lastTs = 0
let spawnAccum = 0
let timeAccum = 0
let running = false
let lastLegendary = 0
let nextId = 1
const rodX = W / 2

const IMGS = FISH.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})
const targetText = computed(() => `${score.value}/${MODES[mode.value].target}`)

// ── 音效 ──
let soundCtx = null
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
    g.gain.setValueAtTime(0.09, soundCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + dur)
    o.start()
    o.stop(soundCtx.currentTime + dur)
  } catch { /* 无音频环境忽略 */ }
}

// ── 生成鱼（按稀有度权重；传说鱼 4 秒内不连续刷）──
function pickFish() {
  const m = MODES[mode.value]
  const bait = performance.now() < baitUntil.value
  const pool = FISH.map((f) => {
    let w = f.weight * Math.pow(m.rm, f.r)
    if (bait && f.r > 0) w *= 3
    return { f, w }
  })
  const now = performance.now()
  if (now - lastLegendary < 4000) for (const p of pool) if (p.f.r === 3) p.w = 0
  const total = pool.reduce((s, p) => s + p.w, 0)
  let r = Math.random() * total
  for (const p of pool) { r -= p.w; if (r <= 0) { if (p.f.r === 3) lastLegendary = now; return p.f } }
  return FISH[0]
}
function spawnFish() {
  if (fish.length >= MAX_FISH) return
  const f = pickFish()
  const dir = Math.random() < 0.5 ? 1 : -1
  const x = dir > 0 ? -FISH_R : W + FISH_R
  const y = WATER_TOP + 20 + Math.random() * (WATER_BOTTOM - WATER_TOP - 44)
  fish.push({ key: nextId++, ...f, x, y, dir, caught: false })
}

// ── 抛竿 / 收竿 ──
function cast(px) {
  if (!running || over.value) return
  if (hook.state !== 'idle') return
  hook.x = Math.max(HOOK_R + 4, Math.min(W - HOOK_R - 4, px))
  hook.y = WATER_TOP + 2
  hook.state = 'down'
  hook.caught = null
  beep(660, 0.06)
}
function onPointerDown(e) {
  const cv = canvas.value
  if (!cv) return
  const rect = cv.getBoundingClientRect()
  cast(((e.clientX - rect.left) / rect.width) * W)
}

// ── 主循环 ──
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  const m = MODES[mode.value]
  if (running && !over.value) {
    // 倒计时
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) settle() }
    // 鱼钩
    const hs = m.hook * hookBoost.value
    if (hook.state === 'down') {
      hook.y += hs * dt
      if (hook.y >= WATER_BOTTOM - HOOK_R) { hook.y = WATER_BOTTOM - HOOK_R; hook.state = 'up' }
    } else if (hook.state === 'up') {
      hook.y -= hs * 1.9 * dt
      if (hook.y <= WATER_TOP + 2) {
        hook.y = WATER_TOP + 2
        hook.state = 'idle'
        if (hook.caught) {
          fish = fish.filter((f) => f !== hook.caught)
          hook.caught = null
        }
      }
    }
    // 鱼游动（水平来回，出界反弹）
    for (const f of fish) {
      if (f.caught) { f.x = hook.x; f.y = hook.y + 10; continue }
      f.x += f.dir * f.speed * dt
      if (f.x < FISH_R) { f.x = FISH_R; f.dir = 1 }
      if (f.x > W - FISH_R) { f.x = W - FISH_R; f.dir = -1 }
    }
    // 生成
    spawnAccum += dt
    if (spawnAccum >= 0.75) { spawnAccum = 0; spawnFish() }
    // 碰撞捕获（鱼钩下坠/回收中都可捕获；一次只钩一条）
    if (hook.state !== 'idle' && !hook.caught) {
      for (const f of fish) {
        if (f.caught) continue
        const dx = f.x - hook.x
        const dy = f.y - hook.y
        if (dx * dx + dy * dy <= (HOOK_R + FISH_R) * (HOOK_R + FISH_R)) {
          f.caught = true
          hook.caught = f
          hook.state = 'up'
          score.value += f.score
          recordCatch(f)
          splashes.push({ x: f.x, y: f.y, life: 0, max: 0.5 })
          beep(880, 0.1)
          setTimeout(() => beep(1180, 0.1), 80)
          break
        }
      }
    }
    // 水花
    for (const s of splashes) s.life += dt
    splashes = splashes.filter((s) => s.life < s.max)
  }
  draw()
}
function recordCatch(f) {
  const hit = caughtList.value.find((c) => c.id === f.id)
  if (hit) hit.n++
  else caughtList.value = [...caughtList.value, { id: f.id, name: f.name, r: f.r, score: f.score, n: 1 }]
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

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  const m = MODES[mode.value]
  fish = []
  hook = { state: 'idle', x: rodX, y: WATER_TOP + 2, caught: null }
  splashes = []
  score.value = 0
  timeLeft.value = m.dur
  over.value = false
  passed.value = false
  caughtList.value = []
  baitN.value = 1
  speedN.value = 1
  baitUntil.value = 0
  hookBoost.value = 1
  spawnAccum = 0
  timeAccum = 0
  lastLegendary = 0
  running = true
  // 开局先铺几条鱼
  for (let i = 0; i < 5; i++) spawnFish()
  startLoop()
}
function settle() {
  if (over.value) return
  over.value = true
  running = false
  stopLoop()
  const m = MODES[mode.value]
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    // 奖励 = 模式基础奖励 + 超目标最多 +50%
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
// ── 道具 ──
function useBait() {
  if (baitN.value <= 0 || over.value) return
  baitN.value--
  baitUntil.value = performance.now() + 15000
  beep(520, 0.1)
  ui.pushLog('🎣 撒下鱼饵：15 秒内稀有鱼出现率提升', 'info')
}
function useSpeed() {
  if (speedN.value <= 0 || over.value) return
  speedN.value--
  hookBoost.value = 1.6
  beep(700, 0.1)
  ui.pushLog('🎣 加速鱼钩：本局收放速度 +60%', 'info')
}

// ── 绘制 ──
function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  // 天空/岸
  ctx.fillStyle = dark ? '#2b2117' : '#dfeaf2'
  ctx.fillRect(0, 0, W, SHORE_Y)
  // 岸
  ctx.fillStyle = dark ? '#4a3a2c' : '#c9b089'
  ctx.fillRect(0, SHORE_Y - 10, W, 14)
  ctx.fillStyle = dark ? '#3a2d22' : '#a8895f'
  ctx.fillRect(0, SHORE_Y + 4, W, 4)
  // 水面
  const g = ctx.createLinearGradient(0, WATER_TOP, 0, H)
  if (dark) { g.addColorStop(0, '#1b2a33'); g.addColorStop(1, '#12202a') } else { g.addColorStop(0, '#7fc4e8'); g.addColorStop(1, '#3f8fbf') }
  ctx.fillStyle = g
  ctx.fillRect(0, WATER_TOP, W, H - WATER_TOP)
  // 水波
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const y = WATER_TOP + 30 + i * 72
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= W; x += 28) ctx.lineTo(x, y + Math.sin((x / 28 + i) * 0.9) * 3)
    ctx.stroke()
  }
  // 鱼竿
  ctx.strokeStyle = dark ? '#8a6a4a' : '#7a4a26'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(rodX - 70, SHORE_Y - 44)
  ctx.lineTo(rodX, SHORE_Y - 12)
  ctx.stroke()
  // 鱼线
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(90,70,50,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(rodX, SHORE_Y - 12)
  ctx.lineTo(hook.x, hook.y)
  ctx.stroke()
  // 鱼
  for (const f of fish) drawFish(ctx, f, dark)
  // 鱼钩
  ctx.fillStyle = '#d9c9b4'
  ctx.beginPath()
  ctx.arc(hook.x, hook.y, HOOK_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7a4a26'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(hook.x, hook.y + 3, HOOK_R - 1, 0.2, Math.PI - 0.2)
  ctx.stroke()
  // 水花
  for (const s of splashes) {
    const t = s.life / s.max
    ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.x, s.y, 6 + t * 26, 0, Math.PI * 2)
    ctx.stroke()
  }
}
function drawFish(ctx, f, dark) {
  const im = IMGS[FISH.findIndex((x) => x.id === f.id)]
  ctx.save()
  ctx.translate(f.x, f.y)
  if (f.dir < 0) ctx.scale(-1, 1)
  ctx.beginPath()
  ctx.ellipse(0, 0, FISH_R + 5, FISH_R, 0, 0, Math.PI * 2)
  ctx.clip()
  if (im && im.complete && im.naturalWidth) {
    ctx.drawImage(im, -(FISH_R + 5), -FISH_R, (FISH_R + 5) * 2, FISH_R * 2)
  } else {
    ctx.fillStyle = RARITY[f.r].color
    ctx.fillRect(-(FISH_R + 5), -FISH_R, (FISH_R + 5) * 2, FISH_R * 2)
  }
  ctx.restore()
  // 稀有度描边（史诗/传说加光晕）
  ctx.strokeStyle = RARITY[f.r].color
  ctx.lineWidth = f.r >= 2 ? 2.4 : 1.4
  ctx.beginPath()
  ctx.ellipse(f.x, f.y, FISH_R + 5, FISH_R, 0, 0, Math.PI * 2)
  ctx.stroke()
  if (f.r === 3) {
    ctx.strokeStyle = 'rgba(224, 161, 58, 0.45)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.ellipse(f.x, f.y, FISH_R + 8, FISH_R + 3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

onMounted(() => { reset() })
onUnmounted(() => stopLoop())
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

    <canvas ref="canvas" class="fh-canvas" :width="W" :height="H" @pointerdown="onPointerDown"></canvas>

    <div class="fh-keys">
      <button class="fh-reset" @click="reset()">🔄 重置本局</button>
      <button class="fh-prop" :disabled="baitN <= 0 || over" @click="useBait()">🪱 鱼饵 ×{{ baitN }}</button>
      <button class="fh-prop" :disabled="speedN <= 0 || over" @click="useSpeed()">⚡ 加速钩 ×{{ speedN }}</button>
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
          <span v-if="passed" class="fh-gold">+{{ MODES[mode].gold + Math.round(MODES[mode].gold * 0.5 * Math.min(1, (score - MODES[mode].target) / MODES[mode].target)) }} 游戏币</span>
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
            通用规则：点击水面抛竿，鱼钩自动下落、触底回收 · **钩到鱼即捕获**（无需 QTE，一次一条）·
            鱼类 4 档稀有度（越稀有越快、分越高、越难钓）· 限时结束按得分结算，达标发奖 ·
            道具：🪱 鱼饵（15 秒稀有鱼出现率 ×3）×1 · ⚡ 加速钩（收放速度 +60%）×1
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
.fh-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.fh-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.fh-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.fh-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.fh-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.fh-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.fh-canvas { width: min(420px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); cursor: crosshair; }
.fh-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.fh-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.fh-prop { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.fh-prop:disabled { opacity: 0.45; cursor: not-allowed; }

/* 结算弹窗 */
.fh-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.fh-result { width: min(560px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.fh-result-head { font-size: 18px; }
.fh-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; }
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
.fh-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.6; }
.fh-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.fh-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
