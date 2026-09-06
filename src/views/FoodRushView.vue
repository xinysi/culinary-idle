<script setup>
// 大胃王挑战（2026-09-06 逐页重排版：大碗面板 + 档位进度 + 大按钮）
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
let combo = 0
let lastEat = 0
const raging = ref(false)
let rageUntil = 0
const mode = ref('classic')
const MODES = {
  classic: { label: '经典 60s', dur: 60, tiers: [{ need: 120, gold: 40, label: '120 碗' }, { need: 200, gold: 60, label: '200 碗' }, { need: 300, gold: 100, label: '300 碗' }] },
  sprint: { label: '冲刺 30s', dur: 30, tiers: [{ need: 80, gold: 40, label: '80 碗' }, { need: 140, gold: 70, label: '140 碗' }, { need: 200, gold: 110, label: '200 碗' }] },
  marathon: { label: '马拉松 120s', dur: 120, tiers: [{ need: 200, gold: 70, label: '200 碗' }, { need: 350, gold: 110, label: '350 碗' }, { need: 500, gold: 160, label: '500 碗' }] },
}
const TIERS = computed(() => MODES[mode.value].tiers)
function reset() {
  RUNNING.value = false
  if (timerId) clearInterval(timerId)
  done.value = false
  bowls.value = 0
  REMAIN.value = MODES[mode.value].dur
  combo = 0
  lastEat = 0
  raging.value = false
  rageUntil = 0
}
function start() {
  if (RUNNING.value) return
  RUNNING.value = true
  done.value = false
  bowls.value = 0
  REMAIN.value = MODES[mode.value].dur
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
  if (!mg) player.minigames.foodrush = { day: 0, best: 0, rewarded: 0 }
  mg.best = Math.max(mg.best ?? 0, bowls.value)
  mg.earned = (mg.earned ?? 0) // 累计占位（可选展示）
  const bestReached = [...TIERS].reverse().find((t) => bowls.value >= t.need)
  if (bestReached) {
    // 每局均可结算（2026-09-07 取消每日一次限制）
    mg.rewarded = (mg.rewarded ?? 0) + bestReached.gold
    player.gainGold(bestReached.gold)
    ui.pushLog(`🍖 大胃王挑战：${bowls.value} 碗 → +${bestReached.gold} 金币`, 'gain')
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const mg = computed(() => player.minigames?.foodrush ?? {})
const progress = computed(() => Math.min(100, (bowls.value / 300) * 100))
const doneToday = computed(() => mg.value.day === todayKey())
</script>

<template>
  <div class="fs-page">
    <div class="fs-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="fs-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="fs-chip">🏆 最佳 <b class="mono">{{ mg.best ?? 0 }}</b> 碗</span>
      <span class="fs-chip" style="margin-left: auto">💰 今日 {{ mg.rewarded ?? 0 }}/160 金</span>
    </div>

    <div class="fs-bowl">
      <div class="fs-bowl-emoji">🍚</div>
      <div class="fs-bowl-num"><b class="mono">{{ bowls }}</b> 碗</div>
      <div class="fs-timer">剩余 <b class="mono">{{ REMAIN }}</b> 秒</div>
      <div class="fs-progress"><div class="fs-progress-fill" :style="{ width: progress + '%' }"></div></div>
      <div class="fs-tiers">
        <span v-for="t in TIERS" :key="t.need" class="fs-tier" :class="{ on: bowls >= t.need }">{{ t.label }} +{{ t.gold }}金</span>
      </div>
    </div>

    <div class="fs-play">
      <button v-if="!RUNNING" class="fs-btn" @click="start">🍖 开始挑战（{{ MODES[mode].dur }} 秒）</button>
      <button v-else class="fs-btn fs-eat" :class="{ 'fs-rage': raging }" @click="eat">
        {{ raging ? '🤯 暴食中！每口 ×2' : '🍚 干饭！' }}
      </button>
    </div>
    <div v-if="done" class="fs-done" :class="{ ok: bowls >= 120 }">
      {{ bowls >= 120 ? `🍖 达成 ${[...TIERS].reverse().find((t) => bowls >= t.need)?.label ?? ''}！奖励已结算` : '💪 惜败！差一点就达标了' }}
    </div>
    <div class="fs-tip">快速连点 10 下触发「暴食」×2 · 每日结算取最高档</div>
  </div>
</template>
<style scoped>
.fs-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.fs-topbar { display: flex; gap: 8px; width: 100%; }
.fs-mode { padding: 6px 14px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.fs-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.fs-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.fs-bowl {
  width: min(420px, 92%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px 20px; border-radius: 20px;
  background: linear-gradient(160deg, rgba(255, 199, 89, 0.2), rgba(217, 90, 56, 0.12));
  border: 1px solid rgba(217, 138, 43, 0.35);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.15);
}
.fs-bowl-emoji { font-size: 52px; }
.fs-bowl-num { font-size: 20px; font-weight: 800; }
.fs-bowl-num b { font-size: 36px; color: var(--primary-strong); }
.fs-timer { font-size: 14px; }
.fs-progress { width: 100%; height: 10px; border-radius: 999px; background: rgba(150, 110, 70, 0.2); overflow: hidden; }
.fs-progress-fill { height: 100%; background: linear-gradient(90deg, #eab04a, #d95a38); border-radius: 999px; transition: width 0.2s ease; }
.fs-tiers { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.fs-tier { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: rgba(255, 252, 246, 0.7); color: var(--muted); }
.fs-tier.on { background: rgba(87, 168, 97, 0.18); color: var(--good-strong); font-weight: 700; }
.fs-play { display: flex; justify-content: center; }
.fs-btn {
  min-width: 280px; padding: 16px 36px; font-size: 19px; font-weight: 800; color: #fff;
  border: none; border-radius: 999px; cursor: pointer;
  background: linear-gradient(135deg, #d95a38, #b8442a);
  box-shadow: 0 6px 18px rgba(184, 68, 42, 0.4);
}
.fs-eat { background: linear-gradient(135deg, #f27c45, #d85c2c); }
.fs-rage { background: linear-gradient(135deg, #d94b3f, #b23a2f); animation: fsPop 0.25s ease infinite; }
@keyframes fsPop { 0% { transform: scale(1); } 50% { transform: scale(0.96); } 100% { transform: scale(1); } }
.fs-done { font-weight: 800; color: var(--bad-strong); }
.fs-done.ok { color: var(--good-strong); }
.fs-tip { color: var(--muted); font-size: 12px; }
</style>
