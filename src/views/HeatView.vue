<script setup>
// 火候炉（2026-09-07 v3 改版）：无顶部大框（参考拼图顶栏胶囊）· 三种玩法同屏同奏（条变小、按钮变小）
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const PERFECT_W = 0.16

// 三个独立玩法面板：每条轨道独立开/定火，共享连击与奖励
const classic = { running: false, ph: ref(0), verdict: ref(null), raf: null, last: 0 }
const dual = { running: false, ph: ref(0), ph2: ref(0), verdict: ref(null), raf: null, last: 0 }
const blitz = { running: false, ph: ref(0), verdict: ref(null), raf: null, last: 0 }

function tick(slot, speed) {
  if (slot.last) {
    const d = (performance.now() - slot.last) / 1000
    const sp = speed * (1 + Math.min(1.2, (player.minigames?.heat?.streak ?? 0) * 0.08))
    slot.ph.value = (slot.ph.value + d * sp) % 1
    if (slot.ph2) slot.ph2.value = (slot.ph2.value + d * sp) % 1
  }
  slot.last = performance.now()
  if (slot.running) slot.raf = requestAnimationFrame(() => tick(slot, speed))
}
function startOne(slot, speed) {
  if (slot.running) return
  slot.running = true
  slot.last = 0
  slot.ph.value = 0
  if (slot.ph2) slot.ph2.value = 0.5
  slot.raf = requestAnimationFrame(() => tick(slot, speed))
}
function stopOne(slot) {
  slot.running = false
  if (slot.raf) cancelAnimationFrame(slot.raf)
}
onUnmounted(() => { stopOne(classic); stopOne(dual); stopOne(blitz) })

function atZone(ph) {
  const d = Math.abs(ph - 0.5)
  if (d <= PERFECT_W / 2) return 'perfect'
  if (d <= PERFECT_W) return 'good'
  return 'miss'
}
function judge(slot, modeKey, multi = false) {
  const m = METAS[modeKey]
  const r1 = atZone(slot.ph.value)
  const r2 = multi ? atZone(slot.ph2.value) : 'perfect'
  let type
  let superHit = false
  if (r1 === 'perfect' && r2 === 'perfect') { type = 'perfect'; superHit = multi }
  else if (r1 === 'perfect' || r2 === 'perfect') type = 'good'
  else type = 'miss'
  slot.verdict.value = type
  slot.verdictSuper = superHit
  if (type !== 'miss') stopOne(slot)
  const mg = player.minigames.heat
  mg.history = [...(mg.history ?? []), type].slice(-12)
  if (type === 'perfect') {
    mg.streak = (mg.streak ?? 0) + 1
    mg.bestStreak = Math.max(mg.bestStreak ?? 0, mg.streak)
    if (mg.streak % m.every === 0 && mg.day === todayKey() && mg.streak / m.every <= 5) {
      player.gainGold(m.reward)
      ui.pushLog(`🔥 火候炉：${m.label} ${mg.streak} 连完美！+${m.reward} 金币${superHit ? '（双锅大完美！）' : ''}`, 'gain')
    }
  } else {
    mg.streak = 0
  }
}
function todayKey() {
  const t = new Date()
  return '' + t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate()
}

const streak = computed(() => player.minigames?.heat?.streak ?? 0)
const bestStreak = computed(() => player.minigames?.heat?.bestStreak ?? 0)
const history = computed(() => player.minigames?.heat?.history ?? [])
const zoneStyle = { left: (0.5 - PERFECT_W / 2) * 100 + '%', width: PERFECT_W * 100 + '%' }
const METAS = {
  classic: { label: '经典单轨', every: 5, reward: 50 },
  dual: { label: '双锅同调', every: 5, reward: 90 },
  blitz: { label: '快燃挑战', every: 5, reward: 70 },
}
const nextReward = computed(() => {
  const m = METAS.classic
  return m.every - (streak.value % m.every)
})
</script>

