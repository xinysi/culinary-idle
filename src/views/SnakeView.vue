<script setup>
// 贪吃蛇（2026-09-08 新增）：Canvas 网格 · 十模式（速度 × 边界/障碍）× 每食物结算
import { ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const COLS = 20
const ROWS = 15

const mode = ref('s2')
const METAS = {
  s1: { label: '慢速休闲', speed: 0.2, wrap: false, obs: false, rate: 0.6, desc: '0.20s/格 · 每食物 0.6 币 —— 慢慢吃' },
  s2: { label: '标准', speed: 0.15, wrap: false, obs: false, rate: 1.0, desc: '0.15s/格 · 每食物 1 币 —— 经典体验' },
  s3: { label: '快速', speed: 0.11, wrap: false, obs: false, rate: 1.6, desc: '0.11s/格 · 每食物 1.6 币' },
  s4: { label: '极速', speed: 0.08, wrap: false, obs: false, rate: 2.4, desc: '0.08s/格 · 每食物 2.4 币 —— 手速拉满' },
  w1: { label: '穿墙·慢', speed: 0.16, wrap: true, obs: false, rate: 1.2, desc: '0.16s/格 · 可穿墙 · 每食物 1.2 币' },
  w2: { label: '穿墙·标准', speed: 0.12, wrap: true, obs: false, rate: 1.8, desc: '0.12s/格 · 可穿墙 · 每食物 1.8 币' },
  w3: { label: '穿墙·快', speed: 0.09, wrap: true, obs: false, rate: 3.0, desc: '0.09s/格 · 可穿墙 · 每食物 3 币' },
  o1: { label: '障碍·标准', speed: 0.14, wrap: false, obs: true, rate: 2.0, desc: '0.14s/格 · 障碍物 12 块 · 每食物 2 币' },
  o2: { label: '障碍·快', speed: 0.10, wrap: false, obs: true, rate: 3.2, desc: '0.10s/格 · 障碍 12 块 · 每食物 3.2 币' },
  o3: { label: '障碍·超快', speed: 0.07, wrap: false, obs: true, rate: 5.0, desc: '0.07s/格 · 障碍 12 块 · 每食物 5 币 —— 地狱模式' },
}
const showInfo = ref(false)

const canvas = ref(null)
let snake = []
let dir = [1, 0]
let nextDir = [1, 0]
let food = [0, 0]
let obs = []
let eaten = 0
let timerId = null
let over = false
const running = ref(false)

function randCell() {
  const c = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)]
  if (snake.some(([x, y]) => x === c[0] && y === c[1]) || obs.some(([x, y]) => x === c[0] && y === c[1]) || (food[0] === c[0] && food[1] === c[1])) return randCell()
  return c
}
function genObs() {
  const m = METAS[mode.value]
  const list = []
  for (let i = 0; i < 12; i++) {
    const c = [Math.floor(1 + Math.random() * (COLS - 2)), Math.floor(1 + Math.random() * (ROWS - 2))]
    if (list.some(([x, y]) => x === c[0] && y === c[1]) || (c[0] === 10 && c[1] === 7)) { i--; continue }
    list.push(c)
  }
  return list
}
function reset() {
  if (timerId) clearInterval(timerId)
  snake = [[10, 7], [9, 7], [8, 7]]
  dir = [1, 0]
  nextDir = [1, 0]
  obs = METAS[mode.value].obs ? genObs() : []
  food = randCell()
  eaten = 0
  over = false
  running.value = false
  draw()
}
function start() {
  if (running.value || over) return
  running.value = true
  timerId = setInterval(tick, METAS[mode.value].speed * 1000)
}
function tick() {
  if (over) return
  dir = nextDir
  const m = METAS[mode.value]
  let [nx, ny] = [snake[0][0] + dir[0], snake[0][1] + dir[1]]
  if (m.wrap) {
    nx = (nx + COLS) % COLS
    ny = (ny + ROWS) % ROWS
  } else if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return die()
  if (obs.some(([x, y]) => x === nx && y === ny)) return die()
  if (snake.slice(0, -1).some(([x, y]) => x === nx && y === ny)) return die()
  snake.unshift([nx, ny])
  if (nx === food[0] && ny === food[1]) {
    eaten++
    food = randCell()
  } else snake.pop()
  draw()
}
function die() {
  over = true
  running.value = false
  if (timerId) clearInterval(timerId)
  const coins = Math.round(eaten * METAS[mode.value].rate)
  if (coins > 0) {
    player.gainGameCoins(coins)
    ui.pushLog(`🐍 贪吃蛇：${eaten} 个食物 → +${coins} 游戏币`, 'gain')
  }
}
const keyMap = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] }
function onKey(e) {
  if (!running.value) return // 未开始/已结束时不拦截方向键（保留页面滚动）
  const d = keyMap[e.key]
  if (!d) return
  e.preventDefault()
  if (dir[0] + d[0] === 0 && dir[1] + d[1] === 0) return // 禁止 180° 反转
  nextDir = d
}
window.addEventListener('keydown', onKey)
onUnmounted(() => { window.removeEventListener('keydown', onKey); if (timerId) clearInterval(timerId) })

