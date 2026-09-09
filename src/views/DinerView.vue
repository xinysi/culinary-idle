<script setup>
// 餐厅传菜（2026-09-09 新增，第 21 款）：客人点单，从传菜台选菜送到对应客人手里
// 点菜（选中传菜台上的菜）→ 点客人上菜 · 送错扣连击 · 客人等急了走人扣 1 命 · 十模式
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { itemImage } from '../game/data/itemImage.js'

const player = usePlayerStore()
const ui = useUiStore()

// ── 菜品池（图鉴真实图片；分值与出餐权重）──
const DISHES = [
  { id: 'apple', name: '苹果', score: 10, w: 20 },
  { id: 'carrot', name: '胡萝卜', score: 12, w: 18 },
  { id: 'tomato', name: '番茄', score: 15, w: 16 },
  { id: 'strawberry', name: '草莓', score: 18, w: 14 },
  { id: 'grape', name: '葡萄', score: 22, w: 12 },
  { id: 'banana', name: '香蕉', score: 26, w: 10 },
  { id: 'pineapple', name: '菠萝', score: 32, w: 8 },
  { id: 'mango', name: '芒果', score: 38, w: 6 },
  { id: 'watermelon', name: '西瓜', score: 44, w: 4 },
  { id: 'matsutake', name: '松茸', score: 52, w: 2 },
]
const IMGS = DISHES.map((d) => {
  const im = new Image()
  im.src = itemImage(d.id)
  return im
})

// ── 十模式（座位 × 耐心 × 菜品数 × 出餐间隔 × 目标分）──
const MODES = {
  m1: { label: '模式1', dur: 45, seats: 3, patience: 14, pool: 4, cook: 2.2, slots: 4, target: 300, gold: 35, desc: '45 秒 · 目标 300 分 · 3 位客人 / 耐心 14 秒 / 4 种菜 · +35 币' },
  m2: { label: '模式2', dur: 50, seats: 3, patience: 12, pool: 5, cook: 2.0, slots: 4, target: 380, gold: 45, desc: '50 秒 · 目标 380 分 · +45 币' },
  m3: { label: '模式3', dur: 50, seats: 4, patience: 11, pool: 6, cook: 1.9, slots: 4, target: 460, gold: 55, desc: '50 秒 · 目标 460 分 · 4 位客人 · +55 币' },
  m4: { label: '模式4', dur: 55, seats: 4, patience: 10, pool: 6, cook: 1.8, slots: 4, target: 560, gold: 65, desc: '55 秒 · 目标 560 分 · +65 币' },
  m5: { label: '模式5', dur: 60, seats: 4, patience: 9, pool: 7, cook: 1.7, slots: 5, target: 660, gold: 75, desc: '60 秒 · 目标 660 分 · 耐心更短 · +75 币' },
  m6: { label: '模式6', dur: 60, seats: 5, patience: 8.5, pool: 7, cook: 1.6, slots: 5, target: 780, gold: 90, desc: '60 秒 · 目标 780 分 · 5 位客人 · +90 币' },
  m7: { label: '模式7', dur: 65, seats: 5, patience: 8, pool: 8, cook: 1.5, slots: 5, target: 900, gold: 100, desc: '65 秒 · 目标 900 分 · +100 币' },
  m8: { label: '模式8', dur: 70, seats: 5, patience: 7, pool: 8, cook: 1.4, slots: 5, target: 1050, gold: 115, desc: '70 秒 · 目标 1050 分 · +115 币' },
  m9: { label: '模式9', dur: 75, seats: 6, patience: 6.5, pool: 9, cook: 1.3, slots: 6, target: 1200, gold: 130, desc: '75 秒 · 目标 1200 分 · 6 位客人 · +130 币' },
  m10: { label: '模式10', dur: 80, seats: 6, patience: 6, pool: 10, cook: 1.2, slots: 6, target: 1400, gold: 150, desc: '80 秒 · 目标 1400 分 · 满座高压后厨 · +150 币' },
}
const showInfo = ref(false)

// ── 响应式状态 ──
const mode = ref('m1')
const customers = ref([]) // { key, dish, patience, max, face, state:'wait'|'leave' }
const slots = ref([]) // 传菜台：dishId 或 null
const sel = ref(-1) // 选中的传菜位
const score = ref(0)
const timeLeft = ref(45)
const lives = ref(3)
const combo = ref(0)
const maxCombo = ref(0)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const hint = ref('')
const best = computed(() => player.minigames?.diner?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const goldText = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})
const poolList = computed(() => DISHES.slice(0, cfg.value.pool))

