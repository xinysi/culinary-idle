<script setup>
// 水果合成（2026-09-09 新增）：12 级合成链 + 圆体物理（重力/回弹/堆叠）· 十模式（合成目标/分数目标/无尽）
// 硬性规则：逐级合成无跳级 · 西瓜封顶不再合成 · 连锁合成 · 随机生成仅 1~9 级 · 溢出红线判负
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

const W = 420
const H = 560
const GRAV = 2200
const REST = 0.16
const FRICTION = 0.06

// 12 级合成链（青枣以「青梅」替代——图鉴有图且同为青色小果）
const FRUITS = [
  { name: '葡萄', id: 'grape', r: 15, color: '#8e5bb5' },
  { name: '樱桃', id: 'foraging_ext_06', r: 18, color: '#c93a4a' },
  { name: '柠檬', id: 'foraging_ext_04', r: 22, color: '#e8d24a' },
  { name: '青梅', id: 'foraging_ext2_03', r: 26, color: '#8fbf4a' },
  { name: '草莓', id: 'strawberry', r: 31, color: '#e0403f' },
  { name: '橙子', id: 'foraging_ext_03', r: 37, color: '#ef8a2a' },
  { name: '苹果', id: 'apple', r: 44, color: '#d63b2f' },
  { name: '梨', id: 'foraging_ext_02', r: 52, color: '#c8d24a' },
  { name: '桃子', id: 'foraging_ext_01', r: 62, color: '#f2a0a8' },
  { name: '菠萝', id: 'pineapple', r: 73, color: '#e0b83a' },
  { name: '椰子', id: 'foraging_ext2_11', r: 86, color: '#8a6a4a' },
  { name: '西瓜', id: 'watermelon', r: 100, color: '#3f9e4a' },
]

const mode = ref('p10')
const MODES = {
  p10: { label: '合菠萝', target: { level: 10 }, gold: 100, desc: '合成菠萝（L10）通关 · +100 币' },
  p11: { label: '合椰子', target: { level: 11 }, gold: 160, desc: '合成椰子（L11）通关 · +160 币' },
  p12: { label: '合西瓜', target: { level: 12 }, gold: 260, desc: '合成西瓜（L12 封顶）通关 · +260 币' },
  s2k: { label: '2000分', target: { score: 2000 }, gold: 120, desc: '达到 2000 分 · +120 币' },
  s4k: { label: '4000分', target: { score: 4000 }, gold: 200, desc: '达到 4000 分 · +200 币' },
  s8k: { label: '8000分', target: { score: 8000 }, gold: 320, desc: '达到 8000 分 · +320 币' },
  s15k: { label: '15000分', target: { score: 15000 }, gold: 450, desc: '达到 15000 分 · +450 币' },
  endless: { label: '无尽冲分', target: null, gold: 0, desc: '无尽模式 · 溢出结束按分数档发奖：500/2000/5000/10000 分 → 60/140/260/450 币' },
  dbl: { label: '双西瓜', target: { level: 12, count: 2 }, gold: 550, desc: '合成 2 个西瓜 · +550 币' },
  hard: { label: '极限25000', target: { score: 25000 }, gold: 600, desc: '达到 25000 分 · +600 币 —— 极限挑战' },
}
const showInfo = ref(false)

const canvas = ref(null)
let fruits = []
let aimX = W / 2
let nextLevel = 1
let score = 0
let watermelonCount = 0
let combo = 0
let best = 0
let over = false
let won = false
let lineY = 110
let rafId = null
let lastTs = 0
let flashUntil = 0
let aiming = false
let nextId = 1
const scoreRef = ref(0)
const nextLevelRef = ref(1)
const comboRef = ref(0)
const overRef = ref(false)
const wonRef = ref(false)
const bestRef = ref(player.minigames?.fruitmerge?.best ?? 0)
const runningRef = ref(false)

const IMGS = FRUITS.map((f) => {
  const im = new Image()
  im.src = itemImage(f.id)
  return im
})

