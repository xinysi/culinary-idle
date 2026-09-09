<script setup>
// 扫雷（2026-09-09 新增，第 23 款）：挖矿找烂食材——纯推理玩法
// 点开格子：数字表示周围 8 格的烂食材数 · 🚩 标记模式可插旗 · 踩到烂食材扣 1 命（共 3 命）
// 开完全部安全格即通关 · 十模式：6×6~16×16 × 雷数 × 限时
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 十模式 ──
const MODES = {
  m1: { label: '模式1', n: 6, mines: 5, timeLimit: 0, gold: 20, desc: '6×6 · 5 个烂食材 · 3 条命 · +20 币' },
  m2: { label: '模式2', n: 8, mines: 10, timeLimit: 0, gold: 40, desc: '8×8 · 10 个烂食材 · +40 币' },
  m3: { label: '模式3', n: 10, mines: 18, timeLimit: 0, gold: 55, desc: '10×10 · 18 个烂食材 · +55 币' },
  m4: { label: '模式4', n: 10, mines: 18, timeLimit: 120, gold: 55, desc: '10×10 · 18 个烂食材 · **限时 120 秒** · +55 币' },
  m5: { label: '模式5', n: 12, mines: 26, timeLimit: 0, gold: 85, desc: '12×12 · 26 个烂食材 · +85 币' },
  m6: { label: '模式6', n: 12, mines: 26, timeLimit: 0, lives: 1, gold: 115, desc: '12×12 · 26 个烂食材 · **只有 1 条命**（一踩即负）· +115 币' },
  m7: { label: '模式7', n: 12, mines: 26, timeLimit: 0, cluster: true, gold: 115, desc: '12×12 · 26 个烂食材 · **簇状雷区**（成堆聚集，更难拆）· +115 币' },
  m8: { label: '模式8', n: 14, mines: 36, timeLimit: 0, gold: 140, desc: '14×14 · 36 个烂食材 · +140 币' },
  m9: { label: '模式9', n: 16, mines: 40, timeLimit: 0, lives: 1, gold: 205, desc: '16×16 · 40 个烂食材 · **只有 1 条命** · +205 币' },
  m10: { label: '模式10', n: 16, mines: 40, timeLimit: 240, lives: 1, cluster: true, gold: 205, desc: '16×16 · 40 个烂食材 · **簇状 + 1 命 + 限时 240 秒** · +205 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const cells = ref([]) // { mine, near, open, flag }
const lives = ref(3)
const elapsed = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const flagMode = ref(false)
const best = computed(() => player.minigames?.mines?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const cellSize = computed(() => {
  const n = cfg.value.n
  if (n <= 8) return 42
  if (n <= 10) return 36
  if (n <= 12) return 32
  return 28
})
const boardPx = computed(() => cfg.value.n * cellSize.value + (cfg.value.n - 1) * 3)
const timeText = computed(() => (cfg.value.timeLimit ? `${elapsed.value}/${cfg.value.timeLimit}` : `${elapsed.value}`))
const minesLeft = computed(() => cfg.value.mines - cells.value.filter((c) => c.flag).length)

let timerId = null
let elapsedAccum = 0
let lastTs = 0
let firstClick = true

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

// ── 棋盘生成 ──
function idxOf(r, c) { return r * cfg.value.n + c }
function neighborsOf(i) {
  const n = cfg.value.n
  const r = Math.floor(i / n)
  const c = i % n
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue
      out.push(nr * n + nc)
    }
  }
  return out
}
function buildBoard() {
  const n = cfg.value.n
  const total = n * n
  const list = Array.from({ length: total }, () => ({ mine: false, near: 0, open: false, flag: false }))
  // 布雷：普通随机 / 簇状（2×2 成堆）
  if (cfg.value.cluster) {
    let placed = 0
    let guard = 0
    while (placed < cfg.value.mines && guard++ < 3000) {
      const r = Math.floor(Math.random() * (n - 1))
      const c = Math.floor(Math.random() * (n - 1))
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const i = (r + dr) * n + (c + dc)
          if (!list[i].mine && placed < cfg.value.mines) { list[i].mine = true; placed++ }
        }
      }
    }
  } else {
    const idxs = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5)
    for (let k = 0; k < cfg.value.mines; k++) list[idxs[k]].mine = true
  }
  // 计算周围数
  for (let i = 0; i < total; i++) {
    if (list[i].mine) continue
    list[i].near = neighborsOf(i).filter((j) => list[j].mine).length
  }
  return list
}
// 首点安全：若点到雷，把它与一个非雷格交换
function makeSafe(i) {
  const list = cells.value
  if (!list[i].mine) return
  const cand = list.map((c, k) => (c.mine ? -1 : k)).filter((k) => k >= 0 && k !== i)
  const j = cand[Math.floor(Math.random() * cand.length)]
  const ns = list.slice()
  ns[i] = { ...ns[i], mine: false }
  ns[j] = { ...ns[j], mine: true }
  // 重算周围数
  for (let k = 0; k < ns.length; k++) {
    ns[k] = { ...ns[k], near: ns[k].mine ? 0 : neighborsOf(k).filter((x) => ns[x].mine).length }
  }
  cells.value = ns
}