function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const cw = cv.width / COLS
  const ch = cv.height / ROWS
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#2e241c'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#7a5c3f'
  for (const [x, y] of obs) ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2)
  ctx.fillStyle = '#e8723f'
  ctx.beginPath()
  ctx.arc(food[0] * cw + cw / 2, food[1] * ch + ch / 2, cw / 2 - 3, 0, Math.PI * 2)
  ctx.fill()
  snake.forEach(([x, y], i) => {
    ctx.fillStyle = i === 0 ? '#8fd14e' : '#5f9e3a'
    ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2)
  })
}
onMounted(() => draw())
reset()
</script>

<template>
  <div class="sn-page">
    <div class="sn-topbar">
      <button v-for="(m, key, idx) in METAS" :key="key" class="sn-mode" :class="{ on: mode === key }" @click="mode = key; reset()">模式{{ idx + 1 }}</button>
      <span class="sn-chip" style="margin-left: auto">🍎 食物 <b class="mono">{{ eaten }}</b></span>
      <span class="sn-chip">⏱ 速度 <b class="mono">{{ METAS[mode].speed.toFixed(2) }}s/格</b></span>
      <span class="sn-chip">💰 每食 <b class="mono">{{ METAS[mode].rate }}</b> 币</span>
      <button class="sn-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <canvas ref="canvas" class="sn-canvas" width="480" height="360"></canvas>

    <div class="sn-keys">
      <button class="sn-key" @click="onKey({ key: 'ArrowLeft', preventDefault() {} })">←</button>
      <button class="sn-key" @click="onKey({ key: 'ArrowUp', preventDefault() {} })">↑</button>
      <button class="sn-key" @click="onKey({ key: 'ArrowDown', preventDefault() {} })">↓</button>
      <button class="sn-key" @click="onKey({ key: 'ArrowRight', preventDefault() {} })">→</button>
      <button class="sn-reset" @click="reset()">🔄 重置本局</button>
      <button class="sn-start" @click="start()">{{ running ? '⏸ 进行中…' : over ? '🏁 再来一局' : '▶ 开始游戏' }}</button>
    </div>
        <div v-if="over" class="sn-mask">
      <div class="sn-result">
        <div class="sn-result-head"><b>🐍 本局结束</b></div>
        <div class="sn-result-score">本局吃到 <b class="mono">{{ eaten }}</b> 个食物</div>
        <button class="sn-again" @click="reset(); start()">🔄 再来一局</button>
      </div>
    </div>

    <div v-if="showInfo" class="sn-info-mask" @click.self="showInfo = false">
      <div class="sn-info-box">
        <div class="sn-info-head"><b>🐍 贪吃蛇 · 十种模式说明</b><button class="sn-info-close" @click="showInfo = false">✕</button></div>
        <div class="sn-info-list">
          <div class="sn-info-row sn-info-rule">通用规则：方向键/WASD 控制 · 吃苹果 +1 分 · 撞墙/撞身/撞障碍死亡 · 死亡按「食物数 × 模式单价」结算游戏币</div>
          <div v-for="(m, key) in METAS" :key="key" class="sn-info-row">
            <b class="sn-info-name">{{ m.label }}</b>
            <span class="sn-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.sn-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.sn-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.sn-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.sn-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.sn-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.sn-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}
.sn-canvas { width: min(560px, 94%); border-radius: 16px; border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); }
.sn-keys {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}
.sn-key { width: 48px; height: 42px; border-radius: 12px; font-size: 17px; font-weight: 800; cursor: pointer; background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); color: var(--text); }
.sn-reset { padding: 0 24px; height: 42px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.sn-start {
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
.sn-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.sn-info-box {
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
.sn-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.sn-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.sn-info-list { display: flex; flex-direction: column; gap: 8px; }
.sn-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.sn-info-rule {
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  display: block;
  line-height: 1.7;
}
.sn-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.sn-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}

/* ── sn 结算弹窗（2026-09-09 统一）── */
.sn-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.sn-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.sn-result-head { font-size: 18px; }
.sn-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.sn-gold { color: var(--good-strong); font-weight: 800; }
.sn-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.sn-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.sn-spark { position: absolute; font-size: 22px; color: var(--gold); animation: snSpark 1.1s ease-out forwards; }
@keyframes snSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
</style>
