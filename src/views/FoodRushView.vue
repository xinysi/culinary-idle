<script setup>
// 大胃王挑战（2026-09-07 十模式版：15s→300s 时长梯度 · 绿色玻璃面板 ← 连连看配色 · 「📖 模式说明」弹窗）
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
  nibble: { label: '轻食 15s', dur: 15, tiers: [{ need: 50, gold: 30 }, { need: 90, gold: 50 }, { need: 130, gold: 70 }], desc: '15 秒 · 50/90/130 碗 → 30/50/70 金 —— 零碎时间的小挑战' },
  sprint: { label: '冲刺 30s', dur: 30, tiers: [{ need: 80, gold: 40 }, { need: 140, gold: 70 }, { need: 200, gold: 110 }], desc: '30 秒 · 80/140/200 碗 → 40/70/110 金 —— 手速爆发' },
  midnight: { label: '宵夜 45s', dur: 45, tiers: [{ need: 100, gold: 35 }, { need: 180, gold: 60 }, { need: 260, gold: 95 }], desc: '45 秒 · 100/180/260 碗 → 35/60/95 金' },
  classic: { label: '经典 60s', dur: 60, tiers: [{ need: 120, gold: 40 }, { need: 200, gold: 60 }, { need: 300, gold: 100 }], desc: '60 秒 · 120/200/300 碗 → 40/60/100 金 —— 标准体验' },
  greedy: { label: '贪吃 75s', dur: 75, tiers: [{ need: 140, gold: 45 }, { need: 240, gold: 80 }, { need: 340, gold: 120 }], desc: '75 秒 · 140/240/340 碗 → 45/80/120 金' },
  feast: { label: '盛宴 90s', dur: 90, tiers: [{ need: 160, gold: 50 }, { need: 280, gold: 90 }, { need: 400, gold: 140 }], desc: '90 秒 · 160/280/400 碗 → 50/90/140 金' },
  marathon: { label: '马拉松 120s', dur: 120, tiers: [{ need: 200, gold: 70 }, { need: 350, gold: 110 }, { need: 500, gold: 160 }], desc: '120 秒 · 200/350/500 碗 → 70/110/160 金 —— 持久战' },
  epic: { label: '史诗 180s', dur: 180, tiers: [{ need: 300, gold: 100 }, { need: 500, gold: 160 }, { need: 700, gold: 220 }], desc: '180 秒 · 300/500/700 碗 → 100/160/220 金' },
  god: { label: '神胃 240s', dur: 240, tiers: [{ need: 380, gold: 130 }, { need: 620, gold: 200 }, { need: 860, gold: 270 }], desc: '240 秒 · 380/620/860 碗 → 130/200/270 金 —— 超长耐力' },
  immortal: { label: '无限 300s', dur: 300, tiers: [{ need: 450, gold: 150 }, { need: 700, gold: 220 }, { need: 950, gold: 300 }], desc: '300 秒 · 450/700/950 碗 → 150/220/300 金 —— 终极盛宴' },
}
const showInfo = ref(false)
const TIERS = computed(() => MODES[mode.value].tiers)
const tierTotal = computed(() => TIERS.value.reduce((s, t) => s + t.gold, 0))
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
const progress = computed(() => Math.min(100, (bowls.value / TIERS.value[TIERS.value.length - 1].need) * 100))
const doneToday = computed(() => mg.value.day === todayKey())
</script>

