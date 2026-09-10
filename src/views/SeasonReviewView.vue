<script setup>
// 赛季回顾（2026-09-10 新增）— 只读聚合页：当前赛季进度 + 历届赛季战绩 + 赛季相关年鉴条目。
// 只读取既有赛季/年鉴状态，不改动任何赛季数据（铁律：档位点数、任务结构、限定装备一律固定）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useUiStore } from '../stores/ui.js'
import { SEASONS, getSeason, activeSeasonId, seasonRemainingMs } from '../game/data/seasons.js'
import { getItem } from '../game/data/items.js'
import { CHRONICLE_KINDS, fmtChronicleTime } from '../game/data/chronicle.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()
const ui = useUiStore()

const season = computed(() => player.activeSeasonDef)
const state = computed(() => player.seasonState())
const activeId = computed(() => activeSeasonId())

// ① 当前赛季：任务完成度 + 档位领取进度
const missions = computed(() =>
  (season.value?.missions ?? []).map((m) => {
    const cur = state.value.missionProgress?.[m.id] ?? 0
    return { m, cur: Math.min(cur, m.qty), done: cur >= m.qty, pct: m.qty ? Math.min(1, cur / m.qty) : 0 }
  })
)
const missionDone = computed(() => missions.value.filter((x) => x.done).length)
const missionPct = computed(() =>
  missions.value.length ? missionDone.value / missions.value.length : 0
)
const tiers = computed(() =>
  (season.value?.tiers ?? []).map((t, i) => ({ t, i, claimed: (state.value.claimed ?? []).includes(i) }))
)
const tierDone = computed(() => tiers.value.filter((x) => x.claimed).length)
const tierPct = computed(() => (tiers.value.length ? tierDone.value / tiers.value.length : 0))
// 累计可得点数 vs 已兑换点数（领取为「积分兑换扣费」语义）
const totalPoints = computed(() => (season.value?.missions ?? []).reduce((a, m) => a + m.points, 0))
const earnedPoints = computed(() =>
  (season.value?.missions ?? []).reduce((a, m) => a + ((state.value.awarded ?? []).includes(m.id) ? m.points : 0), 0)
)
const spentPoints = computed(() =>
  tiers.value.reduce((a, x) => a + (x.claimed ? x.t.points : 0), 0)
)
const remaining = computed(() => {
  const ms = Math.max(0, seasonRemainingMs(activeId.value))
  const d = Math.floor(ms / 86400_000)
  const h = Math.floor((ms % 86400_000) / 3600_000)
  return `${d} 天 ${h} 小时`
})
const seasonProgressPct = computed(() => {
  const span = (season.value?.durationDays ?? 1) * 86400_000
  return Math.min(1, Math.max(0, 1 - seasonRemainingMs(activeId.value) / span))
})

// ② 历届回顾：有进度记录的赛季（含当前）
const history = computed(() =>
  SEASONS.map((s) => {
    const st = player.seasons?.[s.id]
    if (!st) return null
    const def = getSeason(s.id)
    const claimed = (st.claimed ?? []).length
    const awarded = (st.awarded ?? []).length
    const total = def?.missions?.length ?? 0
    if (!claimed && !awarded && !(st.points ?? 0)) return null // 无进度不展示
    return {
      id: s.id,
      name: s.name,
      theme: s.theme,
      icon: s.limitedItem ? '🎖' : '🎪',
      limitedItem: s.limitedItem,
      claimed,
      awarded,
      total,
      points: st.points ?? 0,
      isCurrent: s.id === activeId.value,
      complete: total > 0 && awarded >= total,
    }
  }).filter(Boolean)
)
const clearedSeasons = computed(() => history.value.filter((h) => h.complete).length)
const totalClaimed = computed(() => history.value.reduce((a, h) => a + h.claimed, 0))

// ③ 赛季相关年鉴条目
const seasonLogs = computed(() =>
  (player.chronicle ?? []).filter((e) => e.kind === 'seasonal').slice(0, 20)
)

