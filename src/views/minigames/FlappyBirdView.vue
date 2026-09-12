<script setup>
// 笨鸟先飞（2026-09-08 新增）：Canvas 重力扑翼穿管 · 十模式（速度×缝宽×重力）× 每管结算
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const W = 480
const H = 360
const BIRD_X = 240 // 鸟保持在屏幕中间
const BIRD_HALF = 20 // 鸟图半宽（碰撞区）

// 可选小鸟（2026-09-08 用户素材 8 只）：开局可自由选择，持久化到存档
const BIRDS = {
  '01': { label: '黄雀', file: 'bird-01.png' },
  '02': { label: '红雀', file: 'bird-02.png' },
  '03': { label: '绿飞侠', file: 'bird-03.png' },
  '04': { label: '蓝雀', file: 'bird-04.png' },
  '05': { label: '紫雀', file: 'bird-05.png' },
  '06': { label: '粉雀', file: 'bird-06.png' },
  '07': { label: '棒球帽', file: 'bird-07.png' },
  '08': { label: '黑鸦', file: 'bird-08.png' },
}
const birdKey = ref(player.minigames?.flappy?.bird ?? '02')
function selectBird(k) {
  birdKey.value = k
  const mf = player.minigames
  if (!mf.flappy) mf.flappy = { best: 0 }
  mf.flappy.bird = k
}
const birdSrc = computed(() => '/images/birds/' + BIRDS[birdKey.value].file)

const mode = ref('s2')
const METAS = {
  s1: { label: '悠闲', speed: 1.6, gap: 170, grav: 0.5, jump: -6.5, rate: 1.2, desc: '慢速 · 宽缝 170 · 每管 1.2 币 —— 热身' },
  s2: { label: '标准', speed: 1.9, gap: 150, grav: 0.6, jump: -6.8, rate: 2.0, desc: '标准速 · 缝 150 · 每管 2 币 —— 经典体验' },
  s3: { label: '快速', speed: 2.2, gap: 132, grav: 0.68, jump: -7.0, rate: 3.0, desc: '快速 · 缝 132 · 每管 3 币' },
  s4: { label: '极速', speed: 2.5, gap: 116, grav: 0.75, jump: -7.2, rate: 4.5, desc: '极速 · 缝 116 · 每管 4.5 币 —— 手速拉满' },
  t1: { label: '窄缝·标准', speed: 1.8, gap: 118, grav: 0.62, jump: -6.9, rate: 3.5, desc: '标准速 · 窄缝 118 · 每管 3.5 币 —— 精准穿缝' },
  t2: { label: '窄缝·快', speed: 2.1, gap: 102, grav: 0.7, jump: -7.1, rate: 5.0, desc: '快速 · 窄缝 102 · 每管 5 币' },
  g1: { label: '重鸟·标准', speed: 1.7, gap: 148, grav: 0.82, jump: -7.6, rate: 2.6, desc: '重力 +37% · 缝 148 · 每管 2.6 币' },
  g2: { label: '重鸟·快', speed: 2.0, gap: 126, grav: 0.9, jump: -7.9, rate: 4.0, desc: '重力重 + 快速 · 缝 126 · 每管 4 币' },
  m1: { label: '密管·标准', speed: 2.05, gap: 140, grav: 0.65, jump: -7.0, rate: 3.2, desc: '管道间距近 20% · 每管 3.2 币 —— 连环换气' },
  m2: { label: '地狱', speed: 2.5, gap: 92, grav: 0.82, jump: -7.4, rate: 6.5, desc: '极速 + 窄缝 92 + 重重力 · 每管 6.5 币 —— 终极挑战' },
}
const showInfo = ref(false)

const canvas = ref(null)
const birdEl = ref(null)
const BG = new Image()
BG.src = '/images/fb-bg.png'
let bgX = 0
const PIPE_TOP = new Image()
PIPE_TOP.src = '/images/fb-pipe-top.png' // 青锈管（2026-09-08 用户素材）：上方管道
const PIPE_BOT = new Image()
PIPE_BOT.src = '/images/fb-pipe-bottom.png' // 铜管：下方管道
// 裁剪图片四边透明留白（不透明内容边界），保证拉伸后管体上贴顶/下贴底
function cropBounds(img) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const cx = c.getContext('2d')
  cx.drawImage(img, 0, 0)
  const d = cx.getImageData(0, 0, c.width, c.height).data
  let top = 0
  outerT: for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { top = y; break outerT }
  }
  let bottom = c.height
  outerB: for (let y = c.height - 1; y >= 0; y--) {
    for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { bottom = y + 1; break outerB }
  }
  return { top, bottom }
}
const TOP_CROP = { top: 0, bottom: 1 }
const BOT_CROP = { top: 0, bottom: 1 }
PIPE_TOP.onload = () => { Object.assign(TOP_CROP, cropBounds(PIPE_TOP)); draw() }
PIPE_BOT.onload = () => { Object.assign(BOT_CROP, cropBounds(PIPE_BOT)); draw() }
BG.onload = () => draw() // 图片加载完成后重绘

