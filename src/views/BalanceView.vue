<script setup>
// 调味天平（2026-09-09 新增，第 26 款）：按住瓶口往量管里倒，停在刻度线上越准越好
// 十模式：时长 40~100 秒 × 调料 2~4 种 × 容差 10%~2% × 倒速 × 盲倒（不显示克数）× 液面晃动
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, kinds: 2, tol: 0.10, fast: 1, blind: 0, shake: 0, target: 610, gold: 45, desc: '40 秒 · 目标 610 分 · 2 种调料，容差宽松 · +45 币' },
  m2: { label: '模式2', dur: 45, kinds: 2, tol: 0.085, fast: 1, blind: 0, shake: 0, target: 675, gold: 55, desc: '45 秒 · 目标 675 分 · 容差收紧到 8.5% · +55 币' },
  m3: { label: '模式3', dur: 50, kinds: 2, tol: 0.07, fast: 1, blind: 0, shake: 0, target: 740, gold: 60, desc: '50 秒 · 目标 740 分 · 容差 7% · +60 币' },
  m4: { label: '模式4', dur: 55, kinds: 3, tol: 0.06, fast: 1.15, blind: 0, shake: 0, target: 800, gold: 70, desc: '55 秒 · 目标 800 分 · **3 种调料** + 倒得更快 · +70 币' },
  m5: { label: '模式5', dur: 60, kinds: 3, tol: 0.05, fast: 1.15, blind: 0, shake: 1, target: 860, gold: 80, desc: '60 秒 · 目标 860 分 · **液面会晃**，读数更难抓 · +80 币' },
  m6: { label: '模式6', dur: 65, kinds: 3, tol: 0.045, fast: 1.3, blind: 1, shake: 1, target: 915, gold: 90, desc: '65 秒 · 目标 915 分 · **盲倒**：只显示刻度不显示克数 · +90 币' },
  m7: { label: '模式7', dur: 70, kinds: 4, tol: 0.04, fast: 1.3, blind: 0, shake: 1, target: 970, gold: 100, desc: '70 秒 · 目标 970 分 · 4 种调料同时配 · +100 币' },
  m8: { label: '模式8', dur: 80, kinds: 4, tol: 0.035, fast: 1.5, blind: 1, shake: 1, target: 1090, gold: 120, desc: '80 秒 · 目标 1090 分 · 盲倒 + 高速 + 4 种 · +120 币' },
  m9: { label: '模式9', dur: 90, kinds: 4, tol: 0.03, fast: 1.7, blind: 1, shake: 1, target: 1210, gold: 140, desc: '90 秒 · 目标 1210 分 · 容差 3%，大师手感 · +140 币' },
  m10: { label: '模式10', dur: 100, kinds: 4, tol: 0.02, fast: 2, blind: 1, shake: 1, target: 1320, gold: 160, desc: '100 秒 · 目标 1320 分 · 2% 容差 + 最快倒速，极限配比 · +160 币' },
}
const SPICES = [
  { key: 'soy', name: '酱油', color: '#8a4a2e' },
  { key: 'vinegar', name: '香醋', color: '#c9542e' },
  { key: 'salt', name: '盐', color: '#9aa8b0' },
  { key: 'sugar', name: '糖', color: '#e8c34a' },
]
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const recipes = ref(0)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.balance?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

// 当前配方：{ items: [{spice, target, actual}], tol, done }
const recipe = ref(null)
const holding = ref(null) // 正在按住倒的调料 key
const lastResult = ref(null) // { err, pts, perfect }
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let pourAccum = 0
let tiltPhase = 0
let nextAt = 0

const POUR_RATE = 30 // 克/秒（基础）
const TUBE_MAX = 120 // 量管刻度上限（克）

