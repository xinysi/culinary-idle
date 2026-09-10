<script setup>
// 调味表（2026-09-10 新增，第 26 款）：数独——4×4 / 6×6 / 9×9，填满且合法即通关
// 十模式：棋盘 4×4~9×9 × 提示数 × 限时 × 限错
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, n: 4, keep: 10, lives: 3, target: 850, gold: 45, desc: '40 秒 · 目标 850 分 · 4×4 小盘，留 10 个提示数 · +45 币' },
  m2: { label: '模式2', dur: 45, n: 4, keep: 8, lives: 3, target: 850, gold: 55, desc: '45 秒 · 目标 850 分 · 4×4，提示更少 · +55 币' },
  m3: { label: '模式3', dur: 50, n: 4, keep: 6, lives: 2, target: 875, gold: 60, desc: '50 秒 · 目标 875 分 · 4×4 高难 + 2 条命 · +60 币' },
  m4: { label: '模式4', dur: 55, n: 6, keep: 16, lives: 3, target: 825, gold: 70, desc: '55 秒 · 目标 825 分 · **6×6 中盘** · +70 币' },
  m5: { label: '模式5', dur: 60, n: 6, keep: 14, lives: 3, target: 800, gold: 80, desc: '60 秒 · 目标 800 分 · 6×6，提示更少 · +80 币' },
  m6: { label: '模式6', dur: 65, n: 6, keep: 12, lives: 2, target: 825, gold: 90, desc: '65 秒 · 目标 825 分 · 6×6 高难 + 2 条命 · +90 币' },
  m7: { label: '模式7', dur: 70, n: 9, keep: 34, lives: 3, target: 875, gold: 100, desc: '70 秒 · 目标 875 分 · **9×9 大盘**，留 34 个提示数 · +100 币' },
  m8: { label: '模式8', dur: 80, n: 9, keep: 30, lives: 3, target: 950, gold: 120, desc: '80 秒 · 目标 950 分 · 9×9，提示减少 · +120 币' },
  m9: { label: '模式9', dur: 90, n: 9, keep: 26, lives: 2, target: 1100, gold: 140, desc: '90 秒 · 目标 1100 分 · 9×9 高难 + 2 条命 · +140 币' },
  m10: { label: '模式10', dur: 100, n: 9, keep: 22, lives: 1, target: 1340, gold: 160, desc: '100 秒 · 目标 1340 分 · 9×9 极难 + **只有 1 条命** · +160 币' },
}
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const solvedCount = ref(0)
const lives = ref(3)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.sudoku?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const grid = ref([]) // 当前盘面（0 = 空）
const given = ref([]) // 是否为初始提示
const wrong = ref([]) // 标红
const sel = ref(-1)
const msg = ref('')
let solution = []
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false

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