// ── 交互 ──
function tap(i) {
  if (!started.value || over.value) return
  const c = cells.value[i]
  if (!c || c.open) return
  if (flagMode.value) {
    const ns = cells.value.slice()
    ns[i] = { ...ns[i], flag: !ns[i].flag }
    cells.value = ns
    beep(520, 0.05, 'triangle', 0.05)
    return
  }
  if (c.flag) return
  if (firstClick) { firstClick = false; makeSafe(i) }
  if (cells.value[i].mine) {
    // 踩雷：扣命 + 自动插旗
    const ns = cells.value.slice()
    ns[i] = { ...ns[i], open: true, flag: true }
    cells.value = ns
    lives.value--
    beep(150, 0.3, 'sawtooth', 0.09)
    if (lives.value <= 0) { settle(false); return }
  } else {
    // 展开（0 格连锁）
    const ns = cells.value.slice()
    const stack = [i]
    let opened = 0
    while (stack.length) {
      const k = stack.pop()
      if (ns[k].open || ns[k].flag || ns[k].mine) continue
      ns[k] = { ...ns[k], open: true }
      opened++
      if (ns[k].near === 0) for (const j of neighborsOf(k)) if (!ns[j].open && !ns[j].flag) stack.push(j)
    }
    cells.value = ns
    beep(660 + Math.min(6, opened) * 40, 0.05, 'triangle', 0.05)
  }
  checkWin()
}
function checkWin() {
  const done = cells.value.every((c) => c.open || c.mine)
  if (done && !over.value) pass()
}

// ── 结算 ──
function pass() {
  if (over.value) return
  over.value = true
  passed.value = true
  stopTimer()
  const m = cfg.value
  player.gainGameCoins(m.gold)
  ui.pushLog(`💣 扫雷：${elapsed.value} 秒排雷成功！+${m.gold} 游戏币`, 'gain')
  beep(880, 0.12)
  setTimeout(() => beep(1175, 0.12), 110)
  setTimeout(() => beep(1568, 0.22), 230)
  const mg = player.minigames
  if (!mg.mines) mg.mines = { best: 0 }
  // 最佳 = 同模式最快用时（越小越好）
  mg.mines.best = mg.mines.best && mg.mines.best < elapsed.value ? mg.mines.best : elapsed.value
}
function settle(win) {
  if (over.value) return
  over.value = true
  passed.value = false
  stopTimer()
  if (!win) {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`💣 扫雷：${cfg.value.timeLimit && elapsedAccum >= cfg.value.timeLimit ? '超时' : '命耗尽'}，未达标`, 'warn')
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
  cells.value = buildBoard()
  lives.value = cfg.value.lives || 3
  elapsed.value = 0
  elapsedAccum = 0
  firstClick = true
  flagMode.value = false
  over.value = false
  passed.value = false
  started.value = false
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
  <div class="ms-page">
    <div class="ms-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="ms-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="ms-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeText }}</b> 秒</span>
      <span class="ms-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="ms-chip">🚩 <b class="mono">{{ minesLeft }}</b></span>
      <span class="ms-chip">💰 <b class="mono">{{ cfg.gold }}</b> 币</span>
      <span class="ms-chip">🏆 最快 <b class="mono">{{ best }}</b></span>
      <button class="ms-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="ms-stage" :style="{ width: boardPx + 'px', height: boardPx + 'px' }">
      <div
        v-for="(c, i) in cells"
        :key="i"
        class="ms-cell"
        :class="{ open: c.open, flag: c.flag, boom: c.open && c.mine, mine: c.mine && c.open, ['ms-n' + c.near]: c.open && !c.mine && c.near > 0 }"
        :style="{
          left: (i % cfg.n) * (cellSize + 3) + 'px',
          top: Math.floor(i / cfg.n) * (cellSize + 3) + 'px',
          width: cellSize + 'px',
          height: cellSize + 'px',
          fontSize: Math.round(cellSize * 0.52) + 'px',
        }"
        @click="tap(i)"
      >
        <template v-if="c.open && c.mine">🤢</template>
        <template v-else-if="c.open && c.near > 0">{{ c.near }}</template>
        <template v-else-if="c.flag">🚩</template>
      </div>
    </div>

    <div class="ms-keys">
      <button v-if="!started" class="ms-start" @click="startGame()">▶ 开始游戏</button>
      <template v-else>
        <button class="ms-flag" :class="{ on: flagMode }" @click="flagMode = !flagMode">🚩 标记{{ flagMode ? '（开）' : '（关）' }}</button>
        <button class="ms-reset" @click="reset()">🔄 重置本局</button>
      </template>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="ms-mask">
      <div class="ms-result">
        <div class="ms-result-head"><b>{{ passed ? '🎉 排雷成功！' : '💦 失败' }}</b></div>
        <div class="ms-result-score">
          <span>用时 <b class="mono">{{ elapsed }}</b> 秒</span>
          <span class="dim">{{ cfg.n }}×{{ cfg.n }} / {{ cfg.mines }} 雷</span>
          <span v-if="passed" class="ms-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="ms-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="ms-fire">
        <span v-for="i in 20" :key="i" class="ms-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="ms-info-mask" @click.self="showInfo = false">
      <div class="ms-info-box">
        <div class="ms-info-head"><b>💣 扫雷 · 十模式说明</b><button class="ms-info-close" @click="showInfo = false">✕</button></div>
        <div class="ms-info-list">
          <div class="ms-info-row ms-info-rule">
            玩法：点击格子挖开。<b>数字 = 该格周围 8 格里的烂食材（🤢）数量</b>，0 会自动连锁展开一片。<br />
            踩到烂食材扣 1 条命（共 3 条命，命耗尽判负），该格会自动插旗标记。<br />
            <b>🚩 标记模式</b>：打开后点格子是插旗/取消（标记你判断是烂食材的位置），再点一次关闭。<br />
            第一次点击一定安全（若点到烂食材会自动挪走）。<b>把所有安全格都挖开即通关</b>。<br />
            模式 4/10 有限时，超时判负；模式 6/9/10 <b>只有 1 条命</b>；模式 7/10 的烂食材是<b>簇状聚集</b>（成 2×2 堆），拆起来更难。通关发游戏币，并记录同模式最快用时。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="ms-info-row">
            <b class="ms-info-name">{{ m.label }}</b>
            <span class="ms-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ms-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.ms-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.ms-mode {
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  border: 1px dashed rgba(150, 110, 70, 0.4);
  background: rgba(255, 252, 246, 0.8);
  color: var(--muted);
}
.ms-mode.on {
  border-style: solid;
  border-color: var(--primary-strong);
  background: rgba(217, 90, 56, 0.14);
  color: var(--primary-strong);
}
.ms-chip {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
}
.ms-info-btn {
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #72b864, #589c4b);
  border: none;
}