<template>
  <div class="hz-page">
    <!-- 顶栏（参考美食拼图：一行胶囊，无大框） -->
    <div class="hz-topbar">
      <span class="hz-chip"><b class="mono">{{ streak }}</b> 连击</span>
      <span class="hz-chip">最佳 <b class="mono">{{ bestStreak }}</b></span>
      <span class="hz-chip" style="margin-left:auto">下次 <b class="mono">再 {{ nextReward }} 连</b> 奖励</span>
      <span class="hz-chip">🎯 定火金区 · 每 5 连完美发奖（当日 5 次）</span>
    </div>

    <!-- 三玩法同屏：每条轨道独立开/定火 -->
    <div class="hz-grid">
      <!-- 经典单轨 -->
      <div class="hz-box">
        <div class="hz-box-head">
          <span class="hz-box-tag">经典单轨</span>
          <span class="hz-box-reward">+50金/5连</span>
        </div>
        <div class="hz-track hz-s">
          <div class="hz-perfect" :style="zoneStyle"></div>
          <div class="hz-needle" :style="{ left: classic.ph.value * 100 + '%' }"></div>
        </div>
        <div class="hz-acts">
          <button v-if="!classic.running" class="hz-mini hz-mini-gold" @click="startOne(classic, 0.35)">开始</button>
          <button v-else class="hz-mini hz-mini-fire" @click="judge(classic, 'classic')">🔥 定火</button>
        </div>
        <div v-if="classic.verdict" class="hz-v" :class="classic.verdict">{{ classic.verdict === 'perfect' ? '完美！' : classic.verdict === 'good' ? '不错' : '过了' }}</div>
      </div>

      <!-- 双锅同调 -->
      <div class="hz-box">
        <div class="hz-box-head">
          <span class="hz-box-tag">双锅同调</span>
          <span class="hz-box-reward">+90金/5连（双完美）</span>
        </div>
        <div class="hz-track hz-s hz-tiny">
          <div class="hz-perfect" :style="zoneStyle"></div>
          <div class="hz-needle" :style="{ left: dual.ph.value * 100 + '%' }"></div>
        </div>
        <div class="hz-track hz-s hz-tiny">
          <div class="hz-perfect" :style="zoneStyle"></div>
          <div class="hz-needle" :style="{ left: dual.ph2.value * 100 + '%' }"></div>
        </div>
        <div class="hz-acts">
          <button v-if="!dual.running" class="hz-mini hz-mini-gold" @click="startOne(dual, 0.3)">开始</button>
          <button v-else class="hz-mini hz-mini-fire" @click="judge(dual, 'dual', true)">🔥 双锅定火</button>
        </div>
        <div v-if="dual.verdict" class="hz-v" :class="dual.verdict">{{ dual.verdict === 'perfect' ? (dual.verdictSuper ? '🎯 双锅大完美！' : '完美！') : dual.verdict === 'good' ? '不错' : '过了' }}</div>
      </div>

      <!-- 快燃挑战 -->
      <div class="hz-box">
        <div class="hz-box-head">
          <span class="hz-box-tag">快燃挑战</span>
          <span class="hz-box-reward">+70金/5连（高速）</span>
        </div>
        <div class="hz-track hz-s">
          <div class="hz-perfect" :style="zoneStyle"></div>
          <div class="hz-needle" :style="{ left: blitz.ph.value * 100 + '%' }"></div>
        </div>
        <div class="hz-acts">
          <button v-if="!blitz.running" class="hz-mini hz-mini-gold" @click="startOne(blitz, 0.62)">开始</button>
          <button v-else class="hz-mini hz-mini-fire" @click="judge(blitz, 'blitz')">🔥 定火</button>
        </div>
        <div v-if="blitz.verdict" class="hz-v" :class="blitz.verdict">{{ blitz.verdict === 'perfect' ? '完美！' : blitz.verdict === 'good' ? '不错' : '过了' }}</div>
      </div>
    </div>

    <!-- 最近记录条 -->
    <div class="hz-history">
      <span class="hz-history-label">最近定火</span>
      <span v-for="(h, i) in history" :key="i" class="hz-dot" :class="h">●</span>
      <span v-if="!history.length" class="dim">（暂无——挑一个玩法开始，大厨！）</span>
    </div>
  </div>
</template>
<style scoped>
.hz-page { display: flex; flex-direction: column; gap: 12px; }
.hz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hz-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid rgba(217, 138, 43, 0.3); font-size: 12px; font-weight: 700; }
.hz-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.hz-box { background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.hz-box-head { display: flex; align-items: center; justify-content: space-between; }
.hz-box-tag { font-weight: 800; font-size: 14px; }
.hz-box-reward { font-size: 11px; color: var(--warn-strong); font-weight: 700; }
.hz-track { position: relative; width: 100%; height: 22px; border-radius: 999px; overflow: hidden; background: linear-gradient(90deg, #7a4a26, #c98e3f 20%, #f2cf7d 50%, #c98e3f 80%, #7a4a26); box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.22); }
.hz-tiny { height: 16px; }
.hz-perfect { position: absolute; top: 0; bottom: 0; background: linear-gradient(180deg, rgba(255, 236, 170, 0.95), rgba(255, 214, 100, 0.95)); box-shadow: 0 0 10px rgba(255, 220, 120, 0.9); border-radius: 999px; }
.hz-needle { position: absolute; top: -3px; bottom: -3px; width: 4px; background: #d95a38; border-radius: 2px; box-shadow: 0 0 8px rgba(217, 90, 56, 0.9); }
.hz-acts { display: flex; gap: 8px; align-items: center; }
.hz-mini { padding: 5px 14px; font-size: 12px; font-weight: 800; border: none; border-radius: 999px; cursor: pointer; color: #fff; }
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
</style>
