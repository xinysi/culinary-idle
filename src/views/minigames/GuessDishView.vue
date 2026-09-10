<script setup>
// 猜菜名（2026-09-10 新增，第 25 款）：菜名藏起来，从候选字里点字猜；点错扣命
// 十模式：时长 40~100 秒 × 菜名字数 × 免费提示字 × 限命 × 干扰字数量
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../../stores/player.js'
import { useUiStore } from '../../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const MODES = {
  m1: { label: '模式1', dur: 40, len: 2, hint: 1, lives: 5, decoy: 6, target: 1000, gold: 45, desc: '40 秒 · 目标 1000 分 · 2 字菜名 + 1 个提示字，5 条命 · +45 币' },
  m2: { label: '模式2', dur: 45, len: 2, hint: 1, lives: 4, decoy: 8, target: 975, gold: 55, desc: '45 秒 · 目标 975 分 · 干扰字变多 · +55 币' },
  m3: { label: '模式3', dur: 50, len: 3, hint: 1, lives: 4, decoy: 8, target: 950, gold: 60, desc: '50 秒 · 目标 950 分 · **3 字菜名** · +60 币' },
  m4: { label: '模式4', dur: 55, len: 3, hint: 0, lives: 4, decoy: 10, target: 875, gold: 70, desc: '55 秒 · 目标 875 分 · 没有提示字了 · +70 币' },
  m5: { label: '模式5', dur: 60, len: 4, hint: 1, lives: 4, decoy: 10, target: 650, gold: 80, desc: '60 秒 · 目标 650 分 · **4 字菜名** · +80 币' },
  m6: { label: '模式6', dur: 65, len: 4, hint: 0, lives: 3, decoy: 12, target: 650, gold: 90, desc: '65 秒 · 目标 650 分 · 只剩 3 条命 · +90 币' },
  m7: { label: '模式7', dur: 70, len: 5, hint: 1, lives: 3, decoy: 12, target: 650, gold: 100, desc: '70 秒 · 目标 650 分 · **5 字菜名** · +100 币' },
  m8: { label: '模式8', dur: 80, len: 5, hint: 0, lives: 3, decoy: 14, target: 725, gold: 120, desc: '80 秒 · 目标 725 分 · 无提示 + 满干扰 · +120 币' },
  m9: { label: '模式9', dur: 90, len: 6, hint: 0, lives: 3, decoy: 16, target: 775, gold: 140, desc: '90 秒 · 目标 775 分 · **6 字菜名** · +140 币' },
  m10: { label: '模式10', dur: 100, len: 7, hint: 0, lives: 2, decoy: 18, target: 800, gold: 160, desc: '100 秒 · 目标 800 分 · 7 字长名 + 2 条命，硬核猜字 · +160 币' },
}
const DISHES = [
  '蛋炒饭', '红烧肉', '佛跳墙', '狮子头', '小笼包', '担担面', '麻辣烫', '糖醋鱼', '宫保鸡丁', '麻婆豆腐',
  '鱼香肉丝', '水煮牛肉', '白切鸡', '东坡肉', '叫花鸡', '糖醋排骨', '清蒸鲈鱼', '蟹粉狮子头', '葱烧海参', '龙井虾仁',
  '北京烤鸭', '蚂蚁上树', '回锅肉', '干煸豆角', '酸辣土豆丝', '番茄炒蛋', '青椒肉丝', '干锅花菜', '蒜蓉粉丝虾', '香辣蟹',
  '梅菜扣肉', '粉蒸肉', '毛血旺', '夫妻肺片', '酸菜鱼', '剁椒鱼头', '板栗烧鸡', '三杯鸡', '盐焗鸡', '口水鸡',
  '炸酱面', '热干面', '阳春面', '牛肉面', '云吞面', '刀削面', '过桥米线', '螺蛳粉', '羊肉泡馍', '生煎包',
  '灌汤包', '虾饺', '烧卖', '叉烧包', '肠粉', '糯米鸡', '煲仔饭', '蛋挞', '双皮奶', '龟苓膏',
  '冰粉', '凉粉', '凉皮', '肉夹馍', '煎饼果子', '驴打滚', '糖葫芦', '拔丝地瓜', '桂花糕', '绿豆糕',
]
const showInfo = ref(false)
const mode = ref('m1')
const score = ref(0)
const solved = ref(0)
const lives = ref(5)
const timeLeft = ref(40)
const over = ref(false)
const passed = ref(false)
const started = ref(false)
const best = computed(() => player.minigames?.dish?.best ?? 0)
const cfg = computed(() => MODES[mode.value])
const targetText = computed(() => `${score.value}/${cfg.value.target}`)
const coinPreview = computed(() => {
  const m = cfg.value
  return m.gold + Math.round(m.gold * 0.5 * Math.min(1, Math.max(0, (score.value - m.target) / m.target)))
})

const word = ref([]) // 目标字
const revealed = ref([]) // 每个位置是否已亮
const pool = ref([]) // [{ ch, used }]
const wrongAt = ref(-1)
const lastGain = ref('')
let loopId = null
let lastTs = 0
let timeAccum = 0
let overFlag = false
let transitionAt = 0

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