.ms-stage { position: relative; border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); overflow: hidden; }
.ms-cell { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: linear-gradient(180deg, rgba(255, 252, 246, 0.98), rgba(236, 222, 200, 0.95)); border: 1px solid rgba(150, 110, 70, 0.4); box-shadow: 0 2px 3px rgba(93, 64, 55, 0.16); cursor: pointer; font-weight: 800; user-select: none; }
.ms-cell:hover { box-shadow: 0 0 0 2px rgba(217, 90, 56, 0.3); }
.ms-cell.open { background: rgba(255, 251, 244, 0.72); border-color: rgba(150, 110, 70, 0.22); box-shadow: none; cursor: default; }
.ms-cell.flag { background: linear-gradient(180deg, rgba(255, 240, 240, 0.98), rgba(240, 200, 200, 0.95)); }
.ms-cell.boom { background: rgba(224, 106, 90, 0.85); }
.ms-cell.mine { background: rgba(224, 106, 90, 0.55); }
.ms-n1 { color: #4f8fd9; }
.ms-n2 { color: #589c4b; }
.ms-n3 { color: #d95a38; }
.ms-n4 { color: #9a7ae0; }
.ms-n5 { color: #b8860b; }
.ms-n6 { color: #2f8f88; }
.ms-n7 { color: #8a4a2e; }
.ms-n8 { color: #6b4a2a; }
.ms-keys {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}
.ms-start {
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
.ms-flag { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; }
.ms-flag.on { background: linear-gradient(135deg, #e8703f, #c9542e); }
.ms-reset { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.ms-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.ms-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.ms-result-head { font-size: 18px; }
.ms-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.ms-gold { color: var(--good-strong); font-weight: 800; }
.ms-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.ms-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.ms-spark { position: absolute; font-size: 22px; color: var(--gold); animation: msSpark 1.1s ease-out forwards; }
@keyframes msSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.ms-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.ms-info-box {
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
.ms-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.ms-info-close {
  cursor: pointer;
  border: none;
  background: rgba(150, 110, 70, 0.15);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  font-weight: 700;
  color: var(--text);
}
.ms-info-list { display: flex; flex-direction: column; gap: 8px; }
.ms-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(255, 251, 244, 0.8);
  border: 1px solid rgba(150, 110, 70, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
}
.ms-info-rule {
  display: block;
  border-color: rgba(88, 156, 75, 0.35);
  background: rgba(114, 184, 100, 0.1);
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.7;
}
.ms-info-rule b { color: var(--primary-strong); }
.ms-info-name {
  flex: 0 0 82px;
  color: var(--primary-strong);
}
.ms-info-desc {
  flex: 1;
  font-size: 12.5px;
  color: var(--muted);
}
</style>
