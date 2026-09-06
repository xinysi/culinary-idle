<script setup>
// 火候炉（2026-09-06 顶部第三页小游戏）：指针摆动，点「定火」落在完美区间，连击越快奖励越丰
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const RUNNING = ref(false)
const ph = ref(0) // 指针相位 0-1
let rafId = null
let lastT = 0
const speedLevel = computed(() => player.minigames?.heat?.streak ?? 0) // 连击越快指针越快
const PERFECT_W = 0.16 // 完美区间宽（中心 ±8%）

function loop(t) {
  if (lastT) {
    const dt = (t - lastT) / 1000
    ph.value = (ph.value + dt * (0.35 + Math.min(1.2, speedLevel.value * 0.08))) % 1
  }
  lastT = t
  if (RUNNING.value) rafId = requestAnimationFrame(loop)
}
function start() {
  if (RUNNING.value) return
  RUNNING.value = true
  lastT = 0
  ph.value = 0
  rafId = requestAnimationFrame(loop)
}
function stop() {
  RUNNING.value = false
  if (rafId) cancelAnimationFrame(rafId)
}

const verdict = ref(null) // { type: 'perfect'|'good'|'miss' }
function strike() {
  if (!RUNNING.value) return
  const d = Math.abs(ph.value - 0.5)
  let type = 'miss'
  if (d <= PERFECT_W / 2) type = 'perfect'
  else if (d <= PERFECT_W) type = 'good'
  verdict.value = { type, at: ph.value }
  if (type !== 'miss') stop() // 定火后指针停住，防连点重复判定（2026-09-06）
  const mg = player.minigames.heat
  if (type === 'perfect') {
    mg.streak = (mg.streak ?? 0) + 1
    mg.bestStreak = Math.max(mg.bestStreak ?? 0, mg.streak)
  } else {
    mg.streak = 0
  }
  // 奖励：每 5 连完美发一次金币（当日限额 5 次）；练习模式不计
  if (type === 'perfect' && mg.streak > 0 && mg.streak % 5 === 0 && mg.day === todayKey()) {
    if ((mg.streak / 5) <= 5) {
      player.gainGold(50)
      ui.pushLog(`🔥 火候炉：${mg.streak} 连完美！+50 金币`, 'gain')
    }
  }
  if (type !== 'perfect' || mg.streak % 5 !== 0 || mg.day !== todayKey()) {
    // 无奖励不刷日志
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const zoneStyle = computed(() => {
  const left = (0.5 - PERFECT_W / 2) * 100
  const width = PERFECT_W * 100
  return { left: left + '%', width: width + '%' }
})
const needleStyle = computed(() => ({ left: (ph.value * 100) + '%' }))
const streak = computed(() => player.minigames?.heat?.streak ?? 0)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🔥 火候炉</h2>
        <p class="dim">指针来回摆动——在金黄区（完美）定火！每 5 连完美 +50 金币（当日最多 5 次）。连击越高指针越快。</p>
      </div>
      <div class="skill-head-right">
        <span class="badge badge-on">🔥 {{ streak }} 连击</span>
        <span class="dim mono">最佳 {{ player.minigames?.heat?.bestStreak ?? 0 }} 连</span>
      </div>
    </header>

    <div class="card heat-stage">
      <div class="heat-track">
        <div class="heat-perfect" :style="zoneStyle"></div>
        <div class="heat-needle" :style="needleStyle"></div>
      </div>
      <div class="heat-actions">
        <button v-if="!RUNNING" class="btn btn-primary" @click="start">开始</button>
        <button v-else class="btn btn-primary" @click="strike">🔥 定火！</button>
        <button v-if="RUNNING" class="btn btn-sm" @click="stop">停止</button>
      </div>
      <div v-if="verdict" class="heat-verdict" :class="verdict.type">
        {{ verdict.type === 'perfect' ? '🔥 完美定火！' : verdict.type === 'good' ? '✅ 不错…差一点' : '❌ 火候过了！连击中断' }}
      </div>
      <p class="dim" style="margin-top: 8px">奖励规则：每 5 连完美 +50 金币（当日最多 5 次 = 250 金币）；连击断档重新计数。</p>
    </div>
  </div>
</template>
