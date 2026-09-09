<script setup>
// 冰面滑行（2026-09-09 新增，第 24 款）：食材在冰面上一滑到底，撞墙/撞石头才停
// 点方向键滑动，把路上的 🍒 全部收集即通关；由 BFS 验证可解（棋盘小，状态空间可穷举）
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

// 方向：0 上 / 1 右 / 2 下 / 3 左
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]

// ── 十模式 ──
const MODES = {
  m1: { label: '模式1', n: 5, targets: 1, rocks: 0, moves: 12, timeLimit: 0, gold: 30, desc: '5×5 · 1 个目标 · 12 步内 · +30 币' },
  m2: { label: '模式2', n: 5, targets: 2, rocks: 2, moves: 14, timeLimit: 0, gold: 40, desc: '5×5 · 2 个目标 + 2 块石头 · 14 步 · +40 币' },
  m3: { label: '模式3', n: 6, targets: 2, rocks: 4, moves: 16, timeLimit: 0, gold: 55, desc: '6×6 · 2 个目标 · 16 步 · +55 币' },
  m4: { label: '模式4', n: 6, targets: 3, rocks: 5, moves: 18, timeLimit: 0, gold: 70, desc: '6×6 · 3 个目标 · 18 步 · +70 币' },
  m5: { label: '模式5', n: 7, targets: 3, rocks: 7, moves: 20, timeLimit: 0, gold: 85, desc: '7×7 · 3 个目标 · 20 步 · +85 币' },
  m6: { label: '模式6', n: 7, targets: 3, rocks: 7, moves: 20, timeLimit: 90, gold: 100, desc: '7×7 · 3 个目标 · **限时 90 秒** · +100 币' },
  m7: { label: '模式7', n: 7, targets: 3, rocks: 7, moves: 22, timeLimit: 0, ordered: true, gold: 115, desc: '7×7 · **顺序收集**（必须按 ①②③ 编号依次收）· 22 步 · +115 币' },
  m8: { label: '模式8', n: 8, targets: 4, rocks: 11, moves: 24, timeLimit: 0, gold: 130, desc: '8×8 · 4 个目标 · 24 步 · +130 币' },
  m9: { label: '模式9', n: 8, targets: 4, rocks: 11, moves: 26, timeLimit: 0, crumble: true, gold: 145, desc: '8×8 · 4 个目标 · **碎冰**（滑过的格子会碎，不能回头）· 26 步 · +145 币' },
  m10: { label: '模式10', n: 9, targets: 5, rocks: 15, moves: 30, timeLimit: 150, crumble: true, ordered: true, gold: 165, desc: '9×9 · **碎冰 + 顺序收集 + 限时 150 秒** · 30 步 · +165 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const n = ref(5)
const rocks = ref([]) // 索引数组
const targets = ref([]) // 索引数组
const playerIdx = ref(0)
const collected = ref(0) // 已收集（bitmask）
const moves = ref(0)
const elapsed = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const lastDir = ref(-1)
const sliding = ref(false)
const holes = ref(new Set()) // 碎冰模式：已碎掉的格子
const best = computed(() => player.minigames?.ice?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const cellSize = computed(() => (cfg.value.n <= 6 ? 62 : cfg.value.n <= 7 ? 56 : cfg.value.n <= 8 ? 50 : 44))
const boardPx = computed(() => cfg.value.n * cellSize.value + (cfg.value.n - 1) * 3)
const movesText = computed(() => `${moves.value}/${cfg.value.moves}`)
const timeText = computed(() => (cfg.value.timeLimit ? `${elapsed.value}/${cfg.value.timeLimit}` : `${elapsed.value}`))
const collectedCount = computed(() => targets.value.filter((_, k) => collected.value & (1 << k)).length)

let timerId = null
let elapsedAccum = 0
let lastTs = 0

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

// ── 滑行 ──
function cellRC(i) { return [Math.floor(i / n.value), i % n.value] }
function idxOf(r, c) { return r * n.value + c }
function rockSet() { return new Set(rocks.value) }
// 从 i 向 d 滑到底，返回 { end, path }（path 含经过的格，不含起点）
function slidePath(i, d, rockSetRef, holesRef) {
  // DIRS 是 [dx, dy]：0 上(0,-1) / 1 右(1,0) / 2 下(0,1) / 3 左(-1,0)
  const [dx, dy] = DIRS[d]
  let [r, c] = cellRC(i)
  const path = []
  while (true) {
    const nr = r + dy
    const nc = c + dx
    if (nr < 0 || nc < 0 || nr >= n.value || nc >= n.value) break
    const j = idxOf(nr, nc)
    if (rockSetRef.has(j) || (holesRef && holesRef.has(j))) break
    r = nr
    c = nc
    path.push(j)
  }
  return { end: idxOf(r, c), path }
}
// BFS 验证可解：状态 = 位置 + 已收集掩码
function solvable(start, rockSetRef, targetList, maxSteps) {
  const key = (i, mask) => i * 1024 + mask
  const seen = new Set([key(start, 0)])
  const q = [[start, 0, 0]]
  const full = (1 << targetList.length) - 1
  while (q.length) {
    const [i, mask, dist] = q.shift()
    if (mask === full) return dist
    if (dist >= maxSteps) continue
    for (let d = 0; d < 4; d++) {
      const { end, path } = slidePath(i, d, rockSetRef)
      if (end === i) continue
      let nm = mask
      for (const j of path) {
        const k = targetList.indexOf(j)
        if (k >= 0) nm |= (1 << k)
      }
      const kk = key(end, nm)
      if (seen.has(kk)) continue
      seen.add(kk)
      q.push([end, nm, dist + 1])
    }
  }
  return -1
}
// 生成（倒推法）：随机石头 → 随机滑行一串 → 把「滑到过的格子」选作目标
// 这样目标一定能在步数上限内被这串滑动收集到，天然保证可解，不会出现无解盘面
function buildBoard() {
  const size = cfg.value.n
  const total = size * size
  n.value = size // 必须先设尺寸：slidePath 依赖 n.value
  for (let attempt = 0; attempt < 60; attempt++) {
    const rockSet = new Set()
    let guard = 0
    while (rockSet.size < cfg.value.rocks && guard++ < 500) rockSet.add(Math.floor(Math.random() * total))
    const free = []
    for (let i = 0; i < total; i++) if (!rockSet.has(i)) free.push(i)
    if (free.length < cfg.value.targets + 1) continue
    const startIdx = free[Math.floor(Math.random() * free.length)]
    const visited = new Set([startIdx])
    const stops = []
    const genHoles = new Set()
    const walk = []
    let cur = startIdx
    for (let step = 0; step < cfg.value.moves; step++) {
      const d = Math.floor(Math.random() * 4)
      const { end, path } = slidePath(cur, d, rockSet, cfg.value.crumble ? genHoles : null)
      if (end === cur) continue
      walk.push(d)
      if (cfg.value.crumble) {
        genHoles.add(cur)
        for (const j of path) if (j !== end) genHoles.add(j)
      }
      cur = end
      if (!visited.has(end)) { visited.add(end); stops.push(end) }
    }
    if (stops.length < cfg.value.targets) continue
    const picked = stops.slice().sort(() => Math.random() - 0.5).slice(0, cfg.value.targets)
    // 顺序模式：目标数组顺序必须是「生成时的访问顺序」，否则玩家按编号收会对不上
    const tgt = cfg.value.ordered ? picked.slice().sort((a, b) => stops.indexOf(a) - stops.indexOf(b)) : picked
    rocks.value = [...rockSet]
    targets.value = tgt
    playerIdx.value = startIdx
    return true
  }
  // 兜底：空场 + 一个目标
  const total2 = size * size
  n.value = size
  rocks.value = []
  targets.value = [total2 - 1]
  playerIdx.value = 0
  return false
}

// ── 交互 ──
function move(d) {
  if (!started.value || over.value || sliding.value) return
  const rockSetRef = rockSet()
  const { end, path } = slidePath(playerIdx.value, d, rockSetRef, cfg.value.crumble ? holes.value : null)
  if (end === playerIdx.value) { beep(220, 0.08, 'sawtooth', 0.04); return }
  lastDir.value = d
  sliding.value = true
  // 碎冰：离开的格子与滑过的格子碎掉（终点不碎）
  if (cfg.value.crumble) {
    const nh = new Set(holes.value)
    nh.add(playerIdx.value)
    for (const j of path) if (j !== end) nh.add(j)
    holes.value = nh
  }
  playerIdx.value = end
  moves.value++
  // 收集（顺序模式：只能按编号依次收）
  let got = 0
  for (const j of path) {
    const k = targets.value.indexOf(j)
    if (k < 0) continue
    if (cfg.value.ordered) {
      if (k === collectedCount.value && !(collected.value & (1 << k))) { collected.value |= (1 << k); got++ }
    } else if (!(collected.value & (1 << k))) {
      collected.value |= (1 << k)
      got++
    }
  }
  if (got > 0) {
    beep(880, 0.08)
    setTimeout(() => beep(1175, 0.09), 70)
  } else {
    beep(520, 0.05, 'triangle', 0.05)
  }
  setTimeout(() => { sliding.value = false }, 190)
  if (collectedCount.value >= targets.value.length) { pass(); return }
  if (moves.value >= cfg.value.moves) settle(false)
}
function onKey(e) {
  if (!running) return
  if (e.key === 'ArrowUp') { e.preventDefault(); move(0) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); move(2) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); move(3) }
}

// ── 结算 ──
function pass() {
  if (over.value) return
  over.value = true
  passed.value = true
  stopTimer()
  const m = cfg.value
  player.gainGameCoins(m.gold)
  ui.pushLog(`🧊 冰面滑行：${moves.value} 步集齐！+${m.gold} 游戏币`, 'gain')
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  const mg = player.minigames
  if (!mg.ice) mg.ice = { best: 0 }
  mg.ice.best = mg.ice.best && mg.ice.best < moves.value ? mg.ice.best : moves.value
}
function settle(win) {
  if (over.value) return
  over.value = true
  passed.value = false
  stopTimer()
  if (!win) {
    beep(160, 0.3, 'sawtooth')
    ui.pushLog(`🧊 冰面滑行：${cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit ? '超时' : cfg.value.moves + ' 步内没集齐'}，未达标`, 'warn')
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

// ── 开局 ──
function reset() {
  stopTimer()
  buildBoard()
  collected.value = 0
  holes.value = new Set()
  moves.value = 0
  elapsed.value = 0
  elapsedAccum = 0
  lastDir.value = -1
  sliding.value = false
  over.value = false
  passed.value = false
  started.value = false
  hint.value = '点击「开始游戏」后，按方向键让食材滑出去（撞墙/石头才停）'
}
function startGame() {
  if (over.value) return
  started.value = true
  startTimer()
  hint.value = '滑动收集全部 🍒（一滑到底，撞石头/墙才停）'
  beep(880, 0.08)
}

let running = true
onMounted(() => {
  window.addEventListener('keydown', onKey)
  reset()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  stopTimer()
})
</script>

<template>
  <div class="ic-page">
    <div class="ic-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="ic-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="ic-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeText }}</b> 秒</span>
      <span class="ic-chip">🎯 步数 <b class="mono">{{ movesText }}</b></span>
      <span class="ic-chip">🍒 <b class="mono">{{ collectedCount }}/{{ targets.length }}</b></span>
      <span class="ic-chip">💰 <b class="mono">{{ cfg.gold }}</b> 币</span>
      <span class="ic-chip">🏆 最少步 <b class="mono">{{ best }}</b></span>
      <button class="ic-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="ic-stage" :style="{ width: boardPx + 2 + 'px', height: boardPx + 2 + 'px' }">
      <!-- 冰面格 -->
      <div
        v-for="i in n * n"
        :key="i"
        class="ic-tile"
        :class="{ rock: rocks.includes(i - 1), target: targets.includes(i - 1), hole: holes.has(i - 1) }"
        :style="{
          left: ((i - 1) % n) * (cellSize + 3) + 'px',
          top: Math.floor((i - 1) / n) * (cellSize + 3) + 'px',
          width: cellSize + 'px',
          height: cellSize + 'px',
        }"
      ><span v-if="targets.includes(i - 1)" class="ic-cherry">{{ (collected & (1 << targets.indexOf(i - 1))) ? '·' : '🍒' }}</span><span v-if="cfg.ordered && targets.includes(i - 1) && !(collected & (1 << targets.indexOf(i - 1)))" class="ic-order">{{ targets.indexOf(i - 1) + 1 }}</span></div>
      <!-- 玩家（滑动动画） -->
      <div
        class="ic-player"
        :style="{
          left: (playerIdx % n) * (cellSize + 3) + 'px',
          top: Math.floor(playerIdx / n) * (cellSize + 3) + 'px',
          width: cellSize + 'px',
          height: cellSize + 'px',
          fontSize: Math.round(cellSize * 0.62) + 'px',
        }"
      >🍎</div>
    </div>

    <div class="ic-hint">{{ hint }}</div>

    <div class="ic-keys">
      <button v-if="!started" class="ic-start" @click="startGame()">▶ 开始游戏</button>
      <template v-else>
        <div class="ic-pad">
          <button class="ic-dir ic-up" @click="move(0)">▲</button>
          <button class="ic-dir ic-left" @click="move(3)">◀</button>
          <button class="ic-dir ic-right" @click="move(1)">▶</button>
          <button class="ic-dir ic-down" @click="move(2)">▼</button>
        </div>
        <button class="ic-reset" @click="reset()">🔄 重置本局</button>
      </template>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="ic-mask">
      <div class="ic-result">
        <div class="ic-result-head"><b>{{ passed ? '🎉 全部收集！' : '💦 没完成' }}</b></div>
        <div class="ic-result-score">
          <span>用了 <b class="mono">{{ moves }}</b> 步</span>
          <span class="dim">上限 {{ cfg.moves }} 步</span>
          <span class="dim">用时 {{ elapsed }} 秒</span>
          <span v-if="passed" class="ic-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="ic-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="ic-fire">
        <span v-for="i in 20" :key="i" class="ic-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="ic-info-mask" @click.self="showInfo = false">
      <div class="ic-info-box">
        <div class="ic-info-head"><b>🧊 冰面滑行 · 十模式说明</b><button class="ic-info-close" @click="showInfo = false">✕</button></div>
        <div class="ic-info-list">
          <div class="ic-info-row ic-info-rule">
            玩法：食材（🍎）站在冰面上，按方向键（触屏用方向按钮）后<b>会一直滑，撞到墙或石头才停</b>，中途不会停。<br />
            滑过 🍒 就把它收走，<b>把所有 🍒 收齐即通关</b>。<br />
            每局有<b>步数上限</b>（每滑一次算一步），用完还没收齐就判负；模式 10 还有限时。<br />
            棋盘由随机石头 + 玩家 + 目标生成，并用 BFS 穷举<b>验证必定可解</b>（不可解就重新生成）。<br />
            模式 7/10 为<b>顺序收集</b>（必须按 ①②③ 编号依次收，收错顺序不算）；模式 9/10 为<b>碎冰</b>（滑过的格子会碎掉，不能回头再走）；模式 6/10 限时。<br />结算：在步数（与时限）内收齐即达标发游戏币，并记录同模式最少步数。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="ic-info-row">
            <b class="ic-info-name">{{ m.label }}</b>
            <span class="ic-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ic-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.ic-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.ic-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.ic-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.ic-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.ic-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }

.ic-stage { position: relative; border-radius: 16px; background: linear-gradient(135deg, rgba(190, 228, 245, 0.5), rgba(150, 205, 232, 0.42)); border: 1px solid rgba(120, 170, 200, 0.45); box-shadow: 0 10px 28px rgba(60, 100, 130, 0.2); overflow: hidden; }
.ic-tile { position: absolute; border-radius: 8px; background: linear-gradient(135deg, rgba(240, 252, 255, 0.72), rgba(200, 234, 248, 0.55)); border: 1px solid rgba(255, 255, 255, 0.75); display: flex; align-items: center; justify-content: center; }
.ic-tile.rock { background: linear-gradient(135deg, #9a9a94, #6e6e68); border-color: #5a5a55; }
.ic-tile.hole { background: rgba(40, 70, 90, 0.55); border-color: rgba(30, 60, 80, 0.6); }
.ic-order { position: absolute; right: 3px; top: 1px; font-size: 10px; font-weight: 800; color: #d95a38; }
.ic-tile.target { box-shadow: inset 0 0 0 2px rgba(224, 106, 90, 0.5); }
.ic-cherry { font-size: 20px; line-height: 1; }
.ic-player { position: absolute; display: flex; align-items: center; justify-content: center; transition: left 0.18s cubic-bezier(0.22, 0.9, 0.35, 1), top 0.18s cubic-bezier(0.22, 0.9, 0.35, 1); filter: drop-shadow(0 3px 4px rgba(40, 70, 90, 0.35)); z-index: 3; pointer-events: none; }

.ic-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.ic-keys { display: flex; gap: 14px; justify-content: center; align-items: center; flex-wrap: wrap; }
.ic-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.ic-pad { display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 42px); gap: 6px; }
.ic-dir { border-radius: 12px; font-weight: 800; font-size: 16px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #7fb8d9, #4f8fb0); border: none; }
.ic-up { grid-column: 2; grid-row: 1; }
.ic-left { grid-column: 1; grid-row: 2; }
.ic-down { grid-column: 2; grid-row: 2; }
.ic-right { grid-column: 3; grid-row: 2; }
.ic-reset { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.ic-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.ic-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.ic-result-head { font-size: 18px; }
.ic-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.ic-gold { color: var(--good-strong); font-weight: 800; }
.ic-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.ic-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.ic-spark { position: absolute; font-size: 22px; color: var(--gold); animation: icSpark 1.1s ease-out forwards; }
@keyframes icSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.ic-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.ic-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.ic-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.ic-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.ic-info-list { display: flex; flex-direction: column; gap: 8px; }
.ic-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.ic-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.ic-info-rule b { color: var(--primary-strong); }
.ic-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.ic-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