// ── 内部状态 ──
let nextKey = 1
let timeAccum = 0
let cookAccum = 0
let spawnAccum = 0
let comboAt = 0
let running = false
let overFlag = false
let lastTs = 0
let loopId = null
const FACES = ['🧑', '👩', '👨', '👵', '👴', '🧒', '👧', '👦']

const imgOf = (id) => itemImage(id)
const dishScore = (id) => DISHES.find((d) => d.id === id)?.score ?? 10
const dishName = (id) => DISHES.find((d) => d.id === id)?.name ?? ''

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

// ── 客人 / 出餐 ──
function pickDish() {
  const pool = poolList.value
  const total = pool.reduce((s, d) => s + d.w, 0)
  let r = Math.random() * total
  for (const d of pool) { r -= d.w; if (r <= 0) return d.id }
  return pool[0].id
}
function addCustomer() {
  const m = cfg.value
  if (customers.value.length >= m.seats) return
  const usedFaces = new Set(customers.value.map((c) => c.face))
  const face = FACES.find((f) => !usedFaces.has(f)) || FACES[0]
  customers.value = [...customers.value, {
    key: nextKey++, dish: pickDish(), patience: m.patience, max: m.patience, face, flash: 0,
  }]
}
function addDish() {
  const m = cfg.value
  if (slots.value.length >= m.slots) return
  // 优先补上「有客人在等但传菜台没有」的菜
  const onCounter = new Set(slots.value.filter(Boolean))
  const need = customers.value.find((c) => !onCounter.has(c.dish))
  const dish = need ? need.dish : pickDish()
  slots.value = [...slots.value, dish]
}
function pick(i) {
  if (!started.value || over.value) return
  sel.value = sel.value === i ? -1 : i
  beep(520, 0.04, 'triangle', 0.05)
}
function serve(c) {
  if (!started.value || over.value) return
  if (sel.value < 0) { hint.value = '先点下方的菜，再点客人上菜'; return }
  const dish = slots.value[sel.value]
  if (!dish) return
  if (dish === c.dish) {
    const now = performance.now()
    combo.value = now - comboAt < 3000 ? combo.value + 1 : 1
    comboAt = now
    maxCombo.value = Math.max(maxCombo.value, combo.value)
    const mult = 1 + Math.min(0.5, 0.1 * (combo.value - 1))
    const gain = Math.round(dishScore(dish) * mult)
    score.value += gain
    hint.value = `${dishName(dish)} 上菜成功 +${gain}${combo.value >= 2 ? '（连击 ×' + combo.value + '）' : ''}`
    beep(880, 0.07)
    setTimeout(() => beep(1175, 0.08), 70)
    // 移除客人与该盘菜
    customers.value = customers.value.filter((x) => x.key !== c.key)
    const ns = slots.value.slice()
    ns[sel.value] = null
    slots.value = ns
    sel.value = -1
    spawnAccum = Math.max(spawnAccum, 0.6) // 稍快补位
  } else {
    combo.value = 0
    comboAt = 0
    hint.value = `上错菜了！客人要的是 ${dishName(c.dish)}`
    beep(180, 0.2, 'sawtooth', 0.07)
    customers.value = customers.value.map((x) => x.key === c.key ? { ...x, flash: 0.5 } : x)
  }
}

// ── 主循环 ──
function loop() {
  const now = performance.now()
  const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016
  lastTs = now
  if (running && !overFlag) {
    const m = cfg.value
    if (started.value) {
      timeAccum += dt
      if (timeAccum >= 1) {
        timeAccum -= 1
        timeLeft.value = Math.max(0, timeLeft.value - 1)
        if (timeLeft.value <= 0) settle()
      }
      // 耐心
      let lost = 0
      const kept = []
      for (const c of customers.value) {
        const p = c.patience - dt
        if (p <= 0) { lost++; continue }
        kept.push({ ...c, patience: p, flash: Math.max(0, (c.flash || 0) - dt) })
      }
      // 注意：无论有没有客人走人，都要把递减后的耐心写回（否则耐心条不下降）
      customers.value = kept
      if (lost > 0) {
        lives.value -= lost
        combo.value = 0
        hint.value = '客人等急了走了！-1 ❤'
        beep(150, 0.3, 'sawtooth', 0.09)
        if (lives.value <= 0) settle()
      }
      // 出餐
      cookAccum += dt
      if (cookAccum >= m.cook) { cookAccum = 0; addDish() }
      // 补客人
      spawnAccum += dt
      if (spawnAccum >= 1.6) { spawnAccum = 0; addCustomer() }
    }
  }
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 50)
}
function stopLoop() {
  if (loopId) clearInterval(loopId)
  loopId = null
}