function rand(a, b) { return a + Math.random() * (b - a) }
function newRecipe() {
  const m = cfg.value
  const kinds = SPICES.slice(0, m.kinds)
  const items = kinds.map((s) => ({ ...s, target: Math.round(rand(25, 95)), actual: 0 }))
  recipe.value = { items, tol: m.tol }
  lastResult.value = null
  holding.value = null
  pourAccum = 0
}
function reset() {
  stopLoop()
  score.value = 0
  recipes.value = 0
  timeLeft.value = cfg.value.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  tiltPhase = 0
  newRecipe()
  startLoop()
}
function startGame() {
  if (started.value) return
  started.value = true
  lastTs = 0
  beep(880, 0.08)
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

function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  tiltPhase += dt
  if (started.value && !overFlag) {
    timeAccum += dt
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) { settle(); return } }
    if (lastResult.value) tickNext(now)
    if (holding.value && recipe.value) {
      const it = recipe.value.items.find((x) => x.key === holding.value)
      if (it) {
        it.actual = Math.min(TUBE_MAX, it.actual + POUR_RATE * cfg.value.fast * dt)
        pourAccum += POUR_RATE * cfg.value.fast * dt
        if (pourAccum >= 10) { pourAccum = 0; beep(300 + Math.min(400, it.actual * 3), 0.03, 'triangle', 0.03) }
      }
    }
  }
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function onHold(key) {
  if (!started.value || overFlag || !recipe.value) return
  holding.value = key
}
function onRelease() { holding.value = null }

function confirm() {
  if (!started.value || overFlag || !recipe.value || lastResult.value) return
  const r = recipe.value
  const total = r.items.reduce((a, x) => a + x.target, 0)
  const err = r.items.reduce((a, x) => a + Math.abs(x.actual - x.target), 0) / total
  const tol = r.tol
  let pts = Math.round((100 * Math.max(0, 1 - err / tol)) / 5) * 5
  const perfect = err <= tol * 0.2
  if (perfect) pts = Math.round(pts * 1.5)
  score.value += pts
  recipes.value++
  lastResult.value = { err, pts, perfect }
  if (pts > 0) { beep(880, 0.1); setTimeout(() => beep(perfect ? 1568 : 1175, 0.12), 90) } else beep(160, 0.25, 'sawtooth')
  holding.value = null
  nextAt = performance.now() + 420
}
function tickNext(now) {
  if (lastResult.value && now >= nextAt) newRecipe()
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
    ui.pushLog(`⚖️ 调味天平：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`⚖️ 调味天平：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.balance) mg.balance = { best: 0 }
  mg.balance.best = Math.max(mg.balance.best ?? 0, score.value)
}

// 液面高度（含晃动）
function fillPct(it) {
  const base = Math.min(100, (it.actual / TUBE_MAX) * 100)
  if (!cfg.value.shake) return base
  const w = Math.sin(tiltPhase * 9 + it.target) * 1.6
  return Math.max(0, Math.min(100, base + w))
}
function markPct(it) { return Math.min(100, (it.target / TUBE_MAX) * 100) }
// 天平倾角：按总误差方向
const tiltDeg = computed(() => {
  const r = recipe.value
  if (!r) return 0
  let d = 0
  for (const it of r.items) d += (it.actual - it.target)
  return Math.max(-13, Math.min(13, d / 3))
})
function errText(it) {
  if (cfg.value.blind) return ''
  return `${it.actual.toFixed(0)} / ${it.target} g`
}

onMounted(() => { reset() })
onUnmounted(() => stopLoop())
</script>

