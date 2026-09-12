<script setup>
// 上菜顺序（2026-09-10 新增，第 27 款）：看一遍上菜顺序，再按同样顺序点一遍；每轮加长
// 十模式：起始长度 3~5 × 每轮加长 +1/+2 × 亮灯速度 0.6~0.25 秒 × 限命 × 限时
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, start: 3, grow: 1, speed: 0.6, lives: 3, target: 385, gold: 45, desc: '40 秒 · 目标 385 分 · 从 3 步开始，亮灯慢，3 条命 · +45 币' },
  m2: { label: '模式2', dur: 45, start: 3, grow: 1, speed: 0.5, lives: 3, target: 420, gold: 55, desc: '45 秒 · 目标 420 分 · 亮灯加快 · +55 币' },
  m3: { label: '模式3', dur: 50, start: 4, grow: 1, speed: 0.45, lives: 3, target: 455, gold: 60, desc: '50 秒 · 目标 455 分 · **从 4 步开始** · +60 币' },
  m4: { label: '模式4', dur: 55, start: 4, grow: 1, speed: 0.4, lives: 2, target: 500, gold: 70, desc: '55 秒 · 目标 500 分 · 只有 2 条命 · +70 币' },
  m5: { label: '模式5', dur: 60, start: 4, grow: 2, speed: 0.38, lives: 3, target: 650, gold: 80, desc: '60 秒 · 目标 650 分 · **每轮加 2 步**，涨得快 · +80 币' },
  m6: { label: '模式6', dur: 65, start: 5, grow: 1, speed: 0.34, lives: 3, target: 700, gold: 90, desc: '65 秒 · 目标 700 分 · **从 5 步开始** · +90 币' },
  m7: { label: '模式7', dur: 70, start: 5, grow: 2, speed: 0.32, lives: 2, target: 750, gold: 100, desc: '70 秒 · 目标 750 分 · 加 2 步 + 2 条命 · +100 币' },
  m8: { label: '模式8', dur: 80, start: 5, grow: 2, speed: 0.3, lives: 2, target: 900, gold: 120, desc: '80 秒 · 目标 900 分 · 亮灯很快 · +120 币' },
  m9: { label: '模式9', dur: 90, start: 5, grow: 2, speed: 0.28, lives: 1, target: 1100, gold: 140, desc: '90 秒 · 目标 1100 分 · **只有 1 条命** · +140 币' },
  m10: { label: '模式10', dur: 100, start: 5, grow: 2, speed: 0.25, lives: 1, target: 1355, gold: 160, desc: '100 秒 · 目标 1355 分 · 1 条命 + 最快亮灯，记忆极限 · +160 币' },
}
const TILES = [
  { icon: '🍜', cls: 't0' }, { icon: '🍚', cls: 't1' }, { icon: '🥟', cls: 't2' },
  { icon: '🍤', cls: 't3' }, { icon: '🍢', cls: 't4' }, { icon: '🥮', cls: 't5' },
]
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const rounds = ref(0)
const lives = ref(3)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.serve?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const seq = ref([]) // 当前序列（索引数组）
const flash = ref(-1) // 正在亮的格子
const phase = ref('idle') // idle | show | input
const step = ref(0) // 输入到第几步
const msg = ref('')
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let timers = []
let showAt = 0
let showIdx = 0

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
function tone(i) { return 520 + i * 110 }

function clearTimers() { for (const t of timers) clearTimeout(t); timers = [] }

function startRound() {
  clearTimers()
  const m = cfg.value
  const grow = rounds.value === 0 ? 0 : m.grow
  const len = m.start + rounds.value * grow
  const next = []
  for (let i = 0; i < len; i++) next.push(Math.floor(Math.random() * TILES.length))
  seq.value = next
  phase.value = 'show'
  step.value = 0
  msg.value = `看好了…（${len} 步）`
  showIdx = 0
  showAt = performance.now() + 500
}
function tickShow(now) {
  if (phase.value !== 'show' || now < showAt) return
  const m = cfg.value
  if (showIdx < seq.value.length) {
    flash.value = seq.value[showIdx]
    beep(tone(seq.value[showIdx]), 0.08, 'triangle', 0.05)
    showAt = now + m.speed * 1000
    showIdx++
  } else {
    flash.value = -1
    phase.value = 'input'
    step.value = 0
    msg.value = '轮到你了！'
    showAt = now + 260
  }
}
function buildBoard() {
  clearTimers()
  score.value = 0
  rounds.value = 0
  lives.value = cfg.value.lives
  timeLeft.value = cfg.value.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  seq.value = []
  flash.value = -1
  phase.value = 'idle'
  msg.value = '点击「开始游戏」后，先看一遍上菜顺序'
}
function startGame() {
  if (started.value) return
  started.value = true
  lastTs = 0
  beep(880, 0.08)
  startRound()
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
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) { settle(); return } }
    tickShow(now)
  }
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function tap(i) {
  if (!started.value || overFlag || phase.value !== 'input') return
  if (i === seq.value[step.value]) {
    flash.value = i
    beep(tone(i), 0.06, 'triangle', 0.05)
    timers.push(setTimeout(() => { flash.value = -1 }, 140))
    score.value += 20
    step.value++
    if (step.value >= seq.value.length) {
      const bonus = 50 + seq.value.length * 10
      score.value += bonus
      rounds.value++
      msg.value = `✅ 完成 ${seq.value.length} 步 +${bonus}`
      phase.value = 'idle'
      beep(1046, 0.1); timers.push(setTimeout(() => beep(1568, 0.14), 100))
      timers.push(setTimeout(() => { if (!overFlag && started.value) startRound() }, 700))
    }
  } else {
    flash.value = i
    beep(180, 0.22, 'sawtooth', 0.08)
    timers.push(setTimeout(() => { flash.value = -1 }, 220))
    lives.value--
    msg.value = '✗ 点错了 -1 ❤'
    if (lives.value <= 0) { settle(); return }
    phase.value = 'idle'
    timers.push(setTimeout(() => { if (!overFlag && started.value) startRound() }, 800))
  }
}

