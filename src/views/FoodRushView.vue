<script setup>
// 大胃王挑战（2026-09-06 顶部第三页）：60 秒连点「干饭」，达到档位领奖（每日只领一次，取最高档）
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const RUNNING = ref(false)
const REMAIN = ref(60)
const bowls = ref(0)
const done = ref(false)
let timerId = null
// 暴食（2026-09-06）：连点间隔 <1.2s 累计连击，10 连触发暴食 → 3 秒内每口双倍
let combo = 0
let lastEat = 0
const raging = ref(false)
let rageUntil = 0

const TIERS = [
  { need: 120, gold: 40, label: '120 碗' },
  { need: 200, gold: 60, label: '200 碗' },
  { need: 300, gold: 100, label: '300 碗' },
]
function start() {
  if (RUNNING.value) return
  RUNNING.value = true
  done.value = false
  bowls.value = 0
  REMAIN.value = 60
  timerId = setInterval(() => {
    REMAIN.value--
    if (REMAIN.value <= 0) finish()
  }, 1000)
}
function eat() {
  if (!RUNNING.value) return
  const now = performance.now()
  if (now - lastEat < 1200) combo++
  else combo = 1
  lastEat = now
  if (combo >= 10 && !raging.value) {
    raging.value = true
    rageUntil = now + 3000
  }
  if (rageUntil && now > rageUntil) raging.value = false
  bowls.value += raging.value ? 2 : 1
}
function finish() {
  if (!RUNNING.value) return
  RUNNING.value = false
  clearInterval(timerId)
  done.value = true
  const mg = player.minigames.foodrush
  const today = todayKey()
  if (mg.day !== today) mg.day = today
  mg.best = Math.max(mg.best ?? 0, bowls.value)
  // 每日只结算一次奖励（取本次达到的最高档）
  const bestReached = [...TIERS].reverse().find((t) => bowls.value >= t.need)
  if (bestReached && mg.rewarded < bestReached.gold) {
    const gain = bestReached.gold - (mg.rewarded ?? 0)
    mg.rewarded = bestReached.gold
    player.gainGold(gain)
    ui.pushLog(`🍖 大胃王挑战：${bowls.value} 碗 → +${gain} 金币（今日奖励已领 ${mg.rewarded} 金）`, 'gain')
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const mg = computed(() => player.minigames?.foodrush ?? {})
const nextTier = computed(() => TIERS.find((t) => bowls.value >= t.need) ?? null)
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🍖 大胃王挑战</h2>
        <p class="dim">60 秒内疯狂点「干饭」喂饱大胃王！每日结算一次奖励（取最高档）：120 碗 +40 金 / 200 碗 +60 金 / 300 碗 +100 金。连续点击可触发<b>暴食</b>：10 连击后 3 秒每口 ×2！</p>
      </div>
      <div class="skill-head-right">
        <span class="badge badge-on">🏆 {{ mg.best ?? 0 }} 碗</span>
        <span class="dim mono">今日奖励 {{ mg.rewarded ?? 0 }}/100 金</span>
      </div>
    </header>

    <div class="card game-stage rush-stage">
      <div class="rush-counter">
        <span class="mono rush-bowls">{{ bowls }}</span>
        <span class="dim">碗 · 剩余 <b class="mono">{{ REMAIN }}</b> 秒</span>
      </div>
      <div class="rush-tiers">
        <span v-for="t in TIERS" :key="t.need" class="rush-tier" :class="{ on: bowls >= t.need }">
          {{ t.label }} <b>+{{ t.gold }}金</b>
        </span>
      </div>
      <div class="rush-play">
        <button v-if="!RUNNING" class="btn btn-primary rush-btn" @click="start">🍖 开始挑战（60 秒）</button>
        <button v-else class="btn btn-primary rush-btn rush-eat" :class="{ 'rush-rage': raging }" @click="eat">
          {{ raging ? '🤯 暴食中！每口 ×2' : '🍚 干饭！' }}
        </button>
      </div>
      <div v-if="done" class="heat-verdict" :class="{ perfect: nextTier, miss: !nextTier }">
        {{ nextTier ? `🍖 达成 ${nextTier.label}！奖励已结算` : '💪 惜败！差一点就达标了' }}
      </div>
    </div>
  </div>
</template>