// ── 开局 / 结算 ──
function reset() {
  stopLoop()
  const m = cfg.value
  customers.value = []
  slots.value = []
  sel.value = -1
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  lives.value = 3
  timeLeft.value = m.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  cookAccum = 0
  spawnAccum = 0
  comboAt = 0
  hint.value = '点击「开始游戏」后，先点下方的菜，再点客人上菜'
  running = true
  startLoop()
}
function startGame() {
  if (overFlag) return
  started.value = true
  timeLeft.value = cfg.value.dur
  timeAccum = 0
  // 开局先来 2 位客人 + 2 盘菜
  addCustomer(); addCustomer()
  addDish(); addDish()
  hint.value = '先点下方的菜，再点对应客人上菜'
  beep(880, 0.08)
  setTimeout(() => beep(1175, 0.1), 90)
}
function settle() {
  if (overFlag) return
  overFlag = true
  over.value = true
  running = false
  stopLoop()
  const m = cfg.value
  const win = score.value >= m.target
  passed.value = win
  if (win) {
    const extra = Math.round(m.gold * 0.5 * Math.min(1, (score.value - m.target) / m.target))
    const gold = m.gold + extra
    player.gainGameCoins(gold)
    ui.pushLog(`🍽️ 餐厅传菜：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🍽️ 餐厅传菜：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.diner) mg.diner = { best: 0 }
  mg.diner.best = Math.max(mg.diner.best ?? 0, score.value)
}

onMounted(() => { reset() })
onUnmounted(() => { stopLoop() })
</script>

<template>
  <div class="dn-page">
    <div class="dn-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="dn-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="dn-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="dn-chip">⭐ <b class="mono">{{ score }}</b></span>
      <span class="dn-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="dn-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="dn-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="dn-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="dn-stage">
      <!-- 客人区 -->
      <div class="dn-customers">
        <div
          v-for="c in customers"
          :key="c.key"
          class="dn-cust"
          :class="{ flash: c.flash > 0 }"
          @click="serve(c)"
        >
          <div class="dn-order">
            <img :src="imgOf(c.dish)" alt="" @error="$event.target.style.display = 'none'" />
          </div>
          <div class="dn-face">{{ c.face }}</div>
          <div class="dn-bar"><i :style="{ width: Math.max(0, (c.patience / c.max) * 100) + '%' }"></i></div>
        </div>
        <div v-for="k in Math.max(0, cfg.seats - customers.length)" :key="'e' + k" class="dn-cust dn-empty">
          <div class="dn-face">💺</div>
        </div>
      </div>

      <!-- 传菜台 -->
      <div class="dn-counter">
        <div class="dn-counter-label">🍳 传菜台</div>
        <div class="dn-slots">
          <div
            v-for="(d, i) in slots"
            :key="i"
            class="dn-slot"
            :class="{ sel: sel === i, empty: !d }"
            @click="pick(i)"
          >
            <img v-if="d" :src="imgOf(d)" alt="" @error="$event.target.style.display = 'none'" />
            <span v-else class="dn-slot-empty">空</span>
          </div>
          <div v-for="k in Math.max(0, cfg.slots - slots.length)" :key="'s' + k" class="dn-slot empty"><span class="dn-slot-empty">空</span></div>
        </div>
      </div>
    </div>

    <div class="dn-hint">{{ hint }}</div>

    <div class="dn-keys">
      <button v-if="!started" class="dn-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="dn-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <!-- 结算弹窗 -->
    <div v-if="over" class="dn-mask">
      <div class="dn-result">
        <div class="dn-result-head"><b>{{ passed ? '🎉 达标通关！' : '💦 未达标' }}</b></div>
        <div class="dn-result-score">
          <span>本局得分 <b class="mono">{{ score }}</b></span>
          <span class="dim">目标 {{ cfg.target }}</span>
          <span class="dim">最高连击 ×{{ maxCombo }}</span>
          <span v-if="passed" class="dn-gold">+{{ goldText }} 游戏币</span>
        </div>
        <button class="dn-again" @click="reset()">再来一局</button>
      </div>
      <div v-if="passed" class="dn-fire">
        <span v-for="i in 20" :key="i" class="dn-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="dn-info-mask" @click.self="showInfo = false">
      <div class="dn-info-box">
        <div class="dn-info-head"><b>🍽️ 餐厅传菜 · 十模式说明</b><button class="dn-info-close" @click="showInfo = false">✕</button></div>
        <div class="dn-info-list">
          <div class="dn-info-row dn-info-rule">
            玩法：客人头顶的框里是他们点的菜，头顶下方是<b>耐心条</b>（变红就是快等急了）。<br />
            操作：<b>先点传菜台里的一道菜</b>（会高亮），<b>再点对应的客人</b>即可上菜得分；点错客人会断连击。<br />
            传菜台每 <b>出餐间隔</b> 补一道菜（优先补上「有客人在等但台上没有」的菜），最多放 {{ cfg.slots }} 盘。<br />
            客人耐心归零会<b>气走并扣 1 条命</b>（共 3 条命）；连击：3 秒内连续上菜，单道菜最高 ×1.5。<br />
            限时结束后按得分结算，达标发游戏币（超出目标最多 +50%）。
          </div>
          <div v-for="(m, key) in MODES" :key="key" class="dn-info-row">
            <b class="dn-info-name">{{ m.label }}</b>
            <span class="dn-info-desc">{{ m.desc }}</span>
          </div>
          <div class="dn-info-row dn-info-rule">
            菜品图鉴：{{ DISHES.map((d) => d.name + '(' + d.score + '分)').join('、') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dn-page { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 4px 0 12px; }
.dn-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.dn-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.dn-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.dn-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.dn-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }

.dn-stage { width: min(760px, 98%); display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 18px; background: rgba(255, 252, 246, 0.72); border: 1px solid rgba(150, 110, 70, 0.3); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.16); }
.dn-customers { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; min-height: 118px; }
.dn-cust { width: 104px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 6px 10px; border-radius: 14px; background: rgba(255, 251, 244, 0.9); border: 1px solid rgba(150, 110, 70, 0.28); cursor: pointer; transition: transform 0.1s, box-shadow 0.12s; }
.dn-cust:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(184, 68, 42, 0.18); }
.dn-cust.flash { animation: dnFlash 0.5s ease; }
@keyframes dnFlash { 0%, 100% { background: rgba(255, 251, 244, 0.9); } 50% { background: rgba(224, 106, 90, 0.35); } }
.dn-cust.dn-empty { opacity: 0.4; cursor: default; }
.dn-cust.dn-empty:hover { transform: none; box-shadow: none; }
.dn-order { width: 56px; height: 56px; border-radius: 12px; background: rgba(255, 255, 255, 0.9); border: 2px solid rgba(217, 90, 56, 0.35); display: flex; align-items: center; justify-content: center; }
.dn-order img { width: 46px; height: 46px; object-fit: contain; }
.dn-face { font-size: 22px; line-height: 1; }
.dn-bar { width: 84px; height: 7px; border-radius: 999px; background: rgba(120, 84, 50, 0.2); overflow: hidden; }
.dn-bar i { display: block; height: 100%; background: linear-gradient(90deg, #7fd08a, #e8c34a 60%, #e06a5a); transition: width 0.1s linear; }

.dn-counter { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 14px; background: rgba(120, 84, 50, 0.12); border: 1px dashed rgba(150, 110, 70, 0.35); }
.dn-counter-label { font-size: 12px; font-weight: 800; color: var(--muted); }
.dn-slots { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.dn-slot { width: 62px; height: 62px; border-radius: 12px; background: rgba(255, 255, 255, 0.9); border: 2px solid rgba(150, 110, 70, 0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.1s, box-shadow 0.12s; }
.dn-slot img { width: 50px; height: 50px; object-fit: contain; }
.dn-slot.sel { border-color: var(--primary-strong); box-shadow: 0 0 0 3px rgba(217, 90, 56, 0.25); transform: translateY(-3px); }
.dn-slot.empty { background: rgba(255, 255, 255, 0.45); border-style: dashed; cursor: default; }
.dn-slot-empty { font-size: 11px; color: var(--muted); }

.dn-hint { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; min-height: 18px; }
.dn-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.dn-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.dn-reset { padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }

.dn-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.dn-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.dn-result-head { font-size: 18px; }
.dn-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.dn-gold { color: var(--good-strong); font-weight: 800; }
.dn-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.dn-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.dn-spark { position: absolute; font-size: 22px; color: var(--gold); animation: dnSpark 1.1s ease-out forwards; }
@keyframes dnSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }

.dn-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.dn-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.dn-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.dn-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.dn-info-list { display: flex; flex-direction: column; gap: 8px; }
.dn-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.dn-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.dn-info-rule b { color: var(--primary-strong); }
.dn-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.dn-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