function settle() {
  if (overFlag) return
  player.recordMinigame('serve', score.value, { lower: false, unit: '分' })
  overFlag = true
  over.value = true
  clearTimers()
  stopLoop()
  const m = cfg.value
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const gold = m.gold + Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    player.gainGameCoins(gold)
    ui.pushLog(`🍽️ 上菜顺序：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🍽️ 上菜顺序：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.serve) mg.serve = { best: 0 }
  mg.serve.best = Math.max(mg.serve.best ?? 0, score.value)
}

onMounted(() => { buildBoard(); startLoop() })
onUnmounted(() => { clearTimers(); stopLoop() })
</script>

<template>
  <div class="sv-page">
    <div class="sv-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="sv-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="sv-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="sv-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="sv-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="sv-chip">📋 轮次 <b class="mono">{{ rounds }}</b></span>
      <span class="sv-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="sv-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="sv-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="sv-stage">
      <div class="sv-msg">{{ msg }}</div>
      <div class="sv-grid">
        <button
          v-for="(t, i) in TILES"
          :key="i"
          class="sv-tile"
          :class="[t.cls, { on: flash === i }]"
          @click="tap(i)"
        >{{ t.icon }}</button>
      </div>
      <div class="sv-progress">
        <span v-for="(s, i) in seq" :key="i" class="sv-dot" :class="{ done: i < step }"></span>
      </div>
    </div>

    <div class="sv-keys">
      <button v-if="!started" class="sv-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="sv-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <div v-if="over" class="sv-mask">
      <div class="sv-result">
        <div class="sv-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="sv-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>完成 <b class="mono">{{ rounds }}</b> 轮</span>
          <span v-if="passed" class="sv-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="sv-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="sv-fire">
        <span v-for="i in 20" :key="i" class="sv-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="sv-info-mask" @click.self="showInfo = false">
      <div class="sv-info-box">
        <div class="sv-info-head"><b>🍽️ 上菜顺序 · 十模式说明</b><button class="sv-info-close" @click="showInfo = false">✕</button></div>
        <div class="sv-info-list">
          <div class="sv-info-row sv-info-rule">通用规则：先看系统<b>依次点亮</b>几个菜品格（顺序），亮完后<b>按同样顺序点一遍</b> · 每点对一步 +20 分，整轮通过额外 +50 分（并按步数加成），下一轮序列更长 · 点错扣 1 条命（共 3 条，模式 9/10 只有 1 条），命耗尽立即结束 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="sv-info-row">
            <b class="sv-info-name">{{ m.label }}</b>
            <span class="sv-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sv-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.sv-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.sv-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.sv-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.sv-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.sv-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.sv-stage { width: min(720px, 98%); border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); padding: 22px 16px 26px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.sv-msg { min-height: 22px; font-size: 15px; font-weight: 800; color: var(--primary-strong); }
.sv-grid { display: grid; grid-template-columns: repeat(3, 108px); gap: 14px; }
.sv-tile { width: 108px; height: 108px; border-radius: 18px; font-size: 44px; cursor: pointer; border: 2px solid rgba(150, 110, 70, 0.35); background: rgba(255, 252, 246, 0.85); transition: transform 0.08s, box-shadow 0.1s, filter 0.1s; }
.sv-tile:active { transform: scale(0.96); }
.sv-tile.on { transform: scale(1.06); box-shadow: 0 0 0 4px rgba(217, 90, 56, 0.45), 0 8px 20px rgba(184, 68, 42, 0.3); filter: brightness(1.12); }
.sv-tile.t0 { background: rgba(232, 112, 63, 0.22); }
.sv-tile.t1 { background: rgba(114, 184, 100, 0.22); }
.sv-tile.t2 { background: rgba(114, 160, 216, 0.22); }
.sv-tile.t3 { background: rgba(232, 195, 74, 0.22); }
.sv-tile.t4 { background: rgba(184, 130, 216, 0.22); }
.sv-tile.t5 { background: rgba(224, 106, 90, 0.22); }
.sv-progress { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; min-height: 12px; }
.sv-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(150, 110, 70, 0.3); }
.sv-dot.done { background: var(--primary-strong); }
.sv-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.sv-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.sv-reset { padding: 10px 24px; height: 46px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.sv-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.sv-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.sv-result-head { font-size: 18px; }
.sv-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.sv-gold { color: var(--good-strong); font-weight: 800; }
.sv-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.sv-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.sv-spark { position: absolute; font-size: 22px; color: var(--gold); animation: svSpark 1.1s ease-out forwards; }
@keyframes svSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.sv-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.sv-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.sv-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.sv-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.sv-info-list { display: flex; flex-direction: column; gap: 8px; }
.sv-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.sv-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.sv-info-rule b { color: var(--primary-strong); }
.sv-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.sv-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