const targetText = computed(() => {
  const t = MODES[mode.value].target
  if (!t) return '无尽'
  if (t.score) return `${scoreRef.value}/${t.score}`
  return `合出${FRUITS[t.level - 1].name}${t.count ? ' ×' + t.count : ''}`
})
const lineYRef = ref(110)

function randLevel() {
  // 随机生成仅 1~9 级（高阶不乱刷）：低段权重高
  const r = Math.random()
  if (r < 0.42) return 1
  if (r < 0.7) return 2
  if (r < 0.85) return 3
  if (r < 0.93) return 4
  if (r < 0.965) return 5
  if (r < 0.985) return 6
  if (r < 0.994) return 7
  if (r < 0.998) return 8
  return 9
}
function rollNext() {
  // 幸运水果：5% 概率直接给 5~7 级
  nextLevel = Math.random() < 0.05 ? 5 + Math.floor(Math.random() * 3) : randLevel()
  nextLevelRef.value = nextLevel
}
function reset() {
  fruits = []
  score = 0
  scoreRef.value = 0
  watermelonCount = 0
  combo = 0
  comboRef.value = 0
  over = false
  won = false
  overRef.value = false
  wonRef.value = false
  runningRef.value = false
  lineY = 110
  lineYRef.value = 110
  flashUntil = 0
  aimX = W / 2
  rollNext()
  lastTs = 0
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(loop)
}
function startIfIdle() {
  if (over || won) return false
  if (!runningRef.value) { runningRef.value = true; lastTs = 0 }
  return true
}
function drop() {
  if (over || won) return
  if (!startIfIdle()) return
  const r = FRUITS[nextLevel - 1].r
  fruits.push({ id: nextId++, x: Math.max(r + 1, Math.min(W - r - 1, aimX)), y: 40, vx: 0, vy: 0, level: nextLevel, r, age: 0, mergeCd: 0.05, overTime: 0 })
  rollNext()
}
function mergeAt(a, b) {
  const lv = a.level + 1
  const nf = {
    id: nextId++,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    vx: (a.vx + b.vx) / 2,
    vy: (a.vy + b.vy) / 2 - 40,
    level: lv,
    r: FRUITS[lv - 1].r,
    age: 0,
    mergeCd: 0.05,
    overTime: 0,
  }
  const gain = lv * lv * 4
  score += gain
  scoreRef.value = score
  combo++
  comboRef.value = combo
  if (combo % 5 === 0) { // 暴击合成：连续 5 次合成闪光加分
    const crit = Math.round(gain * 0.5)
    score += crit
    scoreRef.value = score
    flashUntil = performance.now() + 420
  }
  if (lv === 12) watermelonCount++
  return nf
}
function physics(dt) {
  // 积分
  for (const f of fruits) {
    f.vy += GRAV * dt
    if (f.vy > 3200) f.vy = 3200
    f.x += f.vx * dt
    f.y += f.vy * dt
    f.age += dt
    if (f.mergeCd > 0) f.mergeCd -= dt
  }
  // 容器边界（左右墙 + 地面）
  for (const f of fruits) {
    if (f.x - f.r < 0) { f.x = f.r; f.vx = Math.abs(f.vx) * REST }
    if (f.x + f.r > W) { f.x = W - f.r; f.vx = -Math.abs(f.vx) * REST }
    if (f.y + f.r > H) { f.y = H - f.r; f.vy = -Math.abs(f.vy) * REST; f.vx *= 1 - FRICTION }
  }
  // 两两碰撞（先收集合成，避免迭代中改数组）
  let merged = null
  outer: for (let i = 0; i < fruits.length; i++) {
    for (let j = i + 1; j < fruits.length; j++) {
      const a = fruits[i]
      const b = fruits[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.0001
      const minD = a.r + b.r
      if (d >= minD) continue
      // 同级合成（西瓜封顶：level 12 不再合成）
      if (a.level === b.level && a.level < 12 && a.mergeCd <= 0 && b.mergeCd <= 0 && a.age > 0.06 && b.age > 0.06) {
        merged = { a, b, nf: mergeAt(a, b) }
        break outer
      }
      // 碰撞解算：位置修正 + 冲量
      const nx = dx / d
      const ny = dy / d
      const overlap = minD - d
      const ma = a.r * a.r
      const mb = b.r * b.r
      const total = ma + mb
      a.x -= nx * overlap * (mb / total)
      a.y -= ny * overlap * (mb / total)
      b.x += nx * overlap * (ma / total)
      b.y += ny * overlap * (ma / total)
      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const jImp = (-(1 + REST) * vn) / (1 / ma + 1 / mb)
        a.vx -= (jImp * nx) / ma
        a.vy -= (jImp * ny) / ma
        b.vx += (jImp * nx) / mb
        b.vy += (jImp * ny) / mb
      }
    }
  }
  if (merged) {
    const { a, b, nf } = merged
    fruits = fruits.filter((f) => f !== a && f !== b)
    fruits.push(nf)
  }
  // 溢出红线判定（静止且在线上方持续 1.2s）
  if (runningRef.value && !over && !won) {
    for (const f of fruits) {
      if (f.age > 0.6 && Math.abs(f.vy) < 40 && f.y - f.r < lineY) f.overTime += dt
      else f.overTime = 0
      if (f.overTime > 1.2) { lose(); break }
    }
  }
}
function checkWin() {
  const t = MODES[mode.value].target
  if (!t || won) return
  if (t.score && score >= t.score) win()
  else if (t.level && t.count && watermelonCount >= t.count) win()
  else if (t.level && !t.count) {
    if (fruits.some((f) => f.level >= t.level)) win()
  }
}
function win() {
  won = true
  wonRef.value = true
  runningRef.value = false
  const gold = MODES[mode.value].gold
  if (gold > 0) {
    player.gainGameCoins(gold)
    ui.pushLog(`🍉 水果合成通关！${MODES[mode.value].label} +${gold} 游戏币`, 'gain')
  }
  saveBest()
}
function lose() {
  over = true
  overRef.value = true
  runningRef.value = false
  if (MODES[mode.value].target == null) {
    // 无尽模式：按分数档发奖
    const tiers = [[10000, 450], [5000, 260], [2000, 140], [500, 60]]
    const hit = tiers.find(([s]) => score >= s)
    if (hit) {
      player.gainGameCoins(hit[1])
      ui.pushLog(`🍉 水果合成（无尽）：${score} 分 → +${hit[1]} 游戏币`, 'gain')
    }
  }
  saveBest()
}
function saveBest() {
  const mf = player.minigames
  if (!mf.fruitmerge) mf.fruitmerge = { best: 0 }
  best = Math.max(mf.fruitmerge.best ?? 0, score)
  mf.fruitmerge.best = best
  bestRef.value = best
}