<template>
  <div class="fs-page">
    <div class="fs-topbar">
      <button v-for="(m, key) in MODES" :key="key" class="fs-mode" :class="{ on: mode === key }" @click="mode = key; reset()">{{ m.label }}</button>
      <span class="fs-chip">🏆 最佳 <b class="mono">{{ mg.best ?? 0 }}</b> 碗</span>
      <span class="fs-chip" style="margin-left: auto">💰 今日 {{ mg.rewarded ?? 0 }}/{{ tierTotal }} 金</span>
    </div>

    <div class="fs-bowl">
      <div class="fs-bowl-emoji">🍚</div>
      <div class="fs-bowl-num"><b class="mono">{{ bowls }}</b> 碗</div>
      <div class="fs-timer">剩余 <b class="mono">{{ REMAIN }}</b> 秒</div>
      <div class="fs-progress"><div class="fs-progress-fill" :style="{ width: progress + '%' }"></div></div>
      <div class="fs-tiers">
        <span v-for="t in TIERS" :key="t.need" class="fs-tier" :class="{ on: bowls >= t.need }">{{ t.need }} 碗 +{{ t.gold }}金</span>
      </div>
    </div>

    <div class="fs-play">
      <button v-if="!RUNNING" class="fs-btn" @click="start">🍖 开始挑战（{{ MODES[mode].dur }} 秒）</button>
      <button v-else class="fs-btn fs-eat" :class="{ 'fs-rage': raging }" @click="eat">
        {{ raging ? '🤯 暴食中！每口 ×2' : '🍚 干饭！' }}
      </button>
      <button class="fs-info-btn" @click="showInfo = true">📖 模式说明</button>
    </div>
    <div v-if="done" class="fs-done" :class="{ ok: bowls >= TIERS[0].need }">
      {{ bowls >= TIERS[0].need ? `🍖 达成 ${[...TIERS].reverse().find((t) => bowls >= t.need)?.need ?? ''} 碗档！奖励已结算` : '💪 惜败！差一点就达标了' }}
    </div>
    <div v-if="showInfo" class="fs-info-mask" @click.self="showInfo = false">
      <div class="fs-info-box">
        <div class="fs-info-head"><b>🍖 大胃王 · 十种模式说明</b><button class="fs-info-close" @click="showInfo = false">✕</button></div>
        <div class="fs-info-list">
          <div class="fs-info-row fs-info-rule">通用规则：快速连点 10 下触发「暴食」×2（持续 3 秒）· 每局结算达标最高档金币</div>
          <div v-for="(m, key) in MODES" :key="key" class="fs-info-row">
            <b class="fs-info-name">{{ m.label }}</b>
            <span class="fs-info-desc">{{ m.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.fs-page { display: flex; flex-direction: column; gap: 14px; align-items: center; padding: 4px 0 12px; }
.fs-topbar { display: flex; gap: 8px; width: 100%; flex-wrap: wrap; align-items: center; }
.fs-mode { padding: 6px 14px; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 12px; border: 1px dashed rgba(150, 110, 70, 0.4); background: rgba(255, 252, 246, 0.8); color: var(--muted); }
.fs-mode.on { border-style: solid; border-color: var(--primary-strong); background: rgba(217, 90, 56, 0.14); color: var(--primary-strong); }
.fs-chip { padding: 5px 12px; border-radius: 999px; background: rgba(255, 252, 246, 0.8); border: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.fs-info-btn { padding: 6px 16px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 12px; color: #fff; background: linear-gradient(135deg, #72b864, #589c4b); border: none; }
.fs-bowl {
  width: min(420px, 92%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px 20px; border-radius: 18px;
  background: rgba(150, 110, 70, 0.16); /* 与连连看大框一致的棕灰玻璃 */
  border: 1px solid rgba(150, 110, 70, 0.3);
  box-shadow: 0 10px 28px rgba(93, 64, 55, 0.14);
}
.fs-bowl-emoji { font-size: 52px; }
.fs-bowl-num { font-size: 20px; font-weight: 800; }
.fs-bowl-num b { font-size: 36px; color: var(--good-strong); }
.fs-timer { font-size: 14px; }
.fs-progress { width: 100%; height: 10px; border-radius: 999px; background: rgba(88, 156, 75, 0.18); overflow: hidden; }
.fs-progress-fill { height: 100%; background: linear-gradient(90deg, #72b864, #589c4b); border-radius: 999px; transition: width 0.2s ease; }
.fs-tiers { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.fs-tier { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: rgba(255, 252, 246, 0.7); color: var(--muted); }
.fs-tier.on { background: rgba(87, 168, 97, 0.18); color: var(--good-strong); font-weight: 700; }
.fs-play { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
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
.fs-info-mask { position: fixed; inset: 0; z-index: 300; background: rgba(30, 20, 12, 0.45); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); }
.fs-info-box { width: min(560px, 92vw); max-height: 76vh; overflow: auto; background: rgba(255, 252, 246, 0.94); border: 1px solid rgba(150, 110, 70, 0.35); border-radius: 16px; padding: 16px 18px; backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(50, 30, 20, 0.35); }
.fs-info-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; }
.fs-info-close { cursor: pointer; border: none; background: rgba(150, 110, 70, 0.15); border-radius: 999px; width: 30px; height: 30px; font-weight: 700; color: var(--text); }
.fs-info-list { display: flex; flex-direction: column; gap: 8px; }
.fs-info-row { display: flex; align-items: baseline; gap: 10px; background: rgba(255, 251, 244, 0.8); border: 1px solid rgba(150, 110, 70, 0.2); border-radius: 10px; padding: 8px 12px; }
.fs-info-rule { border-color: rgba(88, 156, 75, 0.35); background: rgba(114, 184, 100, 0.1); color: var(--text); font-size: 12.5px; }
.fs-info-name { flex: 0 0 108px; color: var(--primary-strong); }
.fs-info-desc { flex: 1; font-size: 12.5px; color: var(--muted); }
</style>