// ── 数独生成（回溯 + 随机）──
function boxDims(n) { return n === 4 ? [2, 2] : n === 6 ? [2, 3] : [3, 3] }
function legal(g, n, i, v) {
  const [br, bc] = boxDims(n)
  const r = Math.floor(i / n), c = i % n
  for (let k = 0; k < n; k++) {
    if (g[r * n + k] === v || g[k * n + c] === v) return false
  }
  const r0 = Math.floor(r / br) * br, c0 = Math.floor(c / bc) * bc
  for (let dr = 0; dr < br; dr++) for (let dc = 0; dc < bc; dc++) {
    if (g[(r0 + dr) * n + c0 + dc] === v) return false
  }
  return true
}
function fill(g, n, pos) {
  if (pos === n * n) return true
  if (g[pos] !== 0) return fill(g, n, pos + 1)
  const vals = Array.from({ length: n }, (_, k) => k + 1).sort(() => Math.random() - 0.5)
  for (const v of vals) {
    if (legal(g, n, pos, v)) {
      g[pos] = v
      if (fill(g, n, pos + 1)) return true
      g[pos] = 0
    }
  }
  return false
}
function countSolutions(g, n, pos, cap) {
  if (pos === n * n) return 1
  if (g[pos] !== 0) return countSolutions(g, n, pos + 1, cap)
  let total = 0
  for (let v = 1; v <= n; v++) {
    if (legal(g, n, pos, v)) {
      g[pos] = v
      total += countSolutions(g, n, pos + 1, cap - total)
      g[pos] = 0
      if (total >= cap) return total
    }
  }
  return total
}
function makePuzzle(n, keep) {
  const g = new Array(n * n).fill(0)
  fill(g, n, 0)
  const sol = g.slice()
  const idxs = Array.from({ length: n * n }, (_, i) => i).sort(() => Math.random() - 0.5)
  let filled = n * n
  for (const i of idxs) {
    if (filled <= keep) break
    const bak = g[i]
    g[i] = 0
    if (countSolutions(g.slice(), n, 0, 2) !== 1) g[i] = bak
    else filled--
  }
  return { puzzle: g, sol }
}
function newPuzzle() {
  const m = cfg.value
  const { puzzle, sol } = makePuzzle(m.n, m.keep)
  solution = sol
  grid.value = puzzle
  given.value = puzzle.map((v) => v !== 0)
  wrong.value = puzzle.map(() => false)
  sel.value = -1
  msg.value = ''
}
function buildBoard() {
  score.value = 0
  solvedCount.value = 0
  lives.value = cfg.value.lives
  timeLeft.value = cfg.value.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  newPuzzle()
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
  startLoop()
}
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  if (started.value && !overFlag) {
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) settle() }
  }
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function tap(i) {
  if (!started.value || overFlag) return
  if (given.value[i]) return
  sel.value = i
}
function put(v) {
  if (!started.value || overFlag || sel.value < 0) return
  const i = sel.value
  if (given.value[i]) return
  const m = cfg.value
  const g = grid.value.slice()
  if (v === 0) { g[i] = 0; wrong.value[i] = false; grid.value = g; return }
  if (v !== solution[i]) {
    // 填错：扣命
    g[i] = v
    wrong.value[i] = true
    grid.value = g
    lives.value--
    beep(180, 0.2, 'sawtooth', 0.07)
    msg.value = '✗ 填错了 -1 ❤'
    if (lives.value <= 0) settle()
    return
  }
  g[i] = v
  wrong.value[i] = false
  grid.value = g
  score.value += 50
  msg.value = '+50'
  beep(760, 0.05, 'triangle', 0.05)
  if (grid.value.every((x) => x !== 0)) {
    const bonus = 200 + lives.value * 20
    score.value += bonus
    solvedCount.value++
    msg.value = `🎉 完成 +${bonus}`
    beep(1046, 0.1); setTimeout(() => beep(1568, 0.14), 100)
    setTimeout(() => { if (!overFlag) newPuzzle() }, 500)
  }
}

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
    ui.pushLog(`🔢 调味表：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🔢 调味表：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.sudoku) mg.sudoku = { best: 0 }
  mg.sudoku.best = Math.max(mg.sudoku.best ?? 0, score.value)
}

onMounted(() => { buildBoard(); startLoop() })
onUnmounted(() => stopLoop())
</script>

<template>
  <div class="su-page">
    <div class="su-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="su-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="su-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="su-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="su-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="su-chip">✅ 完成 <b class="mono">{{ solvedCount }}</b></span>
      <span class="su-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="su-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="su-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="su-stage">
      <div class="su-board" :style="{ gridTemplateColumns: `repeat(${cfg.n}, 1fr)` }">
        <button
          v-for="(v, i) in grid"
          :key="i"
          class="su-cell"
          :class="{ given: given[i], sel: sel === i, wrong: wrong[i] }"
          @click="tap(i)"
        >{{ v || '' }}</button>
      </div>
      <div class="su-msg">{{ msg }}</div>
      <div class="su-pad">
        <button v-for="v in cfg.n" :key="v" class="su-num" @click="put(v)">{{ v }}</button>
        <button class="su-num su-clear" @click="put(0)">✕</button>
      </div>
    </div>

    <div class="su-keys">
      <button v-if="!started" class="su-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="su-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <div v-if="over" class="su-mask">
      <div class="su-result">
        <div class="su-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="su-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>完成 <b class="mono">{{ solvedCount }}</b> 盘</span>
          <span v-if="passed" class="su-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="su-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="su-fire">
        <span v-for="i in 20" :key="i" class="su-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="su-info-mask" @click.self="showInfo = false">
      <div class="su-info-box">
        <div class="su-info-head"><b>🔢 调味表 · 十模式说明</b><button class="su-info-close" @click="showInfo = false">✕</button></div>
        <div class="su-info-list">
          <div class="su-info-row su-info-rule">通用规则：经典数独——每行、每列、每个粗线宫内的数字都不能重复 · <b>点空格子选中</b>，再点下方数字填入（✕ 清空）· 填错扣 1 条命（格子标红），命耗尽立即结束 · 每填对一格 +50 分，填满整盘额外 +200 分（按剩余命数加成）并自动换下一盘 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="su-info-row">
            <b class="su-info-name">{{ m.label }}</b>
            <span class="su-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.su-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.su-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.su-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.su-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.su-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.su-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.su-stage { width: min(720px, 98%); border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.su-board { display: grid; gap: 4px; width: min(430px, 88%); }
.su-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 20px; font-weight: 800; cursor: pointer; background: rgba(255, 252, 246, 0.92); border: 1px solid rgba(150, 110, 70, 0.35); color: var(--primary-strong); }
.su-cell.given { background: rgba(150, 110, 70, 0.2); color: var(--muted); cursor: default; }
.su-cell.sel { border-color: var(--primary-strong); box-shadow: 0 0 0 2px rgba(217, 90, 56, 0.35); }
.su-cell.wrong { background: rgba(224, 106, 90, 0.35); color: var(--bad-strong); }
.su-msg { min-height: 20px; font-size: 14px; font-weight: 800; color: var(--good-strong); }
.su-pad { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.su-num { width: 48px; height: 48px; border-radius: 12px; font-size: 18px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.su-clear { background: linear-gradient(135deg, #a8927c, #7d6a58); }
.su-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.su-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.su-reset { padding: 10px 24px; height: 46px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.su-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.su-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.su-result-head { font-size: 18px; }
.su-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.su-gold { color: var(--good-strong); font-weight: 800; }
.su-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.su-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.su-spark { position: absolute; font-size: 22px; color: var(--gold); animation: suSpark 1.1s ease-out forwards; }
@keyframes suSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.su-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.su-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.su-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.su-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.su-info-list { display: flex; flex-direction: column; gap: 8px; }
.su-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.su-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.su-info-rule b { color: var(--primary-strong); }
.su-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.su-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
