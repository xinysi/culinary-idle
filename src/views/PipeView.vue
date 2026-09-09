<script setup>
// 管道接汤（2026-09-09 新增，第 20 款）：旋转管道把汤汁从锅连到碗
// 点击管道转 90° · 从锅出发 BFS 连通到碗即通关 · 连通后汤汁沿管道流动 · 十模式（棋盘/步数/限时）
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

// 方向：0 上 / 1 右 / 2 下 / 3 左
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]

// ── 十模式（棋盘 × 步数上限 × 限时）──
const MODES = {
  m1: { label: '模式1', n: 4, moves: 20, gold: 30, desc: '4×4 · 20 步内接通 · +30 币' },
  m2: { label: '模式2', n: 4, moves: 16, gold: 40, desc: '4×4 · 16 步内接通 · +40 币' },
  m3: { label: '模式3', n: 4, moves: 13, gold: 50, desc: '4×4 · 13 步内接通 · +50 币' },
  m4: { label: '模式4', n: 5, moves: 30, gold: 65, desc: '5×5 · 30 步内接通 · +65 币' },
  m5: { label: '模式5', n: 5, moves: 24, gold: 80, desc: '5×5 · 24 步内接通 · +80 币' },
  m6: { label: '模式6', n: 5, moves: 20, gold: 95, desc: '5×5 · 20 步内接通 · +95 币' },
  m7: { label: '模式7', n: 6, moves: 42, gold: 110, desc: '6×6 · 42 步内接通 · +110 币' },
  m8: { label: '模式8', n: 6, moves: 34, gold: 125, desc: '6×6 · 34 步内接通 · +125 币' },
  m9: { label: '模式9', n: 6, moves: 28, gold: 140, desc: '6×6 · 28 步内接通 · +140 币' },
  m10: { label: '模式10', n: 6, moves: 24, timeLimit: 150, gold: 165, desc: '6×6 · 24 步 + 限时 150 秒 · +165 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const cells = ref([])
const moves = ref(0)
const elapsed = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const flowSet = ref(new Set()) // 已通汤的格子
const flowOrder = ref(new Map()) // 格子 → 流动顺序
const best = computed(() => player.minigames?.pipe?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const movesText = computed(() => `${moves.value}/${cfg.value.moves}`)
const timeText = computed(() => (cfg.value.timeLimit ? `${elapsed.value}/${cfg.value.timeLimit}` : `${elapsed.value}`))
const cellSize = computed(() => (cfg.value.n === 4 ? 96 : cfg.value.n === 5 ? 78 : 66))
const boardPx = computed(() => cfg.value.n * cellSize.value + (cfg.value.n - 1) * 8)

let timerId = null
let elapsedAccum = 0
let lastTs = 0

// ── 生成：随机自避路径（锅→碗）+ 干扰管件 ──
function neighbors(i, n) {
  const r = Math.floor(i / n)
  const c = i % n
  const out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}
function genPath(n) {
  const target = n * n - 1
  const visited = new Set([0])
  const path = [0]
  const dfs = (i) => {
    if (i === target) return true
    const cand = neighbors(i, n).filter((j) => !visited.has(j))
    // 70% 概率优先朝右下（离目标更近），其余随机，路径更自然
    cand.sort((a, b) => {
      const da = (a % n) + Math.floor(a / n)
      const db = (b % n) + Math.floor(b / n)
      return Math.random() < 0.7 ? db - da : Math.random() - 0.5
    })
    for (const j of cand) {
      visited.add(j)
      path.push(j)
      if (dfs(j)) return true
      visited.delete(j)
      path.pop()
    }
    return false
  }
  dfs(0)
  return path
}
function buildBoard() {
  const n = cfg.value.n
  const total = n * n
  const path = genPath(n)
  const onPath = new Map()
  path.forEach((idx, k) => onPath.set(idx, k))
  const list = new Array(total)
  for (let i = 0; i < total; i++) {
    let arms
    if (onPath.has(i)) {
      const k = onPath.get(i)
      arms = []
      for (const [d, [dx, dy]] of DIRS.entries()) {
        const r = Math.floor(i / n) + dy
        const c = (i % n) + dx
        if (r < 0 || c < 0 || r >= n || c >= n) continue
        const j = r * n + c
        if (onPath.has(j) && Math.abs(onPath.get(j) - k) === 1) arms.push(d)
      }
    } else {
      // 干扰件：多为单头/直管，几乎不构成通路
      const roll = Math.random()
      if (roll < 0.6) arms = [Math.floor(Math.random() * 4)]
      else if (roll < 0.85) arms = [0, 2]
      else arms = [0, 1]
    }
    list[i] = { arms, rot: Math.floor(Math.random() * 4) }
  }
  // 锅与碗：保证出口方向正确（锅朝外/碗朝内由路径决定，这里只固定为端点件）
  list[0] = { arms: list[0].arms, rot: Math.floor(Math.random() * 4), src: true }
  list[total - 1] = { arms: list[total - 1].arms, rot: Math.floor(Math.random() * 4), sink: true }
  return list
}

// ── 当前朝向的接口 ──
function curArms(cell) {
  return cell.arms.map((a) => (a + cell.rot) % 4)
}
function neighborInDir(i, d) {
  const n = cfg.value.n
  const r = Math.floor(i / n)
  const c = i % n
  const nr = r + DIRS[d][1]
  const nc = c + DIRS[d][0]
  if (nr < 0 || nc < 0 || nr >= n || nc >= n) return -1
  return nr * n + nc
}
// 从锅出发 BFS：返回 { ok, order }（order = 连通到各格的步数）
function bfsFlow() {
  const list = cells.value
  const seen = new Map([[0, 0]])
  const q = [0]
  while (q.length) {
    const i = q.shift()
    for (const d of curArms(list[i])) {
      const j = neighborInDir(i, d)
      if (j < 0 || seen.has(j)) continue
      const opp = (d + 2) % 4
      if (!curArms(list[j]).includes(opp)) continue
      seen.set(j, seen.get(i) + 1)
      q.push(j)
    }
  }
  return { ok: seen.has(list.length - 1), order: seen }
}

// ── 交互 ──
function rotate(i) {
  if (!started.value || over.value) return
  const list = cells.value.slice()
  list[i] = { ...list[i], rot: (list[i].rot + 1) % 4 }
  cells.value = list
  moves.value++
  beep(520 + (moves.value % 4) * 70, 0.04, 'triangle', 0.05)
  const { ok, order } = bfsFlow()
  if (ok) {
    // 通汤！
    flowOrder.value = order
    const pathSet = new Set()
    // 取从锅到碗的一条最短路（沿 order 回溯）
    let cur = list.length - 1
    while (cur !== 0) {
      pathSet.add(cur)
      let prev = -1
      for (const d of curArms(list[cur])) {
        const j = neighborInDir(cur, d)
        if (j >= 0 && order.has(j) && order.get(j) === order.get(cur) - 1) { prev = j; break }
      }
      if (prev < 0) break
      cur = prev
    }
    pathSet.add(0)
    flowSet.value = pathSet
    pass()
    return
  }
  if (moves.value >= cfg.value.moves) settle(false)
}
function pass() {
  if (over.value) return
  over.value = true
  passed.value = true
  stopTimer()
  const m = cfg.value
  player.gainGameCoins(m.gold)
  ui.pushLog(`🥣 管道接汤：${moves.value} 步接通！+${m.gold} 游戏币`, 'gain')
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  const mg = player.minigames
  if (!mg.pipe) mg.pipe = { best: 0 }
  mg.pipe.best = mg.pipe.best && mg.pipe.best < moves.value ? mg.pipe.best : moves.value
}
function settle(win) {
  if (over.value) return
  over.value = true
  passed.value = false
  stopTimer()
  if (!win) {
    beep(160, 0.3, 'sawtooth')
    ui.pushLog(`🥣 管道接汤：${cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit ? '超时' : cfg.value.moves + ' 步内没接通'}，未达标`, 'warn')
  }
}

// ── 计时 ──
function startTimer() {
  stopTimer()
  lastTs = performance.now()
  timerId = setInterval(() => {
    const now = performance.now()
    elapsedAccum += (now - lastTs) / 1000
    lastTs = now
    elapsed.value = Math.floor(elapsedAccum)
    if (cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit && !over.value) settle(false)
  }, 200)
}
function stopTimer() {
  if (timerId) clearInterval(timerId)
  timerId = null
}

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
function reset() {
  stopTimer()
  cells.value = buildBoard()
  moves.value = 0
  elapsed.value = 0
  elapsedAccum = 0
  over.value = false
  passed.value = false
  started.value = false
  flowSet.value = new Set()
  flowOrder.value = new Map()
  hint.value = '点击「开始游戏」后，点击管道旋转 90°，把汤汁从锅接到碗'
}
function startGame() {
  if (over.value) return
  started.value = true
  startTimer()
  hint.value = '点击管道旋转，把锅和碗用管道连通'
  beep(880, 0.08)
}

onMounted(() => { reset() })
onUnmounted(() => { stopTimer() })
</script>

<template>
  <div class="pp-page">
    <div class="pp-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="pp-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="pp-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeText }}</b> 秒</span>
      <span class="pp-chip">🎯 步数 <b class="mono">{{ movesText }}</b></span>
      <span class="pp-chip">💰 <b class="mono">{{ cfg.gold }}</b> 币</span>
      <span class="pp-chip">🏆 最少步 <b class="mono">{{ best }}</b></span>
      <button class="pp-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="pp-stage" :style="{ width: boardPx + 2 + 'px', height: boardPx + 2 + 'px' }">
      <div
        v-for="(cell, i) in cells"
        :key="i"
        class="pp-cell"
        :class="{ src: i === 0, sink: i === cells.length - 1, flow: flowSet.has(i) }"
        :style="{
          left: (i % cfg.n) * (cellSize + 8) + 'px',
          top: Math.floor(i / cfg.n) * (cellSize + 8) + 'px',
          width: cellSize + 'px',
          height: cellSize + 'px',
          '--flow-delay': (flowOrder.get(i) ?? 0) * 0.12 + 's',
        }"
        @click="rotate(i)"
      >
        <div v-for="d in curArms(cell)" :key="d" class="pp-arm" :class="'pp-d' + d"></div>
        <div class="pp-hub">
          <span v-if="i === 0" class="pp-icon">🍲</span>
          <span v-else-if="i === cells.length - 1" class="pp-icon">🍚</span>
        </div>
      </div>
    </div>

    <div class="pp-hint">{{ hint }}</div>

    <div class="pp-keys">
      <button v-if="!started" class="pp-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="pp-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="pp-mask">
      <div class="pp-result">
        <div class="pp-result-head"><b>{{ passed ? '🎉 汤汁接通！' : '💦 没接通' }}</b></div>
        <div class="pp-result-score">
          <span>用了 <b class="mono">{{ moves }}</b> 步</span>
          <span class="dim">上限 {{ cfg.moves }} 步</span>
          <span class="dim">用时 {{ elapsed }} 秒</span>
          <span v-if="passed" class="pp-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="pp-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="pp-fire">
        <span v-for="i in 20" :key="i" class="pp-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="pp-info-mask" @click.self="showInfo = false">
      <div class="pp-info-box">
        <div class="pp-info-head"><b>🥣 管道接汤 · 十模式说明</b><button class="pp-info-close" @click="showInfo = false">✕</button></div>
        <div class="pp-info-list">
          <div class="pp-info-row pp-info-rule">
            玩法：<b>点击任意管道让它旋转 90°</b>，把左上角的锅（🍲）和右下角的碗（🍚）用管道连通。<br />
            管道分直管、弯管、三通等形状；只有<b>两端接口都对准</b>才算连通，汤汁会从锅沿管道一路流到碗。<br />
            每局有<b>步数上限</b>（每转一次算一步），用完还没接通就判负；模式 10 还有限时。<br />
            开局由「随机合法路径 + 干扰管件」生成，<b>保证一定可解</b>。<br />
            结算：在步数（与时限）内接通即达标发游戏币，并记录同模式的最少步数。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="pp-info-row">
            <b class="pp-info-name">{{ m.label }}</b>
            <span class="pp-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pp-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.pp-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.pp-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.pp-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.pp-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.pp-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }

.pp-stage { position: relative; border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.pp-cell { position: absolute; border-radius: 10px; background: rgba(255, 252, 246, 0.92); border: 1px solid rgba(150, 110, 70, 0.3); cursor: pointer; transition: box-shadow 0.12s; }
.pp-cell:hover { box-shadow: 0 0 0 2px rgba(217, 90, 56, 0.35); }
.pp-cell.src { background: rgba(255, 238, 214, 0.96); border-color: rgba(217, 90, 56, 0.5); }
.pp-cell.sink { background: rgba(226, 242, 255, 0.96); border-color: rgba(79, 143, 217, 0.5); }
/* 管道手臂 */
.pp-arm { position: absolute; background: #b9a08a; }
.pp-d0 { top: 0; left: 50%; width: 14px; height: 50%; margin-left: -7px; }
.pp-d1 { right: 0; top: 50%; height: 14px; width: 50%; margin-top: -7px; }
.pp-d2 { bottom: 0; left: 50%; width: 14px; height: 50%; margin-left: -7px; }
.pp-d3 { left: 0; top: 50%; height: 14px; width: 50%; margin-top: -7px; }
.pp-hub { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #a8927c; display: flex; align-items: center; justify-content: center; }
.pp-icon { font-size: 15px; line-height: 1; }
/* 通汤后沿路径流动 */
.pp-cell.flow { animation: ppFlow 0.9s ease forwards; animation-delay: var(--flow-delay); }
@keyframes ppFlow {
  0% { background: rgba(255, 252, 246, 0.92); }
  40% { background: rgba(240, 190, 110, 0.95); box-shadow: 0 0 14px rgba(224, 161, 58, 0.7); }
  100% { background: rgba(240, 190, 110, 0.95); box-shadow: 0 0 0 rgba(224, 161, 58, 0); }
}
.pp-cell.flow .pp-arm, .pp-cell.flow .pp-hub { animation: ppPipe 0.9s ease forwards; animation-delay: var(--flow-delay); }
@keyframes ppPipe { 0% { background: #b9a08a; } 40% { background: #e8a24a; } 100% { background: #d98a3a; } }

.pp-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.pp-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.pp-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.pp-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.pp-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.pp-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.pp-result-head { font-size: 18px; }
.pp-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.pp-gold { color: var(--good-strong); font-weight: 800; }
.pp-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.pp-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.pp-spark { position: absolute; font-size: 22px; color: var(--gold); animation: ppSpark 1.1s ease-out forwards; }
@keyframes ppSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.pp-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.pp-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.pp-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.pp-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.pp-info-list { display: flex; flex-direction: column; gap: 8px; }
.pp-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.pp-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.pp-info-rule b { color: var(--primary-strong); }
.pp-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.pp-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