function newWord() {
  const m = cfg.value
  const cands = DISHES.filter((d) => d.length === m.len)
  const name = cands[Math.floor(Math.random() * cands.length)] || DISHES[Math.floor(Math.random() * DISHES.length)]
  word.value = name.split('')
  revealed.value = name.split('').map(() => false)
  // 免费提示字
  const idxs = [...word.value.keys()].sort(() => Math.random() - 0.5).slice(0, m.hint)
  for (const i of idxs) revealed.value[i] = true
  // 候选池：目标字（去重）+ 干扰字
  const uniq = [...new Set(word.value)]
  const decoys = []
  const all = DISHES.join('').split('')
  while (decoys.length < m.decoy) {
    const c = all[Math.floor(Math.random() * all.length)]
    if (!uniq.includes(c) && !decoys.includes(c)) decoys.push(c)
  }
  pool.value = [...uniq, ...decoys].sort(() => Math.random() - 0.5).map((ch) => ({ ch, used: false }))
  wrongAt.value = -1
}
function buildBoard() {
  score.value = 0
  solved.value = 0
  lives.value = cfg.value.lives
  timeLeft.value = cfg.value.dur
  over.value = false
  overFlag = false
  passed.value = false
  started.value = false
  timeAccum = 0
  transitionAt = 0
  lastGain.value = ''
  newWord()
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
    if (timeAccum >= 1) { timeAccum -= 1; timeLeft.value = Math.max(0, timeLeft.value - 1); if (timeLeft.value <= 0) { settle(); return } }
    if (transitionAt && now >= transitionAt) { transitionAt = 0; newWord() }
  }
}
function startLoop() {
  if (loopId) clearInterval(loopId)
  lastTs = 0
  loopId = setInterval(loop, 16)
}
function stopLoop() { if (loopId) clearInterval(loopId); loopId = null }

function pick(cell) {
  if (!started.value || overFlag || transitionAt) return
  if (cell.used) return
  const idxs = word.value.map((c, i) => (c === cell.ch ? i : -1)).filter((i) => i >= 0)
  const hit = idxs.some((i) => !revealed.value[i])
  if (hit) {
    for (const i of idxs) revealed.value[i] = true
    cell.used = true
    score.value += 30
    lastGain.value = '+30'
    beep(880, 0.07)
    setTimeout(() => beep(1175, 0.08), 70)
    if (revealed.value.every(Boolean)) {
      const bonus = 100 + lives.value * 10
      score.value += bonus
      solved.value++
      lastGain.value = `🎉 +${bonus}`
      beep(1046, 0.1); setTimeout(() => beep(1568, 0.14), 100)
      transitionAt = performance.now() + 600
    }
  } else {
    cell.used = true
    wrongAt.value = performance.now()
    lives.value--
    lastGain.value = '✗ -1 ❤'
    beep(180, 0.2, 'sawtooth', 0.07)
    if (lives.value <= 0) settle()
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
    ui.pushLog(`🥢 猜菜名：${score.value} 分达标！+${gold} 游戏币`, 'gain')
    beep(880, 0.12)
    setTimeout(() => beep(1175, 0.12), 110)
    setTimeout(() => beep(1568, 0.22), 230)
  } else {
    beep(160, 0.32, 'sawtooth')
    ui.pushLog(`🥢 猜菜名：${score.value} 分未达标（目标 ${m.target}）`, 'warn')
  }
  const mg = player.minigames
  if (!mg.dish) mg.dish = { best: 0 }
  mg.dish.best = Math.max(mg.dish.best ?? 0, score.value)
}

onMounted(() => { buildBoard(); startLoop() })
onUnmounted(() => stopLoop())
</script>