function loop(ts) {

  const dt = lastTs ? Math.min(0.033, (ts - lastTs) / 1000) : 0.016
  lastTs = ts
  if (runningRef.value && !over && !won) {
    // 子步进：4 次/帧，提升堆叠稳定性
    const sub = dt / 4
    for (let i = 0; i < 4; i++) physics(sub)
    // 无尽模式动态警戒线（分数越高线越低，空间越小）
    if (MODES[mode.value].target == null) {
      lineY = 110 - Math.min(40, Math.floor(score / 4000) * 10)
      lineYRef.value = lineY
    }
    checkWin()
  }
  draw()
  rafId = requestAnimationFrame(loop)
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  // 背景
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  ctx.fillStyle = dark ? '#241a12' : '#fdf6ea'
  ctx.fillRect(0, 0, W, H)
  // 容器内壁
  ctx.fillStyle = dark ? 'rgba(255,251,244,0.05)' : 'rgba(150,110,70,0.07)'
  ctx.fillRect(0, 0, W, H)
  // 红线
  ctx.strokeStyle = 'rgba(217,75,63,0.85)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(0, lineY)
  ctx.lineTo(W, lineY)
  ctx.stroke()
  ctx.setLineDash([])
  // 水果
  for (const f of fruits) {
    drawFruit(ctx, f.x, f.y, f.r, f.level)
  }
  // 待落水果 + 落点引导
  if (!over && !won) {
    const r = FRUITS[nextLevel - 1].r
    const x = Math.max(r + 1, Math.min(W - r - 1, aimX))
    ctx.strokeStyle = 'rgba(150,110,70,0.35)'
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(x, 40 + r)
    ctx.lineTo(x, H)
    ctx.stroke()
    ctx.setLineDash([])
    drawFruit(ctx, x, 40, r, nextLevel)
  }
  // 暴击闪光
  if (performance.now() < flashUntil) {
    ctx.fillStyle = 'rgba(255, 236, 170, 0.35)'
    ctx.fillRect(0, 0, W, H)
  }
}
function drawFruit(ctx, x, y, r, level) {
  const im = IMGS[level - 1]
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  if (im.complete && im.naturalWidth) {
    ctx.drawImage(im, x - r, y - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = FRUITS[level - 1].color
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(93,64,55,0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2)
  ctx.stroke()
}
function pointerX(e) {
  const cv = canvas.value
  const rect = cv.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * W
}
function onPointerDown(e) {
  if (over || won) return
  aiming = true
  aimX = pointerX(e)
}
function onPointerMove(e) {
  if (over || won) return
  aimX = pointerX(e)
}
function onPointerUp() {
  if (!aiming) return
  aiming = false
  drop()
}
function onKey(e) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); aimX = Math.max(20, aimX - 24) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); aimX = Math.min(W - 20, aimX + 24) }
  else if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); drop() }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  rafId = requestAnimationFrame(loop)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (rafId) cancelAnimationFrame(rafId)
})
reset()
</script>

