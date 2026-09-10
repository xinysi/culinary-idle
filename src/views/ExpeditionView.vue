<script setup>
// 远行采集队（长线挂机线）— 2026-09-09 新增，参照 Rocky Idle 的 Runs：
// 每条线路多个槽位，小时级周期，到期领取产出（领取后自动开始下一轮）。
// 产出为既有物品，不参与技能经验；熟练度按累计完成次数升档（产量 +10%/档、稀有率 +0.5%/档）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { EXPEDITIONS, expeditionTier, expeditionYieldMult, EXPEDITION_TIER_STEPS } from '../game/data/expeditions.js'
import { getItem } from '../game/data/items.js'
import { getSkillDef } from '../game/data/skills.js'
import ProgressBar from '../components/ProgressBar.vue'
import ItemImg from '../components/ItemImg.vue'

const player = usePlayerStore()
const ui = useUiStore()

// 依赖 ui.loopTick：引擎每 100ms tick 一次，驱动倒计时实时刷新
const lines = computed(() => {
  ui.loopTick
  const now = Date.now()
  return EXPEDITIONS.map((def) => {
    const st = player.expeditionState(def.id)
    const unlocked = player.expeditionUnlocked(def.id)
    const tier = expeditionTier(st?.completions ?? 0)
    return {
      def,
      unlocked,
      tier,
      completions: st?.completions ?? 0,
      nextTier: EXPEDITION_TIER_STEPS[tier] ?? null,
      slots: def.slots.map((slot, i) => {
        const state = st?.slots?.[i] ?? null
        return {
          slot,
          index: i,
          state,
          slotUnlocked: player.expeditionSlotUnlocked(def.id, i),
          ready: !!state && now >= state.readyAt,
          remainMs: state ? Math.max(0, state.readyAt - now) : 0,
          totalMs: slot.hours * 3600_000,
        }
      }),
    }
  })
})

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s % 60} 秒`
  return `${s} 秒`
}
function poolText(slot) {
  return slot.pool.map((id) => getItem(id)?.name ?? id).join('、')
}
function expectCount(slot, tier) {
  return Math.max(1, Math.round(slot.hours * 5 * expeditionYieldMult(tier)))
}
function start(lineId, i) {
  const r = player.expeditionStart(lineId, i)
  if (!r.ok) ui.pushLog(r.msg, 'warn')
}
function claim(lineId, i) {
  player.expeditionClaim(lineId, i) // 成功由 expedition:claim 事件推送日志
}
function stop(lineId, i) {
  if (player.expeditionStop(lineId, i)) ui.pushLog('已撤回该槽位（本轮进度放弃）', 'info')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🚢 远行采集队</h2>
        <p class="dim">派出采集队远行，<b>小时级</b>周期自动带回材料；到期领取，领取后自动开始下一轮（离线期间照常计时，不叠加）。</p>
      </div>
    </header>

    <div class="card">
      <p class="dim" style="margin: 0 0 10px">
        每槽每轮产出 ≈ 周期小时数 × 5 个；<b>熟练度</b>按累计完成次数升档（
        {{ EXPEDITION_TIER_STEPS.join(' / ') }} 次），每档产量 +10%、稀有率 +0.5%。
        本系统<b>不提供技能经验</b>，只补材料与收集。
      </p>
    </div>

    <div v-for="line in lines" :key="line.def.id" class="card exp-line">
      <div class="exp-line-head">
        <h3>{{ line.def.icon }} {{ line.def.name }}</h3>
        <span class="dim">{{ line.def.desc }}</span>
        <span class="dim exp-gate">
          解锁：{{ getSkillDef(line.def.skill)?.name }} Lv{{ line.def.reqLevel }}
        </span>
        <span class="exp-tier">
          熟练度 {{ line.tier }} / {{ EXPEDITION_TIER_STEPS.length }} 档 · 已完成 {{ line.completions }} 轮<template v-if="line.nextTier"> · 再 {{ line.nextTier - line.completions }} 轮升档</template>
        </span>
        <span v-if="line.def.rare" class="dim exp-rare">稀有掉落：{{ getItem(line.def.rare.itemId)?.name }}（{{ (line.def.rare.chance * 100).toFixed(1) }}% + 档位）</span>
      </div>

      <div v-if="!line.unlocked" class="dim exp-locked">
        🔒 需要「{{ getSkillDef(line.def.skill)?.name }}」达到 Lv{{ line.def.reqLevel }} 解锁
      </div>

      <div v-else class="gather-grid exp-grid">
        <div v-for="s in line.slots" :key="s.index" class="gather-card exp-slot" :class="{ locked: !s.slotUnlocked, ready: s.ready }">
          <div class="gather-card-head">
            <div>
              <strong>槽位 {{ s.index + 1 }}</strong>
              <div class="dim" style="font-size: 12px">周期 {{ s.slot.hours }} 小时 · 需 {{ getSkillDef(line.def.skill)?.name }} Lv{{ s.slot.reqLevel }}</div>
            </div>
            <span v-if="s.ready" class="badge badge-on">可领取</span>
          </div>

          <div class="exp-pool">
            <template v-for="id in s.slot.pool" :key="id">
              <span class="exp-pool-item">
                <ItemImg :item-id="id" size="sm" />
                <span class="dim">{{ getItem(id)?.name }}</span>
              </span>
            </template>
          </div>

          <div class="gather-card-row">
            <span>每轮产出</span>
            <span class="mono">≈ {{ expectCount(s.slot, line.tier) }} 个 + {{ s.slot.goldPerHour * s.slot.hours }} 金币</span>
          </div>

          <template v-if="s.slotUnlocked">
            <template v-if="!s.state">
              <button class="btn btn-sm btn-primary exp-btn" @click="start(line.def.id, s.index)">▶ 出发（{{ s.slot.hours }} 小时）</button>
            </template>
            <template v-else-if="s.ready">
              <button class="btn btn-sm btn-primary exp-btn" @click="claim(line.def.id, s.index)">📦 领取并继续</button>
            </template>
            <template v-else>
              <ProgressBar :start-at="s.state.startedAt" :duration-ms="s.totalMs" active />
              <div class="gather-card-row">
                <span class="dim">剩余</span>
                <span class="mono">{{ fmtMs(s.remainMs) }}</span>
              </div>
              <button class="btn btn-sm exp-btn" @click="stop(line.def.id, s.index)">✕ 撤回</button>
            </template>
          </template>
          <div v-else class="dim exp-slot-locked">🔒 需 {{ getSkillDef(line.def.skill)?.name }} Lv{{ s.slot.reqLevel }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exp-line { margin-bottom: 12px; }
.exp-line-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.exp-line-head h3 { margin: 0; }
.exp-gate, .exp-rare { font-size: 12px; }
.exp-tier { margin-left: auto; font-size: 12px; color: var(--primary-strong); font-weight: 700; }
.exp-locked { padding: 14px 0; }
.exp-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
@media (max-width: 940px) { .exp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
@media (max-width: 560px) { .exp-grid { grid-template-columns: 1fr !important; } }
.exp-slot { display: flex; flex-direction: column; gap: 8px; }
.exp-slot.ready { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft) inset; }
.exp-pool { display: flex; flex-wrap: wrap; gap: 8px; }
.exp-pool-item { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
.exp-btn { margin-top: auto; }
.exp-slot-locked { font-size: 12px; padding: 8px 0; }
</style>
