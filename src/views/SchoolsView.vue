<script setup>
// 菜系研究 / 学派（2026-09-10 新增）— 材料 + 真实时间研究六大流派，换取该类料理的永久加成。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SCHOOLS, SCHOOL_MAX_LEVEL, SCHOOL_PERKS, schoolCost } from '../game/data/schools.js'
import { getItem } from '../game/data/items.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const rows = computed(() => {
  ui.loopTick
  const now = Date.now()
  return SCHOOLS.map((def) => {
    const st = player.schoolState(def.id)
    const level = st?.level ?? 0
    const research = st?.research ?? null
    const nextLevel = Math.min(SCHOOL_MAX_LEVEL, level + 1)
    const cost = schoolCost(def, nextLevel)
    const ready = !!research && now >= research.readyAt
    const totalMs = research ? Math.max(1, research.readyAt - research.startedAt) : 0
    return {
      def,
      level,
      maxed: level >= SCHOOL_MAX_LEVEL,
      research,
      ready,
      progress: research ? Math.min(1, (now - research.startedAt) / totalMs) : 0,
      remainMs: research ? Math.max(0, research.readyAt - now) : 0,
      nextLevel,
      cost,
      canPay: player.gold >= cost.gold && Object.entries(cost.mats).every(([id, q]) => (player.inventory[id] ?? 0) >= q),
      matsText: Object.entries(cost.mats).map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`).join('、'),
    }
  })
})

const totalLevels = computed(() => player.schoolTotalLevels())
const busyId = computed(() => player.schoolBusy())

function fmtMs(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分 ${s % 60} 秒`
}
function start(r) {
  const res = player.schoolStart(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function claim(r) {
  const res = player.schoolClaim(r.def.id)
  if (!res.ok) ui.pushLog(res.msg, 'warn')
}
function cancel(r) {
  if (player.schoolCancel(r.def.id)) ui.pushLog('已取消研究（材料与金币不退还）', 'warn')
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📜 菜系研究</h2>
        <p class="dim">
          六大流派各 5 级：投入<b>该流派常用食材 + 金币</b>并等待研究完成，每级给该类料理永久加成——
          制作经验 +{{ SCHOOL_PERKS.craftXpPct }}%、进食回血 +{{ SCHOOL_PERKS.healPct }}%、餐厅收入贡献 +{{ SCHOOL_PERKS.incomePct }}%。
          <b>同时只能研究一个学派</b>（离线照常计时）。
        </p>
      </div>
      <span class="dim mono">已研究 {{ totalLevels }} / {{ SCHOOLS.length * SCHOOL_MAX_LEVEL }} 级</span>
    </header>

    <div class="school-grid">
      <div v-for="r in rows" :key="r.def.id" class="card school-card" :class="{ maxed: r.maxed, busy: r.research }">
        <div class="school-head">
          <span class="school-icon">{{ r.def.icon }}</span>
          <div>
            <strong>{{ r.def.name }}</strong>
            <div class="dim school-sub">{{ r.def.desc }}</div>
          </div>
          <span class="badge" :class="{ 'badge-on': r.level > 0 }" style="margin-left: auto">Lv{{ r.level }} / {{ SCHOOL_MAX_LEVEL }}</span>
        </div>

        <div class="school-perks dim school-sub">
          当前加成：制作经验 +{{ r.level * SCHOOL_PERKS.craftXpPct }}% · 进食回血 +{{ r.level * SCHOOL_PERKS.healPct }}% · 餐厅贡献 +{{ r.level * SCHOOL_PERKS.incomePct }}%
        </div>

        <template v-if="r.maxed">
          <div class="dim school-sub">✅ 已研究满级</div>
        </template>

        <template v-else-if="r.research">
          <ProgressBar :progress="r.progress" />
          <div class="dim school-sub mono">
            研究中 → Lv{{ r.research.toLevel }}<template v-if="r.ready"> · 已完成，可领取</template><template v-else> · 剩余 {{ fmtMs(r.remainMs) }}</template>
          </div>
          <div class="school-actions">
            <button class="btn btn-sm btn-primary" :disabled="!r.ready" @click="claim(r)">完成研究</button>
            <button class="btn btn-sm" @click="cancel(r)">取消（不退还）</button>
          </div>
        </template>

        <template v-else>
          <div class="dim school-sub">
            下一级 Lv{{ r.nextLevel }}：{{ r.matsText }} · {{ r.cost.gold.toLocaleString() }} 金币 · 耗时 {{ r.cost.hours }} 小时
          </div>
          <button class="btn btn-sm" :class="r.canPay && !busyId ? 'btn-primary' : ''" :disabled="!r.canPay || !!busyId" @click="start(r)">
            {{ busyId ? '其他学派研究中' : '开始研究' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.school-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.school-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.school-card.maxed {
  border-color: var(--primary);
}
.school-card.busy {
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.school-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.school-icon {
  font-size: 22px;
}
.school-sub {
  font-size: 12px;
  line-height: 1.6;
}
.school-perks {
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--bg-soft);
}
.school-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
