<script setup>
// 火候炉（2026-09-07 v4 改版）：十种模式分类（速度/双锅/精度参数化）· 单面板玩法 · 顶栏状态胶囊 · 模式说明弹窗
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const mode = ref('classic')
const METAS = {
  wide: { label: '新手宽区', speed: 0.25, every: 4, reward: 35, zoneW: 0.24, dual: false, desc: '慢速 · 完美区加宽 · 4 连 35 金 —— 新手友好' },
  slow: { label: '慢火单轨', speed: 0.22, every: 4, reward: 40, zoneW: 0.16, dual: false, desc: '慢速单轨 · 4 连 40 金' },
  classic: { label: '经典单轨', speed: 0.35, every: 5, reward: 50, zoneW: 0.16, dual: false, desc: '中速单轨 · 5 连 50 金 —— 标准体验' },
  fast: { label: '疾速单轨', speed: 0.5, every: 5, reward: 70, zoneW: 0.16, dual: false, desc: '快速单轨 · 5 连 70 金' },
  blitz: { label: '快燃挑战', speed: 0.62, every: 5, reward: 75, zoneW: 0.16, dual: false, desc: '高速单轨 · 5 连 75 金' },
  ultra: { label: '极限单轨', speed: 0.8, every: 5, reward: 110, zoneW: 0.16, dual: false, desc: '极速单轨 · 5 连 110 金 —— 高手向' },
  dual: { label: '双锅同调', speed: 0.3, every: 5, reward: 90, zoneW: 0.16, dual: true, desc: '双轨 · 双完美计数 5 连 90 金' },
  dual2: { label: '双锅疾速', speed: 0.42, every: 5, reward: 130, zoneW: 0.16, dual: true, desc: '双轨快速 · 双完美 5 连 130 金' },
  dual3: { label: '双锅极限', speed: 0.55, every: 5, reward: 180, zoneW: 0.16, dual: true, desc: '双轨极速 · 双完美 5 连 180 金 —— 极限同步' },
  precise: { label: '精准单轨', speed: 0.3, every: 4, reward: 80, zoneW: 0.1, dual: false, desc: '中速 · 完美区收窄至 10% · 4 连 80 金 —— 精准挑战' },
}
const showInfo = ref(false)

// 单一玩法槽位：切换模式即重置本条轨道
const slot = { running: false, ph: ref(0), ph2: ref(0), verdict: ref(null), raf: null, last: 0, vTimer: null }

function tick() {
  const m = METAS[mode.value]
  if (slot.last) {
    const d = (performance.now() - slot.last) / 1000
    const sp = m.speed * (1 + Math.min(1.2, (player.minigames?.heat?.streak ?? 0) * 0.08))
    slot.ph.value = (slot.ph.value + d * sp) % 1
    if (m.dual) slot.ph2.value = (slot.ph2.value + d * sp) % 1
  }
  slot.last = performance.now()
  if (slot.running) slot.raf = requestAnimationFrame(tick)
}
function startOne() {
  if (slot.running) return
  slot.running = true
  slot.last = 0
  slot.ph.value = 0
  slot.ph2.value = 0.12 // 双锅相位差 12%：完美区(±8%)重叠窗口存在，高难度双完美
  slot.raf = requestAnimationFrame(tick)
}
function stopOne() {
  slot.running = false
  if (slot.raf) cancelAnimationFrame(slot.raf)
}
onUnmounted(() => stopOne())

