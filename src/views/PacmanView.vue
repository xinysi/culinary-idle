<script setup>
// 吃豆人（2026-09-08 新增）：Canvas 迷宫 · 十模式（幽灵数 0~3 × 速度）× 通关奖励
import { ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const COLS = 15
const ROWS = 13
// 迷宫：奇偶列墙 + 奇偶行全通（保证全图连通）
const MAZE = [
  '###############',
  '#.............#',
  '#.##.##.##.##.#',
  '#.............#',
  '#.##.##.##.##.#',
  '#.............#',
  '#.##.##.##.##.#',
  '#.............#',
  '#.##.##.##.##.#',
  '#.............#',
  '#.##.##.##.##.#',
  '#.............#',
  '###############',
]
const isWall = (x, y) => MAZE[y]?.[x] === '#'
const DOTS = []
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!isWall(x, y)) DOTS.push([x, y])

const mode = ref('g1s')
const METAS = {
  g0: { label: '无鬼练习', ghosts: 0, mul: 1.0, gold: 50, desc: '0 幽灵 · 标准速度 · 通关 +50 币 —— 先记路' },
  g1s: { label: '一鬼·慢', ghosts: 1, mul: 1.0, gold: 70, desc: '1 幽灵 · 标准速 · 通关 +70 币' },
  g1m: { label: '一鬼·标准', ghosts: 1, mul: 0.85, gold: 100, desc: '1 幽灵 · 快 15% · 通关 +100 币' },
  g1f: { label: '一鬼·快', ghosts: 1, mul: 0.7, gold: 150, desc: '1 幽灵 · 快 30% · 通关 +150 币' },
  g2s: { label: '双鬼·慢', ghosts: 2, mul: 1.0, gold: 120, desc: '2 幽灵 · 标准速 · 通关 +120 币' },
  g2m: { label: '双鬼·标准', ghosts: 2, mul: 0.85, gold: 170, desc: '2 幽灵 · 快 15% · 通关 +170 币' },
  g2f: { label: '双鬼·快', ghosts: 2, mul: 0.7, gold: 250, desc: '2 幽灵 · 快 30% · 通关 +250 币' },
  g3s: { label: '三鬼·慢', ghosts: 3, mul: 1.0, gold: 200, desc: '3 幽灵 · 标准速 · 通关 +200 币' },
  g3m: { label: '三鬼·标准', ghosts: 3, mul: 0.85, gold: 280, desc: '3 幽灵 · 快 15% · 通关 +280 币' },
  g3f: { label: '三鬼·快', ghosts: 3, mul: 0.7, gold: 400, desc: '3 幽灵 · 快 30% · 通关 +400 币 —— 极限躲藏' },
}
const showInfo = ref(false)