function jumpSeason() {
  ui.setView('season')
}
function jumpChronicle() {
  ui.setView('chronicle')
}
function rewardText(reward) {
  const parts = []
  if (reward?.gold) parts.push(`${reward.gold.toLocaleString()} 金币`)
  for (const [id, q] of Object.entries(reward?.items ?? {})) parts.push(`${getItem(id)?.name ?? id} ×${q}`)
  return parts.join('、') || '—'
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'season', label: '🎪 赛季' }, { view: 'chronicle', label: '📜 年鉴' }, { view: 'milestones', label: '🗺 里程碑' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>📅 赛季回顾</h2>
        <p class="dim">
          把本赛季的任务、档位与往届战绩汇总在一页：只做<b>回顾与统计</b>，领取奖励请到
          <button class="btn btn-sm" @click="jumpSeason">🎪 赛季页</button>。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">本赛季 {{ season?.name }}</span>
      <span class="dim">剩余 <b class="mono">{{ remaining }}</b> · 任务 {{ missionDone }}/{{ missions.length }} · 档位 {{ tierDone }}/{{ tiers.length }}</span>
      <span class="dim">历史完成赛季 <b class="mono">{{ clearedSeasons }}</b> · 累计领档 <b class="mono">{{ totalClaimed }}</b></span>
    </div>

    <!-- ① 本赛季概况 -->
    <div class="card review-card">
      <div class="review-h">🎪 本赛季 · {{ season?.name }}</div>
      <div class="dim review-sub">主题：{{ season?.theme }} · 时长 {{ season?.durationDays }} 天</div>

      <div class="rev-bar">
        <div class="rev-bar-label"><span class="dim">赛季进程</span><span class="mono">{{ Math.round(seasonProgressPct * 100) }}%</span></div>
        <ProgressBar :progress="seasonProgressPct" />
      </div>
      <div class="rev-bar">
        <div class="rev-bar-label"><span class="dim">任务完成</span><span class="mono">{{ missionDone }} / {{ missions.length }}</span></div>
        <ProgressBar :progress="missionPct" />
      </div>
      <div class="rev-bar">
        <div class="rev-bar-label"><span class="dim">档位领取</span><span class="mono">{{ tierDone }} / {{ tiers.length }}</span></div>
        <ProgressBar :progress="tierPct" />
      </div>
      <div class="rev-bar">
        <div class="rev-bar-label"><span class="dim">点数使用</span><span class="mono">{{ earnedPoints }} / {{ totalPoints }}</span></div>
        <ProgressBar :progress="totalPoints ? earnedPoints / totalPoints : 0" />
      </div>

      <div class="rev-points">
        <span class="rev-chip">已获得点数 <b class="mono">{{ earnedPoints }}</b></span>
        <span class="rev-chip">已兑换 <b class="mono">{{ spentPoints }}</b></span>
        <span class="rev-chip">余额 <b class="mono">{{ state.points ?? 0 }}</b></span>
      </div>
    </div>

    <!-- ② 任务明细 -->
    <div class="card">
      <div class="review-h">📋 任务明细（{{ missionDone }}/{{ missions.length }} 完成）</div>
      <div class="rev-list">
        <div v-for="x in missions" :key="x.m.id" class="rev-item" :class="{ done: x.done }">
          <span class="rev-mark">{{ x.done ? '✅' : '⬜' }}</span>
          <span class="rev-name">{{ x.m.name }}</span>
          <span class="dim mono rev-prog">{{ x.cur }} / {{ x.m.qty }}</span>
          <span class="rev-pts mono">+{{ x.m.points }} 点</span>
        </div>
      </div>
    </div>

    <!-- ③ 档位一览 -->
    <div class="card">
      <div class="review-h">🎖 奖励档位（{{ tierDone }}/{{ tiers.length }} 已领）</div>
      <div class="rev-list">
        <div v-for="x in tiers" :key="x.i" class="rev-item" :class="{ done: x.claimed }">
          <span class="rev-mark">{{ x.claimed ? '✅' : '⬜' }}</span>
          <span class="rev-name">{{ x.t.name ?? `奖励 ${x.i + 1}` }}</span>
          <span class="dim mono rev-prog">{{ x.t.points }} 点</span>
          <span class="dim rev-rew">{{ rewardText(x.t.reward) }}</span>
        </div>
      </div>
    </div>

    <!-- ④ 历届战绩 -->
    <div class="card">
      <div class="review-h">📚 历届赛季战绩（{{ history.length }} 季有记录）</div>
      <div v-if="!history.length" class="dim">还没有任何赛季进度记录——去赛季页做几个任务吧。</div>
      <div v-else class="rev-list">
        <div v-for="h in history" :key="h.id" class="rev-season" :class="{ now: h.isCurrent }">
          <div class="rev-season-top">
            <span class="rev-season-name">
              {{ h.name }}
              <span v-if="h.isCurrent" class="badge badge-on">当前</span>
              <span v-else-if="h.complete" class="badge">已全清</span>
            </span>
            <span class="dim mono">任务 {{ h.awarded }}/{{ h.total }} · 领档 {{ h.claimed }} · 余额 {{ h.points }} 点</span>
          </div>
          <div class="dim rev-sub">
            主题：{{ h.theme }}
            <template v-if="h.limitedItem"> · 限定装备：{{ getItem(h.limitedItem)?.name ?? h.limitedItem }}</template>
          </div>
          <ProgressBar :progress="h.total ? h.awarded / h.total : 0" />
        </div>
      </div>
    </div>

    <!-- ⑤ 赛季年鉴 -->
    <div class="card">
      <div class="review-h">
        📜 赛季年鉴
        <button class="btn btn-sm" style="margin-left: 8px" @click="jumpChronicle">查看全部年鉴</button>
      </div>
      <div v-if="!seasonLogs.length" class="dim">
        还没有赛季相关记录。完成赛季任务、领取档位时会自动记入年鉴。
      </div>
      <div v-else class="rev-list">
        <div v-for="e in seasonLogs" :key="e.key ?? e.at" class="rev-item">
          <span class="rev-mark">{{ CHRONICLE_KINDS.seasonal.icon }}</span>
          <span class="rev-name">{{ e.text }}</span>
          <span class="dim mono rev-prog">{{ fmtChronicleTime(e.at) }}</span>
        </div>
      </div>
    </div>
      <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.review-card {
  margin-top: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.review-h {
  font-weight: 600;
}
.review-sub {
  font-size: 12px;
}
.rev-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rev-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.rev-points {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rev-chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rev-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}
.rev-item {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rev-item.done {
  border-style: solid;
}
.rev-mark {
  text-align: center;
}
.rev-prog {
  font-size: 12px;
  white-space: nowrap;
}
.rev-pts {
  font-size: 12px;
  color: var(--good, #57a861);
  white-space: nowrap;
}
.rev-rew {
  font-size: 12px;
  white-space: nowrap;
}
.rev-season {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.rev-season.now {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
.rev-season-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
}
.rev-season-name {
  font-weight: 600;
}
.rev-sub {
  font-size: 12px;
}
</style>