<template>
  <div class="fm-page">
    <div class="fm-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="fm-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="fm-chip" style="margin-left: auto">⭐ <b class="mono">{{ scoreRef }}</b></span>
      <span class="fm-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="fm-chip">🍎 下一颗 <b class="mono">{{ FRUITS[nextLevelRef - 1].name }}</b></span>
      <span class="fm-chip">🔥 连合 <b class="mono">{{ comboRef }}</b></span>
      <span class="fm-chip">🏆 最佳 <b class="mono">{{ bestRef }}</b></span>
      <button class="fm-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas
      ref="canvas"
      class="fm-canvas"
      :width="W"
      :height="H"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    ></canvas>

    <div class="fm-keys">
      <button class="fm-reset" @click="reset()">🔄 重新开始</button>
    </div>
    <div v-if="wonRef" class="fm-done ok">🎉 达标通关！+{{ MODES[mode].gold }} 游戏币</div>
    <div v-else-if="overRef" class="fm-done">💦 溢出红线！本局 {{ scoreRef }} 分{{ MODES[mode].target ? '（未达标）' : '' }}</div>

    <div v-if="showInfo" class="fm-info-mask" @click.self="showInfo = false">
      <div class="fm-info-box">
        <div class="fm-info-head"><b>🍉 水果合成 · 十种模式说明</b><button class="fm-info-close" @click="showInfo = false">✕</button></div>
        <div class="fm-info-list">
          <div class="fm-info-row fm-info-rule">
            通用规则：点击/拖动定位，松手落果（← → 移动、空格下落）· 两个同级水果相撞即合成上一级（支持连锁）·
            12 级链：{{ FRUITS.map((f) => f.name).join('→') }} · 西瓜封顶不再合成 · 随机只出 1~9 级 · 水果静止后越过红线 1.2 秒判负 ·
            连合每 5 次触发暴击加分 · 5% 概率幸运水果（直接 5~7 级）
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="fm-info-row">
            <b class="fm-info-name">{{ m.label }}</b>
            <span class="fm-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.fm-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.fm-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.fm-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.fm-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.fm-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.fm-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.fm-canvas { width: min(420px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); touch-action: none; cursor: pointer; }
.fm-keys { display: flex; gap: 10px; justify-content: center; }
.fm-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.fm-done { font-weight: 800; color: var(--bad-strong); }
.fm-done.ok { color: var(--good-strong); }
.fm-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.fm-info-box { width: min(600px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.fm-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.fm-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.fm-info-list { display: flex; flex-direction: column; gap: 8px; }
.fm-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.fm-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.6; }
.fm-info-name { flex: 0 0 96px; color: var(--primary-strong); }
.fm-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