<template>
  <div class="gd-page">
    <div class="gd-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="gd-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="gd-chip" style="margin-left: auto">⏱ <b class="mono">{{ timeLeft }}</b> 秒</span>
      <span class="gd-chip">🎯 <b class="mono">{{ targetText }}</b></span>
      <span class="gd-chip">❤️ <b class="mono">{{ lives }}</b></span>
      <span class="gd-chip">🍽 猜出 <b class="mono">{{ solved }}</b></span>
      <span class="gd-chip">💰 <b class="mono">{{ coinPreview }}</b> 币</span>
      <span class="gd-chip">🏆 最佳 <b class="mono">{{ best }}</b></span>
      <button class="gd-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <div class="gd-stage">
      <div class="gd-word">
        <span v-for="(c, i) in word" :key="i" class="gd-slot" :class="{ on: revealed[i] }">{{ revealed[i] ? c : '？' }}</span>
      </div>
      <div class="gd-msg" :class="{ bad: lastGain.startsWith('✗') }">{{ lastGain }}</div>
      <div class="gd-pool">
        <button
          v-for="(cell, i) in pool"
          :key="i"
          class="gd-char"
          :class="{ used: cell.used }"
          :disabled="cell.used"
          @click="pick(cell)"
        >{{ cell.ch }}</button>
      </div>
    </div>

    <div class="gd-keys">
      <button v-if="!started" class="gd-start" @click="startGame()">▶ 开始游戏</button>
      <button v-else class="gd-reset" @click="reset()">🔄 重置本局</button>
    </div>

    <div v-if="over" class="gd-mask">
      <div class="gd-result">
        <div class="gd-result-head"><b>{{ passed ? '🎉 达标！' : '💦 未达标' }}</b></div>
        <div class="gd-result-score">
          <span>得分 <b class="mono">{{ score }}</b>/{{ cfg.target }}</span>
          <span>猜出 <b class="mono">{{ solved }}</b> 道</span>
          <span v-if="passed" class="gd-gold">+{{ cfg.gold }} 游戏币</span>
        </div>
        <button class="gd-again" @click="reset()">🔄 再来一局</button>
      </div>
      <div v-if="passed" class="gd-fire">
        <span v-for="i in 20" :key="i" class="gd-spark" :style="{ '--dx': ((i * 41) % 220) - 110 + 'px', '--dy': ((i * 67) % 180) - 90 + 'px', animationDelay: (i % 6) * 0.05 + 's' }">✦</span>
      </div>
    </div>

    <div v-if="showInfo" class="gd-info-mask" @click.self="showInfo = false">
      <div class="gd-info-box">
        <div class="gd-info-head"><b>🥢 猜菜名 · 十模式说明</b><button class="gd-info-close" @click="showInfo = false">✕</button></div>
        <div class="gd-info-list">
          <div class="gd-info-row gd-info-rule">通用规则：屏幕上方是<b>藏起来的菜名</b>（？为未猜出的字），下方是候选字池 · <b>点候选字</b>：该字在菜名里就亮出来并 +30 分，不在就扣 1 条命 · 猜出整道菜名额外 +100 分（并按剩余命数加成）· 命耗尽或时间到就结算，达标发游戏币（超出目标最多 +50%）</div>
          <div v-for="(m, key) in MODES" :key="key" class="gd-info-row">
            <b class="gd-info-name">{{ m.label }}</b>
            <span class="gd-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gd-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 10px 22px; }
.gd-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.gd-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.gd-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.gd-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.gd-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.gd-stage { width: min(720px, 98%); min-height: 320px; border-radius: 16px; background: rgba(120, 84, 50, 0.16); border: 1px solid rgba(150, 110, 70, 0.35); box-shadow: 0 10px 28px rgba(93, 64, 55, 0.18); padding: 26px 18px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.gd-word { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.gd-slot { width: 62px; height: 62px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 30px; font-weight: 800; background: rgba(255, 252, 246, 0.9); border: 2px dashed rgba(150, 110, 70, 0.45); color: var(--muted); }
.gd-slot.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.12); color: var(--primary-strong); }
.gd-msg { min-height: 22px; font-size: 14px; font-weight: 800; color: var(--good-strong); }
.gd-msg.bad { color: var(--bad-strong); }
.gd-pool { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 660px; }
.gd-char { width: 56px; height: 56px; border-radius: 12px; font-size: 24px; font-weight: 800; cursor: pointer; color: var(--text); background: rgba(255, 252, 246, 0.9); border: 1px solid rgba(150, 110, 70, 0.4); transition: transform 0.08s, box-shadow 0.1s; }
.gd-char:hover:not(.used) { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(184, 68, 42, 0.2); }
.gd-char.used { opacity: 0.3; cursor: default; background: rgba(150, 110, 70, 0.12); }
.gd-keys { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.gd-start { padding: 12px 34px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; box-shadow: 0 6px 18px rgba(184, 68, 42, 0.35); }
.gd-reset { padding: 10px 24px; height: 46px; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.gd-mask { position: fixed; inset: 0; z-index: 320; background: rgba(20, 30, 40, 0.5); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.gd-result { width: min(460px, 92vw); max-height: 80vh; overflow: auto; background: rgba(255, 252, 246, 0.96); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 18px; padding: 18px 20px; box-shadow: 0 16px 44px rgba(30, 20, 12, 0.4); display: flex; flex-direction: column; gap: 10px; }
.gd-result-head { font-size: 18px; }
.gd-result-score { display: flex; gap: 14px; align-items: baseline; font-size: 14px; flex-wrap: wrap; }
.gd-gold { color: var(--good-strong); font-weight: 800; }
.gd-again { align-self: center; margin-top: 4px; padding: 10px 28px; border-radius: 999px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #e8703f, #c9542e); border: none; }
.gd-fire { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.gd-spark { position: absolute; font-size: 22px; color: var(--gold); animation: gdSpark 1.1s ease-out forwards; }
@keyframes gdSpark { from { transform: translate(0, 0) scale(0.6); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.4); opacity: 0; } }
.gd-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.gd-info-box { width: min(620px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.gd-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.gd-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.gd-info-list { display: flex; flex-direction: column; gap: 8px; }
.gd-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.gd-info-rule { display: block; border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; line-height: 1.7; }
.gd-info-rule b { color: var(--primary-strong); }
.gd-info-name { flex: 0 0 82px; color: var(--primary-strong); }
.gd-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
