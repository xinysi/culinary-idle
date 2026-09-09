<script setup>
// 管道接汤（2026-09-09 新增，第 20 款；同日扩展玩法）：旋转管道把汤汁从锅连到碗
// 点击管道转 90° · 从锅出发 BFS 连通到碗即通关 · 连通后汤汁沿管道流动
// 十模式花样：4×4/5×5/6×6 × 步数收紧 × 单向阀（只能顺向流） × 双锅双碗（两对都要接通） × 限时
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

// 方向：0 上 / 1 右 / 2 下 / 3 左
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const ICONS = { 0: '🍲', 1: '🍚', 2: '🥘', 3: '🥣' }

// ── 十模式 ──
const MODES = {
  m1: { label: '模式1', n: 4, moves: 20, valves: 0, dual: false, gold: 30, desc: '4×4 · 20 步内接通 · +30 币' },
  m2: { label: '模式2', n: 4, moves: 16, valves: 0, dual: false, gold: 30, desc: '4×4 · 16 步内接通 · +30 币' },
  m3: { label: '模式3', n: 4, moves: 22, valves: 1, dual: false, gold: 40, desc: '4×4 · **单向阀**（汤汁只能顺着箭头流）· 22 步 · +40 币' },
  m4: { label: '模式4', n: 5, moves: 30, valves: 0, dual: false, gold: 45, desc: '5×5 · 30 步内接通 · +45 币' },
  m5: { label: '模式5', n: 5, moves: 34, valves: 2, dual: false, gold: 55, desc: '5×5 · 2 个单向阀 · 34 步 · +55 币' },
  m6: { label: '模式6', n: 5, moves: 44, valves: 0, dual: true, gold: 80, desc: '5×5 · **双锅双碗**（🍲🍚 橙对 + 🥘🥣 绿对，同对同色）· 44 步 · +80 币' },
  m7: { label: '模式7', n: 6, moves: 42, valves: 0, dual: false, gold: 80, desc: '6×6 · 42 步内接通 · +80 币' },
  m8: { label: '模式8', n: 6, moves: 46, valves: 3, dual: false, gold: 80, desc: '6×6 · 3 个单向阀 · 46 步 · +80 币' },
  m9: { label: '模式9', n: 6, moves: 60, valves: 0, dual: true, gold: 110, desc: '6×6 · 双锅双碗（两对颜色不同）· 60 步 · +110 币' },
  m10: { label: '模式10', n: 6, moves: 60, valves: 2, dual: true, timeLimit: 180, gold: 140, desc: '6×6 · 双锅双碗 + 2 个单向阀 · 60 步 + 限时 180 秒 · +140 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const cells = ref([])
const pairs = ref([]) // [{ src, sink }]
const moves = ref(0)
const elapsed = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const flowSet = ref(new Set())
const flowOrder = ref(new Map())
const best = computed(() => player.minigames?.pipe?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const movesText = computed(() => `${moves.value}/${cfg.value.moves}`)
const timeText = computed(() => (cfg.value.timeLimit ? `${elapsed.value}/${cfg.value.timeLimit}` : `${elapsed.value}`))
const cellSize = computed(() => (cfg.value.n === 4 ? 96 : cfg.value.n === 5 ? 78 : 66))
const boardPx = computed(() => cfg.value.n * cellSize.value + (cfg.value.n - 1) * 8)

let timerId = null
let elapsedAccum = 0
let lastTs = 0

// ── 工具 ──
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
function dirBetween(a, b, n) {
  const ra = Math.floor(a / n)
  const ca = a % n
  const rb = Math.floor(b / n)
  const cb = b % n
  if (rb === ra - 1) return 0
  if (cb === ca + 1) return 1
  if (rb === ra + 1) return 2
  if (cb === ca - 1) return 3
  return -1
}
function neighborInDir(i, d, n) {
  const r = Math.floor(i / n) + DIRS[d][1]
  const c = (i % n) + DIRS[d][0]
  if (r < 0 || c < 0 || r >= n || c >= n) return -1
  return r * n + c
}
// 随机自避路径（from → to，避开 blocked）
function genPath(n, from, to, blocked) {
  const visited = new Set([from])
  const path = [from]
  const dfs = (i) => {
    if (i === to) return true
    const cand = neighbors(i, n).filter((j) => !visited.has(j) && !blocked.has(j))
    cand.sort(() => Math.random() - 0.5)
    for (const j of cand) {
      visited.add(j)
      path.push(j)
      if (dfs(j)) return true
      visited.delete(j)
      path.pop()
    }
    return false
  }
  dfs(from)
  return path
}

function regionsExcept(n, blocked) {
  const seen = new Set(blocked)
  const regions = []
  for (let i = 0; i < n * n; i++) {
    if (seen.has(i)) continue
    const reg = []
    const q = [i]
    seen.add(i)
    while (q.length) {
      const cur = q.shift()
      reg.push(cur)
      for (const j of neighbors(cur, n)) if (!seen.has(j)) { seen.add(j); q.push(j) }
    }
    regions.push(reg)
  }
  return regions
}
// 区域内距 start 最远的格子
function farthestIn(n, cellSet, start) {
  const seen = new Set([start])
  const q = [[start, 0]]
  let best = start
  let bd = 0
  while (q.length) {
    const [cur, d] = q.shift()
    if (d > bd) { bd = d; best = cur }
    for (const j of neighbors(cur, n)) {
      if (seen.has(j) || !cellSet.has(j)) continue
      seen.add(j)
      q.push([j, d + 1])
    }
  }
  return best
}

// ── 生成 ──
function buildBoard() {
  const n = cfg.value.n
  const total = n * n
  let paths = []
  let pairList = []
  // 双对模式：A、B 两条路径都要生成成功，失败就换一条 A 重来（最多 60 次）
  for (let attempt = 0; attempt < 60; attempt++) {
    const pathA = genPath(n, 0, total - 1, new Set())
    if (pathA.length < 2) continue
    if (!cfg.value.dual) {
      paths = [pathA]
      pairList = [{ src: 0, sink: total - 1 }]
      break
    }
    const regs = regionsExcept(n, new Set(pathA)).sort((a, b) => b.length - a.length)
    const reg = new Set(regs[0] || [])
    if (reg.size < 4) continue
    const seed = [...reg][Math.floor(Math.random() * reg.size)]
    const e1 = farthestIn(n, reg, seed)
    const e2 = farthestIn(n, reg, e1)
    if (e1 === e2) continue
    const pathB = genPath(n, e1, e2, new Set(pathA))
    if (pathB.length > 1) {
      paths = [pathA, pathB]
      pairList = [{ src: 0, sink: total - 1 }, { src: e1, sink: e2 }]
      break
    }
  }
  if (!paths.length) {
    // 兜底：单对
    const pathA = genPath(n, 0, total - 1, new Set())
    paths = [pathA]
    pairList = [{ src: 0, sink: total - 1 }]
  }
  pairs.value = pairList
  // 路径格 → 该格的正确接口 / 单向阀方向
  const armsOf = new Map()
  const valveOf = new Map()
  for (const path of paths) {
    for (let k = 0; k < path.length; k++) {
      const idx = path[k]
      const arms = []
      if (k > 0) arms.push(dirBetween(idx, path[k - 1], n))
      if (k < path.length - 1) arms.push(dirBetween(idx, path[k + 1], n))
      armsOf.set(idx, arms)
      // 单向阀：记录「从本格流向下一格」的方向
      if (k < path.length - 1) valveOf.set(idx, dirBetween(idx, path[k + 1], n))
    }
  }
  // 抽若干路径格（非锅碗）作为单向阀
  const valveCand = []
  for (const path of paths) {
    for (let k = 1; k < path.length - 1; k++) {
      const idx = path[k]
      if (armsOf.get(idx)?.length === 2 && Math.abs(armsOf.get(idx)[0] - armsOf.get(idx)[1]) === 2) valveCand.push(idx)
    }
  }
  valveCand.sort(() => Math.random() - 0.5)
  const valveSet = new Set(valveCand.slice(0, cfg.value.valves))
  // 组装
  const list = new Array(total)
  for (let i = 0; i < total; i++) {
    let arms
    if (armsOf.has(i)) {
      arms = valveSet.has(i) ? [valveOf.get(i), (valveOf.get(i) + 2) % 4] : armsOf.get(i)
    } else {
      // 干扰件：多为单头/直管
      const roll = Math.random()
      if (roll < 0.6) arms = [Math.floor(Math.random() * 4)]
      else if (roll < 0.85) arms = [0, 2]
      else arms = [0, 1]
    }
    const cell = { arms, rot: Math.floor(Math.random() * 4) }
    if (valveSet.has(i)) cell.valve = valveOf.get(i)
    const pIdx = paths.findIndex((path) => path.includes(i))
    if (pIdx >= 0) cell.pair = pIdx
    const roleIdx = pairList.findIndex((p) => p.src === i || p.sink === i)
    if (roleIdx >= 0) {
      cell.pair = roleIdx
      cell.role = pairList[roleIdx].src === i ? 'src' : 'sink'
      // 锅碗的「正确朝向」= arms（已由路径决定）
    }
    list[i] = cell
  }
  return list
}

// ── 当前朝向的接口 ──
function curArms(cell) {
  return cell.arms.map((a) => (a + cell.rot) % 4)
}
// 从某个源出发的连通（单向阀只允许沿阀向离开）
function bfsFrom(src, n) {
  const list = cells.value
  const seen = new Map([[src, 0]])
  const q = [src]
  while (q.length) {
    const i = q.shift()
    const cell = list[i]
    const outs = cell.valve != null ? [cell.valve] : curArms(cell)
    for (const d of outs) {
      const j = neighborInDir(i, d, n)
      if (j < 0 || seen.has(j)) continue
      const opp = (d + 2) % 4
      if (!curArms(list[j]).includes(opp)) continue
      seen.set(j, seen.get(i) + 1)
      q.push(j)
    }
  }
  return seen
}

// ── 交互 ──
function rotate(i) {
  if (!started.value || over.value) return
  const list = cells.value.slice()
  list[i] = { ...list[i], rot: (list[i].rot + 1) % 4 }
  cells.value = list
  moves.value++
  beep(520 + (moves.value % 4) * 70, 0.04, 'triangle', 0.05)
  // 检查所有对是否都接通
  const n = cfg.value.n
  const orders = []
  const pathSets = []
  let allOk = true
  for (const p of pairs.value) {
    const seen = bfsFrom(p.src, n)
    if (!seen.has(p.sink)) { allOk = false; break }
    // 回溯出最短路
    const set = new Set()
    let cur = p.sink
    while (cur !== p.src) {
      set.add(cur)
      let prev = -1
      for (const d of curArms(list[cur])) {
        const j = neighborInDir(cur, d, n)
        if (j >= 0 && seen.has(j) && seen.get(j) === seen.get(cur) - 1) { prev = j; break }
      }
      if (prev < 0) break
      cur = prev
    }
    set.add(p.src)
    orders.push(seen)
    pathSets.push(set)
  }
  if (allOk) {
    const merged = new Map()
    const mergedSet = new Set()
    for (const set of pathSets) for (const idx of set) mergedSet.add(idx)
    for (const o of orders) for (const [idx, v] of o) merged.set(idx, Math.min(merged.get(idx) ?? 99, v))
    flowOrder.value = merged
    flowSet.value = mergedSet
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
}
function startGame() {
  if (over.value) return
  started.value = true
  startTimer()
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
        :class="{ src: cell.role === 'src', sink: cell.role === 'sink', flow: flowSet.has(i), valve: cell.valve != null, 'pp-p0': cell.pair === 0, 'pp-p1': cell.pair === 1 }"
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
          <span v-if="cell.role" class="pp-icon">{{ ICONS[(cell.pair || 0) * 2 + (cell.role === 'sink' ? 1 : 0)] }}</span>
          <span v-else-if="cell.valve != null" class="pp-valve-arrow" :style="{ transform: `rotate(${cell.valve * 90}deg)` }">➤</span>
        </div>
      </div>
    </div>

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
            玩法：<b>点击任意管道让它旋转 90°</b>，把锅（🍲）和碗（🍚）用管道连通。<br />
            管道分直管、弯管、三通等形状；只有<b>两端接口都对准</b>才算连通，汤汁会从锅沿管道一路流到碗。<br />
            <b>单向阀</b>（管道中心带 ➤ 箭头）：汤汁只能顺着箭头方向流过，逆向接不通，需要把阀门转对方向。<br />
            <b>双锅双碗</b>（🍲🍚 一对橙色、🥘🥣 一对绿色）：两对都要接通才算过关——<b>同一对的锅和碗同色</b>，按颜色配对即可。<br />
            每局有<b>步数上限</b>（每转一次算一步），用完还没接通就判负；模式 10 还有限时。<br />
            开局由「随机合法路径 + 干扰管件」生成，<b>保证一定可解</b>；接通即达标发游戏币，并记录同模式最少步数。
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
.pp-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.pp-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.pp-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.pp-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}

.pp-stage { position: relative; border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.pp-cell { position: absolute; border-radius: 10px; background: rgba(255, 252, 246, 0.92); border: 1px solid rgba(150, 110, 70, 0.3); cursor: pointer; transition: box-shadow 0.12s; }
.pp-cell:hover { box-shadow: 0 0 0 2px rgba(217, 90, 56, 0.35); }
/* 按「对」配色：同一对的锅和碗同色，两对颜色不同（方便分辨谁连谁） */
.pp-cell.pp-p0 { --pair-bg: rgba(255, 236, 208, 0.96); --pair-border: rgba(217, 90, 56, 0.65); --pair-flow-bg: rgba(244, 176, 96, 0.95); --pair-pipe: #d98a3a; }
.pp-cell.pp-p1 { --pair-bg: rgba(222, 246, 224, 0.96); --pair-border: rgba(76, 158, 68, 0.65); --pair-flow-bg: rgba(150, 214, 130, 0.95); --pair-pipe: #5fa348; }
.pp-cell.src, .pp-cell.sink { background: var(--pair-bg, rgba(255, 252, 246, 0.92)); border-color: var(--pair-border, rgba(150, 110, 70, 0.3)); border-width: 2px; }
.pp-cell.valve .pp-hub { background: #8f7a62; }
.pp-valve-arrow { color: #ffd65a; font-size: 14px; line-height: 1; }
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
  40% { background: var(--pair-flow-bg, rgba(240, 190, 110, 0.95)); box-shadow: 0 0 14px var(--pair-border, rgba(224, 161, 58, 0.7)); }
  100% { background: var(--pair-flow-bg, rgba(240, 190, 110, 0.95)); box-shadow: 0 0 0 rgba(224, 161, 58, 0); }
}
.pp-cell.flow .pp-arm, .pp-cell.flow .pp-hub { animation: ppPipe 0.9s ease forwards; animation-delay: var(--flow-delay); }
@keyframes ppPipe { 0% { background: #b9a08a; } 40% { background: var(--pair-pipe, #e8a24a); } 100% { background: var(--pair-pipe, #d98a3a); } }
.pp-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.pp-start {
  padding: 12px 34px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, #e8703f, #c9542e);
  border: none;
  box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35);
}
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
.pp-info-box {
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
.pp-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.pp-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.pp-info-list { display: flex; flex-direction: column; gap: 8px; }
.pp-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.pp-info-rule {
  display: block;
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.7;
}
.pp-info-rule b { color: var(--primary-strong); }
.pp-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.pp-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}
</style>