function atZone(ph, zoneW) {
  const d = Math.abs(ph - 0.5)
  if (d <= zoneW / 2) return 'perfect'
  if (d <= zoneW) return 'good'
  return 'miss'
}
function judge() {
  const m = METAS[mode.value]
  const r1 = atZone(slot.ph.value, m.zoneW)
  const r2 = m.dual ? atZone(slot.ph2.value, m.zoneW) : 'perfect'
  let type
  let superHit = false
  if (r1 === 'perfect' && r2 === 'perfect') { type = 'perfect'; superHit = m.dual }
  else if (r1 === 'perfect' || r2 === 'perfect') type = 'good'
  else type = 'miss'
  slot.verdict.value = type
  slot.verdictSuper = superHit
  // 判定限时显示：1.2s 后自动消失
  if (slot.vTimer) clearTimeout(slot.vTimer)
  slot.vTimer = setTimeout(() => { slot.verdict.value = null }, 1200)
  if (type !== 'miss') stopOne()
  const mg = player.minigames.heat
  mg.history = [...(mg.history ?? []), type].slice(-12)
  if (type === 'perfect') {
    mg.streak = (mg.streak ?? 0) + 1
    mg.bestStreak = Math.max(mg.bestStreak ?? 0, mg.streak)
    if (mg.streak % m.every === 0) {
      player.gainGold(m.reward)
      ui.pushLog(`🔥 火候炉：${m.label} ${mg.streak} 连完美！+${m.reward} 金币${superHit ? '（双锅大完美！）' : ''}`, 'gain')
    }
  } else {
    mg.streak = 0
  }
}
function switchMode(k) {
  mode.value = k
  stopOne()
  slot.verdict.value = null
}

const streak = computed(() => player.minigames?.heat?.streak ?? 0)
const bestStreak = computed(() => player.minigames?.heat?.bestStreak ?? 0)
const history = computed(() => player.minigames?.heat?.history ?? [])
const zoneStyle = computed(() => {
  const w = METAS[mode.value].zoneW
  return { left: (0.5 - w / 2) * 100 + '%', width: w * 100 + '%' }
})
const nextReward = computed(() => {
  const m = METAS[mode.value]
  return m.every - (streak.value % m.every)
})
</script>

<template>
  <div class="hz-page">
    <!-- 顶栏：模式胶囊 + 状态胶囊（连击/最佳靠右）+ 模式说明 -->
    <div class="hz-topbar">
      <button v-for="(m, key) in METAS" :key="key" class="hz-mode" :class="{ on: mode === key }" @click="switchMode(key)">{{ m.label }}</button>
      <span class="hz-chip" style="margin-left: auto">🎯 再 <b class="mono">{{ nextReward }}</b> 连奖</span>
      <span class="hz-chip">🔥 <b class="mono">{{ streak }}</b> 连击</span>
      <span class="hz-chip">🏆 最佳 <b class="mono">{{ bestStreak }}</b></span>
      <button class="hz-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>

    <!-- 单玩法面板：当前模式轨道（双锅为两条同步轨道） -->
    <div class="hz-box">
      <div class="hz-box-head">
        <span class="hz-box-tag">{{ METAS[mode].label }}</span>
        <span class="hz-box-reward">+{{ METAS[mode].reward }}金/{{ METAS[mode].every }}连{{ METAS[mode].dual ? '（双完美）' : '' }}</span>
      </div>
      <div class="hz-track hz-s">
        <div class="hz-perfect" :style="zoneStyle"></div>
        <div class="hz-needle" :style="{ left: slot.ph.value * 100 + '%' }"></div>
      </div>
      <div v-if="METAS[mode].dual" class="hz-track hz-s hz-tiny">
        <div class="hz-perfect" :style="zoneStyle"></div>
        <div class="hz-needle" :style="{ left: slot.ph2.value * 100 + '%' }"></div>
      </div>
      <div class="hz-acts">
        <button v-if="!slot.running" class="hz-mini hz-mini-gold" @click="startOne">开始</button>
        <button v-else class="hz-mini hz-mini-fire" @click="judge">{{ METAS[mode].dual ? '🔥 双锅定火' : '🔥 定火' }}</button>
      </div>
      <div v-if="slot.verdict.value" class="hz-v" :class="slot.verdict.value">
        {{ slot.verdict.value === 'perfect' ? (slot.verdictSuper ? '🎯 双锅大完美！' : '✨ 完美！') : slot.verdict.value === 'good' ? '👍 不错！' : '💨 偏了！' }}
      </div>
    </div>

    <!-- 最近记录条 -->
    <div class="hz-history">
      <span class="hz-history-label">最近定火</span>
      <span v-for="(h, i) in history" :key="i" class="hz-dot" :class="h">●</span>
      <span v-if="!history.length" class="dim">（暂无——挑一个模式开始，大厨！）</span>
    </div>

    <div v-if="showInfo" class="hz-info-mask" @click.self="showInfo = false">
      <div class="hz-info-box">
        <div class="hz-info-head"><b>🔥 火候炉 · 十种模式说明</b><button class="hz-info-close" @click="showInfo = false">✕</button></div>
        <div class="hz-info-list">
          <div class="hz-info-row hz-info-rule">通用规则：指针扫入定火金区即「完美」，相邻窄区为「不错」；连击越顺奖励越高 · 双锅模式需双轨同时完美计双完美</div>
          <div v-for="(m, key) in METAS" :key="key" class="hz-info-row">
            <b class="hz-info-name">{{ m.label }}</b>
            <span class="hz-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.hz-page { display: flex; flex-direction: column; gap: 12px; }