let birdY = H / 2
let birdVy = 0
let pipes = []
const passed = ref(0)
let nextPipeX = W + 40
const over = ref(false)
const running = ref(false)
let rafId = null
let lastTs = 0
const best = computed(() => player.minigames?.flappy?.best ?? 0)

function reset() {
  stopLoop()
  birdY = H / 2
  birdVy = 0
  pipes = []
  passed.value = 0
  nextPipeX = W + 40
  over.value = false
  running.value = false
  draw()
}
function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
}
function flap() {
  if (over.value) return
  if (!running.value) { start(); return }
  const m = METAS[mode.value]
  birdVy = m.jump
}
function start() {
  if (over.value) { reset() }
  if (running.value) return
  running.value = true
  lastTs = 0
  rafId = requestAnimationFrame(loop)
}
function die() {
  player.recordMinigame('flappy', passed.value, { lower: false, unit: '管道' })
  over.value = true
  running.value = false
  stopLoop()
  const coins = Math.round(passed.value * METAS[mode.value].rate)
  const mf = player.minigames
  if (!mf.flappy) mf.flappy = { best: 0 }
  mf.flappy.best = Math.max(mf.flappy.best ?? 0, passed.value)
  if (coins > 0) {
    player.gainGameCoins(coins)
    ui.pushLog(`🐦 笨鸟先飞：穿 ${passed.value} 根管道 → +${coins} 游戏币`, 'gain')
  }
}
function loop(ts) {
  if (!lastTs) lastTs = ts
  const dt = (ts - lastTs) / 16.67 // 归一化到 60fps
  lastTs = ts
  const m = METAS[mode.value]
  // 管道移动 + 生成
  const oldRight = pipes.length ? Math.max(...pipes.map((p) => p.x)) : -1
  if (oldRight < W - 240) {
    const gapY = 50 + Math.random() * (H - 100 - m.gap)
    pipes.push({ x: W + 10, gapY, gap: m.gap, w: 130 })
  }
  for (const p of pipes) p.x -= m.speed * dt
  pipes = pipes.filter((p) => p.x > -p.w - 10)
  bgX -= m.speed * 0.35 * dt // 背景视差（慢于管道）
  // 鸟物理
  birdVy += m.grav * dt
  birdY += birdVy * dt
  // 管道得分（过鸟右侧）
  for (const p of pipes) {
    if (!p.scored && p.x + p.w < BIRD_X - BIRD_HALF) { p.scored = true; passed.value++ }
  }
  // 碰撞检测
  const r = BIRD_HALF - 6 // 碰撞半径略小于图半宽
  for (const p of pipes) {
    const inX = BIRD_X + r > p.x && BIRD_X - r < p.x + p.w
    if (!inX) continue
    const inGap = birdY + r > p.gapY && birdY - r < p.gapY + p.gap
    if (!inGap) { die(); break }
  }
  if (birdY + r > H || birdY - r < 0) die()
  draw()
  if (running.value && !over.value) rafId = requestAnimationFrame(loop)
}
function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  // 背景：雪山图（cover 拉伸 + 慢速视差滚动；未加载时深棕兜底）
  if (BG.complete && BG.naturalWidth) {
    const tw = (BG.naturalWidth * H) / BG.naturalHeight // 按高度缩放后的图宽
    const startX = -(((bgX % tw) + tw) % tw)
    for (let ox = startX; ox < W; ox += tw) ctx.drawImage(BG, ox, 0, tw, H)
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      ctx.fillStyle = 'rgba(22, 16, 12, 0.45)' // 深色模式压暗背景
      ctx.fillRect(0, 0, W, H)
    }
  } else {
    ctx.fillStyle = '#2b2117'
    ctx.fillRect(0, 0, W, H)
  }
  // 管道（贴片裁剪透明边后拉伸：上管贴顶、下管贴底）
  for (const p of pipes) {
    if (PIPE_TOP.complete && PIPE_TOP.naturalWidth) {
      ctx.drawImage(PIPE_TOP, 0, TOP_CROP.top, PIPE_TOP.naturalWidth, TOP_CROP.bottom - TOP_CROP.top, p.x, 0, p.w, p.gapY)
    } else {
      ctx.fillStyle = '#4f8f3c'
      ctx.fillRect(p.x, 0, p.w, p.gapY)
    }
    const botY = p.gapY + p.gap
    if (PIPE_BOT.complete && PIPE_BOT.naturalWidth) {
      ctx.drawImage(PIPE_BOT, 0, BOT_CROP.top, PIPE_BOT.naturalWidth, BOT_CROP.bottom - BOT_CROP.top, p.x, botY, p.w, H - botY)
    } else {
      ctx.fillStyle = '#4f8f3c'
      ctx.fillRect(p.x, botY, p.w, H - botY)
    }
  }
  // 鸟（GIF 叠加层：DOM 图片每帧同步位置与倾斜；按 canvas 显示比例换算，保持居中）
  const tilt = Math.max(-0.5, Math.min(0.6, birdVy * 0.06))
  if (birdEl.value) {
    const scale = cv.clientWidth / W // canvas 显示宽 / 逻辑宽
    birdEl.value.style.width = BIRD_HALF * 2 * scale + 'px'
    birdEl.value.style.height = BIRD_HALF * 2 * scale + 'px'
    birdEl.value.style.left = (BIRD_X - BIRD_HALF) * scale + 'px'
    birdEl.value.style.top = (birdY - BIRD_HALF) * scale + 'px'
    birdEl.value.style.transform = 'rotate(' + tilt + 'rad)'
  }
}
function onKey(e) {
  if (e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault()
    flap()
  }
}
window.addEventListener('keydown', onKey)
onMounted(() => draw())
onUnmounted(() => { window.removeEventListener('keydown', onKey); stopLoop() })
reset()
</script>

