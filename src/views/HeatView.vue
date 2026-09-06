<script setup>
// 火候炉（2026-09-06 逐页重排版）：黄金横幅 + 大火候面板 + 定火大按钮 + 底部统计条
import { ref, computed, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'

const player = usePlayerStore()
const ui = useUiStore()

const RUNNING = ref(false)
const ph = ref(0)
let rafId = null
let lastT = 0
const PERFECT_W = 0.16

function loop(t) {
  if (lastT) ph.value = (ph.value + ((t - lastT) / 1000) * (0.35 + Math.min(1.2, (player.minigames?.heat?.streak ?? 0) * 0.08))) % 1
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
const verdict = ref(null)
function strike() {
  if (!RUNNING.value) return
  const d = Math.abs(ph.value - 0.5)
  let type = 'miss'
  if (d <= PERFECT_W / 2) type = 'perfect'
  else if (d <= PERFECT_W) type = 'good'
  verdict.value = type
  if (type !== 'miss') stop()
  const mg = player.minigames.heat
  mg.history = [...(mg.history ?? []), type].slice(-10)
  if (type === 'perfect') {
    mg.streak = (mg.streak ?? 0) + 1
    mg.bestStreak = Math.max(mg.bestStreak ?? 0, mg.streak)
  } else {
    mg.streak = 0
  }
}
function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}
const streak = computed(() => player.minigames?.heat?.streak ?? 0)
const bestStreak = computed(() => player.minigames?.heat?.bestStreak ?? 0)
const history = computed(() => player.minigames?.heat?.history ?? [])
const zoneStyle = { left: (0.5 - PERFECT_W / 2) * 100 + '%', width: PERFECT_W * 100 + '%' }
const needleStyle = computed(() => ({ left: ph.value * 100 + '%' }))
const nextReward = computed(() => 5 - (streak.value % 5))
onUnmounted(() => stop())
</script>

<template>
  <div class="hz-page">
    <!-- 黄金横幅 -->
    <div class="hz-hero">
      <div class="hz-hero-main">
        <div class="hz-hero-title">🔥 火候炉</div>
        <div class="hz-hero-desc">指针在火候条上摆动——把「定火」按在金黄区！每 5 连完美 +50 金币（每日上限 5 次）</div>
      </div>
      <div class="hz-hero-stats">
        <span class="hz-stat"><b class="mono">{{ streak }}</b> 连击</span>
        <span class="hz-stat">最佳 <b class="mono">{{ bestStreak }}</b></span>
        <span class="hz-stat">下次奖励 <b class="mono">再 {{ nextReward }} 连</b></span>
      </div>
    </div>

    <!-- 火候面板 -->
    <div class="hz-panel">
      <div class="hz-track">
        <div class="hz-perfect" :style="zoneStyle"></div>
        <div class="hz-needle" :style="needleStyle"></div>
      </div>
      <div class="hz-actions">
        <button v-if="!RUNNING" class="hz-btn hz-btn-gold" @click="start">🔥 开始</button>
        <button v-else class="hz-btn hz-btn-fire" @click="strike">🔥 定火！</button>
      </div>
      <div v-if="verdict" class="hz-verdict" :class="verdict">
        {{ verdict === 'perfect' ? '🔥 完美定火！+30% 经验加成' : verdict === 'good' ? '✅ 太棒了……差一点完美' : '❌ 火候过了！连击中断' }}
      </div>
    </div>

    <!-- 最近记录条 -->
    <div class="hz-history">
      <span class="hz-history-label">最近定火</span>
      <span v-for="(h, i) in history" :key="i" class="hz-dot" :class="h">●</span>
      <span v-if="!history.length" class="dim">（暂无——点击开始，大厨！）</span>
    </div>
  </div>
</template>
<style scoped>
.hz-page { display: flex; flex-direction: column; gap: 14px; }
.hz-hero {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 18px 22px;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(255, 199, 89, 0.32), rgba(230, 155, 40, 0.2));
  border: 1px solid rgba(217, 138, 43, 0.4);
}
.hz-hero-title { font-size: 24px; font-weight: 800; }
.hz-hero-desc { font-size: 12px; color: var(--muted); margin-top: 4px; max-width: 520px; }
.hz-hero-stats { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }
.hz-stat {
  background: rgba(255, 252, 246, 0.75); border: 1px solid rgba(217, 138, 43, 0.35);
  border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700;
}
.hz-panel {
  background: rgba(255, 252, 246, 0.8);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 26px 22px;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
}
.hz-track {
  position: relative; width: 100%; height: 44px;
  border-radius: 999px; overflow: hidden;
  background: linear-gradient(90deg, #7a4a26, #c98e3f 20%, #f2cf7d 50%, #c98e3f 80%, #7a4a26);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25);
}
.hz-perfect {
  position: absolute; top: 0; bottom: 0;
  background: linear-gradient(180deg, rgba(255, 236, 170, 0.95), rgba(255, 214, 100, 0.95));
  box-shadow: 0 0 18px rgba(255, 220, 120, 0.9);
  border-radius: 999px;
}
.hz-needle { position: absolute; top: -4px; bottom: -4px; width: 6px; background: #d95a38; border-radius: 3px; box-shadow: 0 0 10px rgba(217, 90, 56, 0.9); }
.hz-actions { display: flex; gap: 10px; }
.hz-btn { min-width: 190px; padding: 12px 26px; font-size: 17px; font-weight: 800; border: none; border-radius: 999px; cursor: pointer; color: #fff; }
.hz-btn-gold { background: linear-gradient(135deg, #eab04a, #c98e3f); box-shadow: 0 4px 14px rgba(201, 142, 63, 0.4); }
.hz-btn-fire { background: linear-gradient(135deg, #f27c45, #d85c2c); box-shadow: 0 4px 14px rgba(216, 92, 44, 0.45); }
.hz-btn:hover { transform: translateY(-2px); }
.hz-verdict { font-size: 15px; font-weight: 800; padding: 8px 16px; border-radius: 999px; }
.hz-verdict.perfect { background: rgba(87, 168, 97, 0.15); color: var(--good-strong); }
.hz-verdict.good { background: rgba(230, 172, 72, 0.2); color: var(--warn-strong); }
.hz-verdict.miss { background: rgba(217, 75, 63, 0.12); color: var(--bad-strong); }
.hz-history { display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 13px; }
.hz-history-label { font-weight: 700; }
.hz-dot { font-size: 14px; }
.hz-dot.perfect { color: var(--good-strong); }
.hz-dot.good { color: var(--warn-strong); }
.hz-dot.miss { color: var(--bad-strong); }
</style>