const canvas = ref(null)
let playerPos = [1, 1]
let playerDir = [1, 0]
let nextDir = [1, 0]
let ghosts = []
const dots = ref([])
let scaredUntil = 0
const over = ref(false)
const running = ref(false)
let rafId = null
let lastP = 0
let lastG = 0
let px = 1 // 渲染插值坐标（平滑移动）
let py = 1
let gx = []
let gy = []
let eaten = 0

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
}
function reset() {
  stopLoop()
  playerPos = [1, 1]
  playerDir = [1, 0]
  nextDir = [1, 0]
  dots.value = DOTS.map(([x, y]) => [x, y])
  eaten = 0
  ghosts = []
  for (let i = 0; i < METAS[mode.value].ghosts; i++) ghosts.push({ x: 7, y: 6 + i, dir: i % 2 ? [-1, 0] : [1, 0] })
  gx = ghosts.map((g) => g.x)
  gy = ghosts.map((g) => g.y)
  px = playerPos[0]
  py = playerPos[1]
  scaredUntil = 0
  over.value = false
  running.value = false
  draw()
}
function start() {
  if (running.value || over.value) return
  running.value = true
  px = playerPos[0]
  py = playerPos[1]
  gx = ghosts.map((g) => g.x)
  gy = ghosts.map((g) => g.y)
  lastP = performance.now()
  lastG = lastP
  rafId = requestAnimationFrame(loop)
}
function loop(ts) {
  const m = METAS[mode.value]
  // 基准 210ms/格（快档 0.7 → 147ms/格，匀速不跳变）
  if (ts - lastP >= 210 * m.mul) { lastP = ts; step() }
  if (ts - lastG >= 240 * m.mul) { lastG = ts; stepGhosts() }
  px += (playerPos[0] - px) * 0.18
  py += (playerPos[1] - py) * 0.18
  ghosts.forEach((g, i) => { gx[i] += (g.x - gx[i]) * 0.14; gy[i] += (g.y - gy[i]) * 0.14 })
  draw()
  if (running.value && !over.value) rafId = requestAnimationFrame(loop)
}
function step() {
  if (over.value) return
  const [nx, ny] = [playerPos[0] + nextDir[0], playerPos[1] + nextDir[1]]
  if (!isWall(nx, ny)) {
    playerPos = [nx, ny]
    playerDir = nextDir
  } else {
    const [tx, ty] = [playerPos[0] + playerDir[0], playerPos[1] + playerDir[1]]
    if (!isWall(tx, ty)) playerPos = [tx, ty]
  }
  eatNow()
  checkGhost()
}
function eatNow() {
  const idx = dots.value.findIndex(([x, y]) => x === playerPos[0] && y === playerPos[1])
  if (idx >= 0) {
    dots.value.splice(idx, 1)
    eaten++
    // 角落能量豆：吃后幽灵减速 5 秒（变蓝，被抓概率下降）
    if ((playerPos[0] === 1 && playerPos[1] === 1) || (playerPos[0] === 13 && playerPos[1] === 1) || (playerPos[0] === 1 && playerPos[1] === 11) || (playerPos[0] === 13 && playerPos[1] === 11)) {
      scaredUntil = Date.now() + 5000
    }
    if (!dots.value.length) win()
  }
}
function stepGhosts() {
  if (over.value) return
  const scared = Date.now() < scaredUntil
  for (const g of ghosts) {
    if (scared && Math.random() < 0.4) continue // 能量豆期间减速
    const opts = []
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, ny] = [g.x + dx, g.y + dy]
      if (!isWall(nx, ny) && !(g.dir[0] + dx === 0 && g.dir[1] + dy === 0)) opts.push([nx, ny, [dx, dy]])
    }
    if (!opts.length) continue
    opts.sort((a, b) => (Math.abs(a[0] - playerPos[0]) + Math.abs(a[1] - playerPos[1])) - (Math.abs(b[0] - playerPos[0]) + Math.abs(b[1] - playerPos[1])))
    const pick = Math.random() < 0.7 ? opts[0] : opts[Math.floor(Math.random() * opts.length)]
    g.x = pick[0]; g.y = pick[1]; g.dir = pick[2]
  }
  checkGhost()
  draw()
}
function checkGhost() {
  if (over.value) return
  for (const g of ghosts) {
    if (g.x === playerPos[0] && g.y === playerPos[1]) {
      if (Date.now() < scaredUntil) {
        g.x = 7; g.y = 6 + ghosts.indexOf(g) // 吃到鬼：回巢重生
      } else {
        lose()
        return
      }
    }
  }
}
function win() {
  over.value = true
  running.value = false
  stopLoop()

  const gold = METAS[mode.value].gold
  player.gainGameCoins(gold)
  ui.pushLog(`👻 吃豆人通关！+${gold} 游戏币`, 'gain')
}
function lose() {
  over.value = true
  running.value = false
  stopLoop()

}
const keyMap = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
function onKey(e) {
  const d = keyMap[e.key]
  if (!d) return
  e.preventDefault()
  nextDir = d
}
window.addEventListener('keydown', onKey)
onUnmounted(() => { window.removeEventListener('keydown', onKey) })