<template>
  <div class="fb-page">
    <div class="fb-topbar">
      <button v-for="(m, key, idx) in METAS" :key="key" class="fb-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="fb-chip" style="margin-left: auto">🎯 穿管 <b class="mono">{{ passed }}</b></span>
      <span class="fb-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <span class="fb-chip">💰 每管 <b class="mono">{{ METAS[mode].rate }}</b> 币</span>
      <button class="fb-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <!-- 选鸟：开局自由选择（8 只，持久化） -->
    <div class="fb-birds">
      <button v-for="(b, k) in BIRDS" :key="k" class="fb-bird-btn" :class="{ on: birdKey === k }" :title="b.label" @click="selectBird(k)">
        <img :src="'/images/birds/' + b.file" alt="" />
      </button>
    </div>

    <div class="fb-stage" @click="flap()">
      <canvas ref="canvas" class="fb-canvas" :width="480" :height="360"></canvas>
      <img ref="birdEl" class="fb-bird" :src="birdSrc" alt="" />
    </div>

    <div class="fb-keys">
      <button class="fb-reset" @click="reset()">🔄 重置本局</button>
      <button class="fb-start" @click="flap()">{{ over ? '🏁 再来一局' : running ? '🦅 扑翼（空格/点击画面）' : '▶ 开始游戏' }}</button>
    </div>
        <div v-if="over" class="fb-mask">
      <div class="fb-result">
        <div class="fb-result-head"><b>🐦 本局结束</b></div>
        <div class="fb-result-score">穿过 <b class="mono">{{ passed }}</b> 根管道</div>
        <button class="fb-again" @click="reset(); start()">🔄 再来一局</button>
      </div>
    </div>

    <div v-if="showInfo" class="fb-info-mask" @click.self="showInfo = false">
      <div class="fb-info-box">
        <div class="fb-info-head"><b>🐦 笨鸟先飞 · 十种模式说明</b><button class="fb-info-close" @click="showInfo = false">✕</button></div>
        <div class="fb-info-list">
          <div class="fb-info-row fb-info-rule">通用规则：点击画面 / 空格 / ↑ 扑翼 · 穿过管道 +1 管 · 撞管/落地即结算（管数 × 模式单价）· 每局结算游戏币</div>
          <div v-for="(m, key) in METAS" :key="key" class="fb-info-row">
            <b class="fb-info-name">{{ m.label }}</b>
            <span class="fb-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.fb-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.fb-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.fb-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.fb-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.fb-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.fb-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.fb-stage { position: relative; width: min(540px, 94%); cursor: pointer; }
.fb-birds { display: flex; gap: 8px; flex-wrap: wrap; margin-top: -6px; }
.fb-bird-btn { width: 52px; height: 40px; border-radius: 10px; cursor: pointer; background: rgba(255, 252, 246, 0.8); border: 1px dashed rgba(150, 110, 70, 0.4); padding: 2px; display: inline-flex; align-items: center; justify-content: center; }
.fb-bird-btn.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); }
.fb-bird-btn img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.fb-canvas { width: 100%; border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); display: block; }
.fb-bird { position: absolute; width: 40px; height: 40px; pointer-events: none; will-change: left, top, transform; image-rendering: pixelated; }
.fb-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.fb-reset { padding: 10px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.fb-start {
  padding: 12px 34px;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #e8703f, #c9542e);
  border: none;
  font-size: 15px;
  box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35);
}
.fb-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.fb-info-box {
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
.fb-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.fb-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.fb-info-list { display: flex; flex-direction: column; gap: 8px; }
.fb-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.fb-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.fb-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.fb-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── fb 结算弹窗（2026-09-09 统一）── */
.fb-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.fb-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.fb-result-head { font-size: 18px; }
.fb-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.fb-gold { color: var(--good-strong); font-weight: 800; }
.fb-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.fb-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.fb-spark { position: absolute; font-size: 22px; color: var(--gold); animation: fbSpark 1.1s ease-out forwards; }
@keyframes fbSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
</style>