<template>
  <div class="ba-page">
    <div class="ba-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="ba-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="ba-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="ba-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="ba-chip">⚖️ 配比 <b class="mono">{{ recipes }}</b></span>
      <span class="ba-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="ba-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="ba-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="ba-stage">
      <!-- 天平（倾角显示总误差） -->
      <div class="ba-scale">
        <div class="ba-beam" :style="{ transform: `rotate(${tiltDeg}deg)` }">
          <span class="ba-pan ba-pan-l">🥣</span>
          <span class="ba-pan ba-pan-r">🥣</span>
        </div>
        <div class="ba-pole"></div>
      </div>

      <div class="ba-tubes">
        <div v-for="it in (recipe ? recipe.items : [])" :key="it.key" class="ba-tube-wrap">
          <div class="ba-tube">
            <div class="ba-fill" :style="{ height: fillPct(it) + '%', background: it.color }"></div>
            <div class="ba-mark" :style="{ bottom: markPct(it) + '%' }"></div>
          </div>
          <div class="ba-tube-name">{{ it.name }}</div>
          <div class="ba-tube-num mono">{{ errText(it) }}</div>
        </div>
      </div>

      <div v-if="lastResult" class="ba-result-chip" :class="{ ok: lastResult.pts > 0 }">
        {{ lastResult.perfect ? '✨ 完美配比！' : lastResult.pts > 0 ? '✅ 不错' : '💦 偏太多' }} +{{ lastResult.pts }}
      </div>
    </div>

    <div class="ba-keys">
      <button v-if="!started" class="ba-start" @click="startGame()">▶ 开始游戏</button>
      <template v-else>
        <button
          v-for="it in (recipe ? recipe.items : [])"
          :key="it.key"
          class="ba-bottle"
          :class="{ on: holding === it.key }"
          @pointerdown="onHold(it.key)"
          @pointerup="onRelease"
          @pointerleave="onRelease"
          @pointercancel="onRelease"
        >🧂 {{ it.name }}</button>
        <button class="ba-ok" @click="confirm()">✅ 确认配比</button>
        <button class="ba-reset" @click="reset()">🔄 重置本局</button>
      </template>
    </div>

    <div v-if="over" class="ba-mask">
      <div class="ba-result">
        <div class="ba-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="ba-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>配比 <b class="mono">{{ recipes }}</b> 份</span>
          <span v-if="passed" class="ba-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="ba-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="ba-fire">
        <span v-for="i in 20" :key="i" class="ba-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="ba-info-mask" @click.self="showInfo = false">
      <div class="ba-info-box">
        <div class="ba-info-head"><b>⚖️ 调味天平 · 十模式说明</b><button class="ba-info-close" @click="showInfo = false">✕</button></div>
        <div class="ba-info-list">
          <div class="ba-info-row ba-info-rule">通用规则：每份配方给出每种调料的目标克数，<b>按住瓶口往量管里倒</b>、松手停止 · 液面停在刻度线上越准，得分越高（完全对准有 ✨ 完美加成）· 倒多了倒少了都算误差，<b>误差超过容差就 0 分</b> · 点「✅ 确认配比」提交并换下一份 · 限时结束按得分结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="ba-info-row">
            <b class="ba-info-name">{{ m.label }}</b>
            <span class="ba-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ba-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.ba-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.ba-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.ba-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.ba-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.ba-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.ba-stage { width: min(720px, 98%); border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); padding: 18px 16px 22px; display: flex; flex-direction: column; align-items: center; gap: 16px; position: relative; }
.ba-scale { position: relative; width: 200px; height: 62px; display: flex; align-items: flex-end; justify-content: center; }
.ba-beam { position: relative; width: 180px; height: 10px; border-radius: 999px; background: linear-gradient(180deg, #c89a6b, #9a6b40); transition: transform 0.12s linear; }
.ba-pan { position: absolute; top: -14px; font-size: 24px; }
.ba-pan-l { left: -6px; }
.ba-pan-r { right: -6px; }
.ba-pole { position: absolute; bottom: -14px; width: 10px; height: 22px; border-radius: 4px; background: rgba(150, 110, 70, 0.55); }
.ba-tubes { display: flex; gap: 26px; align-items: flex-end; justify-content: center; flex-wrap: wrap; }
.ba-tube-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ba-tube { position: relative; width: 46px; height: 150px; border-radius: 10px 10px 14px 14px; background: rgba(255, 252, 246, 0.75); border: 1px solid rgba(150, 110, 70, 0.35); overflow: hidden; }
.ba-fill { position: absolute; left: 0; right: 0; bottom: 0; transition: height 0.06s linear; opacity: 0.85; }
.ba-mark { position: absolute; left: -2px; right: -2px; height: 3px; background: #d95a38; box-shadow: 0 0 6px rgba(217, 90, 56, 0.6); }
.ba-tube-name { font-size: 12.5px; font-weight: 700; color: var(--muted); }
.ba-tube-num { font-size: 12px; font-weight: 700; color: var(--text); }
.ba-result-chip { font-size: 14px; font-weight: 800; color: var(--bad-strong); }
.ba-result-chip.ok { color: var(--good-strong); }
.ba-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.ba-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.ba-bottle { padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #eab04a, #d98a2b); border: none; touch-action: none; }
.ba-bottle.on { background: linear-gradient(135deg, #e8703f, #c9542e); transform: translateY(2px); }
.ba-ok { padding: 10px 22px; border-radius: 12px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.ba-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.ba-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.ba-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.ba-result-head { font-size: 18px; }
.ba-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.ba-gold { color: var(--good-strong); font-weight: 800; }
.ba-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.ba-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.ba-spark { position: absolute; font-size: 22px; color: var(--gold); animation: baSpark 1.1s ease-out forwards; }
@keyframes baSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.ba-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.ba-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.ba-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.ba-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.ba-info-list { display: flex; flex-direction: column; gap: 8px; }
.ba-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.ba-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.ba-info-rule b { color: var(--primary-strong); }
.ba-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.ba-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