function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const s = cv.width / COLS
  ctx.fillStyle = '#241a12'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#e0b25f'
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (isWall(x, y)) {
      ctx.fillStyle = '#4a3a55'
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2)
    } else if (dots.value.some(([dx, dy]) => dx === x && dy === y)) {
      ctx.fillStyle = '#f2e6d7'
      ctx.beginPath()
      ctx.arc(x * s + s / 2, y * s + s / 2, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // 幽灵（插值坐标平滑移动）
  const scared = Date.now() < scaredUntil
  for (let i = 0; i < ghosts.length; i++) {
    const gx2 = gx[i]
    const gy2 = gy[i]
    if (gx2 === undefined || gy2 === undefined) continue
    ctx.fillStyle = scared ? '#3f6fb2' : '#d95a6b'
    ctx.beginPath()
    ctx.arc(gx2 * s + s / 2, gy2 * s + s / 2 + 1, s / 2 - 4, Math.PI, 0)
    ctx.lineTo(gx2 * s + s - 4, gy2 * s + s - 5)
    ctx.lineTo(gx2 * s + s / 2 + 4, gy2 * s + s - 9)
    ctx.lineTo(gx2 * s + s / 2, gy2 * s + s - 5)
    ctx.lineTo(gx2 * s + 4, gy2 * s + s - 9)
    ctx.lineTo(gx2 * s + 4, gy2 * s + s - 5)
    ctx.fill()
  }
  // 吃豆人（插值坐标）
  ctx.fillStyle = '#f4c542'
  const pcx = px * s + s / 2
  const pcy = py * s + s / 2
  const ang = Math.atan2(playerDir[1], playerDir[0])
  ctx.beginPath()
  ctx.moveTo(pcx, pcy)
  ctx.arc(pcx, pcy, s / 2 - 4, ang + 0.4, ang - 0.4)
  ctx.closePath()
  ctx.fill()
}
onMounted(() => draw())
reset()
</script>

<template>
  <div class="pm-page">
    <div class="pm-topbar">
      <button v-for="(m, key, idx) in METAS" :key="key" class="pm-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="pm-chip" style="margin-left: auto">🟡 剩余 <b class="mono">{{ dots.length }}</b></span>
      <span class="pm-chip">👻 幽灵 <b class="mono">{{ METAS[mode].ghosts }}</b></span>
      <span class="pm-chip">💰 通关 <b class="mono">{{ METAS[mode].gold }}</b> 币</span>
      <button class="pm-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="pm-canvas" width="420" height="364"></canvas>

    <div class="pm-keys">
      <button class="pm-key" @click="onKey({ key: 'ArrowLeft', preventDefault() {} })">←</button>
      <button class="pm-key" @click="onKey({ key: 'ArrowUp', preventDefault() {} })">↑</button>
      <button class="pm-key" @click="onKey({ key: 'ArrowDown', preventDefault() {} })">↓</button>
      <button class="pm-key" @click="onKey({ key: 'ArrowRight', preventDefault() {} })">→</button>
      <button class="pm-reset" @click="reset()">重新开始</button>
      <button class="pm-start" @click="start()">{{ running ? '⏸ 进行中…' : over ? '🏁 再来一局' : '▶ 开始' }}</button>
    </div>
        <div v-if="over" class="pm-mask">
      <div class="pm-result">
        <div class="pm-result-head"><b>{{ !dots.length ? '👻 通关！' : '💦 被幽灵抓住！' }}</b></div>
        <div class="pm-result-score"><span>{{ !dots.length ? '奖励已结算' : '再来一局' }}</span></div>
        <button class="pm-again" @click="reset(); start()">🔄 再来一局</button>
      </div>
      <div v-if="!dots.length" class="pm-fire">
        <span v-for="i in 20" :key="i" class="pm-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="pm-info-mask" @click.self="showInfo = false">
      <div class="pm-info-box">
        <div class="pm-info-head"><b>👻 吃豆人 · 十种模式说明</b><button class="pm-info-close" @click="showInfo = false">✕</button></div>
        <div class="pm-info-list">
          <div class="pm-info-row pm-info-rule">通用规则：吃完所有豆子通关得金币 · 角落能量豆让幽灵减速 5 秒（撞到即回巢）· 被幽灵抓住即失败无奖励</div>
          <div v-for="(m, key) in METAS" :key="key" class="pm-info-row">
            <b class="pm-info-name">{{ m.label }}</b>
            <span class="pm-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.pm-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.pm-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.pm-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.pm-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.pm-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.pm-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.pm-canvas { width: min(480px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); }
.pm-keys {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}
.pm-key { width: 48px; height: 42px; border-radius: 12px; font-size: 17px; font-weight: 800; cursor: pointer; background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); color: var(--text); }
.pm-reset { padding: 0 24px; height: 42px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.pm-start {
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
.pm-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.pm-info-box {
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
.pm-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.pm-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.pm-info-list { display: flex; flex-direction: column; gap: 8px; }
.pm-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.pm-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.pm-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.pm-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── pm 结算弹窗（2026-09-09 统一）── */
.pm-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.pm-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.pm-result-head { font-size: 18px; }
.pm-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.pm-gold { color: var(--good-strong); font-weight: 800; }
.pm-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.pm-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.pm-spark { position: absolute; font-size: 22px; color: var(--gold); animation: pmSpark 1.1s ease-out forwards; }
@keyframes pmSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
</style>