.hz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hz-mode { padding: 5px 12px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.hz-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.hz-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid rgba(217, 138, 43, 0.3); font-size: 12px; font-weight: 700; }
.hz-info-btn { padding: 5px 12px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.hz-box { background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.hz-box-head { display: flex; align-items: center; justify-content: space-between; }
.hz-box-tag { font-weight: 800; font-size: 14px; }
.hz-box-reward { font-size: 11px; color: var(--warn-strong); font-weight: 700; }
.hz-track { position: relative; width: 100%; height: 22px; border-radius: 999px; overflow: hidden; background: linear-gradient(90deg, #f3dcc0, #ffe9d2 30%, #ffe9d2 70%, #f3dcc0); box-shadow: inset 0 1px 4px rgba(120, 84, 50, 0.18); }
.hz-tiny { height: 16px; }
.hz-perfect { position: absolute; top: 0; bottom: 0; background: linear-gradient(180deg, #ffd98a, #f2b94f); box-shadow: 0 0 12px rgba(242, 185, 79, 0.8); border-radius: 999px; }
.hz-needle { position: absolute; top: -3px; bottom: -3px; width: 4px; background: #7a4a26; border-radius: 2px; box-shadow: 0 0 8px rgba(122, 74, 38, 0.55); }
.hz-acts { display: flex; gap: 8px; align-items: center; justify-content: center; }
.hz-mini { padding: 8px 22px; font-size: 14px; font-weight: 800; border: none; border-radius: 999px; cursor: pointer; color: #fff; }
.hz-mini-gold { background: linear-gradient(135deg, #eab04a, #c98e3f); }
.hz-mini-fire { background: linear-gradient(135deg, #f27c45, #d85c2c); }
.hz-v { font-size: 12px; font-weight: 700; }
.hz-v.perfect { color: var(--good-strong); }
.hz-v.good { color: var(--warn-strong); }
.hz-v.miss { color: var(--bad-strong); }
.hz-history { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 13px; }
.hz-history-label { font-weight: 700; }
.hz-dot { font-size: 13px; }
.hz-dot.perfect { color: var(--good-strong); }
.hz-dot.good { color: var(--warn-strong); }
.hz-dot.miss { color: var(--bad-strong); }
.hz-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.hz-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.hz-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.hz-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.hz-info-list { display: flex; flex-direction: column; gap: 8px; }
.hz-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.28); border-radius: 10px; padding: 8px 12px; }
.hz-info-rule { border-color: rgba(217, 138, 43, 0.45); background: rgba(234, 176, 74, 0.1); color: var(--text); font-size: 12.5px; }
.hz-info-name { flex: 0 0 96px; color: var(--primary-strong); }
.hz-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
