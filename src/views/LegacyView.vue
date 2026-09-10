<script setup>
// 师徒传承（2026-09-10 新增）— 转生「留一手」 + 徒弟按日成长（提升离线效率）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { SKILL_DEFS } from '../game/data/skills.js'
import { CARRY_MAX, CARRY_RATIO, APPRENTICE_MAX_LEVEL, APPRENTICE_OFFLINE_PER_LEVEL, APPRENTICE_RANKS } from '../game/data/legacy.js'
import ProgressBar from '../components/ProgressBar.vue'

const player = usePlayerStore()

const carryRows = computed(() =>
  Object.entries(player.legacy?.carry ?? {})
    .map(([id, lv]) => ({ id, name: SKILL_DEFS[id]?.name ?? id, level: lv }))
    .sort((a, b) => b.level - a.level)
)

const app = computed(() => player.apprenticeState())
const rankName = computed(() => player.apprenticeRankName())
const offlinePct = computed(() => Math.round((0.8 + player.apprenticeOfflineBonus()) * 100))
const nextLevelIn = computed(() => {
  const st = app.value
  const today = player.todayKey
  return st.lastDay === today ? '明日' : '今日'
})

// 转生后可保留的等级预览（当前满 100 级的技能）
const preview = computed(() => {
  const out = []
  for (const [id, st] of Object.entries(player.skills ?? {})) {
    if ((st.level ?? 1) >= 100) out.push({ id, name: SKILL_DEFS[id]?.name ?? id, level: st.level, carry: Math.min(CARRY_MAX, Math.floor(st.level * CARRY_RATIO)) })
  }
  return out
})

// ── 总览统计（2026-09-10 补）：把散在存档里的传承数据汇总出来 ──
const prestigeCount = computed(() => player.stats?.prestiges ?? 0)
const carryTotal = computed(() => carryRows.value.reduce((a, c) => a + c.level, 0))
const carryBest = computed(() => carryRows.value[0] ?? null)
// 徒弟成长进度（当前等级 / 上限）+ 距满级还要几天
const appProg = computed(() => ({
  level: app.value.level,
  max: APPRENTICE_MAX_LEVEL,
  pct: APPRENTICE_MAX_LEVEL ? Math.min(1, app.value.level / APPRENTICE_MAX_LEVEL) : 0,
  daysLeft: Math.max(0, APPRENTICE_MAX_LEVEL - app.value.level),
}))
// 徒弟称号阶梯（当前档高亮）
const rankLadder = computed(() =>
  APPRENTICE_RANKS.map((r, i) => ({
    ...r,
    next: APPRENTICE_RANKS[i + 1] ?? null,
    reached: app.value.level >= r.min,
    current: rankName.value === r.name,
  }))
)
// 每级的离线效率增量（用于说明「还差多少到 100%」）
const offlineGainLeft = computed(() => Math.max(0, 100 - offlinePct.value))
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'patrons', label: '🏛 信仰' }, { view: 'honor', label: '🎖 荣誉殿堂' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>♻️ 师徒传承</h2>
        <p class="dim">
          两条传承线：<b>转生留一手</b>——转生时把该技能等级的 {{ Math.round(CARRY_RATIO * 100) }}%（上限 {{ CARRY_MAX }} 级）带进轮回，不再从 1 级起步；
          <b>徒弟档案</b>——按真实日历日成长（每天 +1 级，上限 {{ APPRENTICE_MAX_LEVEL }}），每级把离线收益效率 +{{ APPRENTICE_OFFLINE_PER_LEVEL * 100 }}%。
        </p>
      </div>
      <span class="dim mono">当前离线效率 {{ offlinePct }}%</span>
    </header>

    <div class="card status-line">
      <span class="badge badge-on">徒弟 Lv{{ app.level }} · {{ rankName }}</span>
      <span class="dim">离线收益效率 <b class="mono">{{ offlinePct }}%</b>（基础 80% + 徒弟加成）</span>
      <span class="dim">下次成长：{{ nextLevelIn }}（按自然日）</span>
    </div>

    <!-- 总览（2026-09-10 补）：转生次数 / 满级技能 / 传承总量 / 徒弟进度 -->
    <div class="legacy-stats">
      <div class="card legacy-stat">
        <div class="legacy-stat-num">{{ prestigeCount }}</div>
        <div class="dim legacy-stat-label">累计转生次数</div>
        <div class="dim legacy-stat-sub">每层 +20% 经验，上限 120 级</div>
      </div>
      <div class="card legacy-stat">
        <div class="legacy-stat-num">{{ preview.length }}</div>
        <div class="dim legacy-stat-label">已达 100 级技能</div>
        <div class="dim legacy-stat-sub">可转生并带走传承</div>
      </div>
      <div class="card legacy-stat">
        <div class="legacy-stat-num">{{ carryTotal }}</div>
        <div class="dim legacy-stat-label">传承等级合计</div>
        <div class="dim legacy-stat-sub">
          <template v-if="carryBest">最高：{{ carryBest.name }} Lv{{ carryBest.level }}</template>
          <template v-else>尚未转生</template>
        </div>
      </div>
      <div class="card legacy-stat">
        <div class="legacy-stat-num">{{ appProg.level }}<span class="dim legacy-stat-max">/{{ appProg.max }}</span></div>
        <div class="dim legacy-stat-label">徒弟等级</div>
        <div class="dim legacy-stat-sub">
          <template v-if="appProg.daysLeft > 0">还需 {{ appProg.daysLeft }} 天满级</template>
          <template v-else>已满级</template>
        </div>
      </div>
    </div>

    <!-- 徒弟成长（2026-09-10 补）：进度条 + 称号阶梯 + 离线上限说明 -->
    <div class="card legacy-app">
      <div class="legacy-app-head">
        <h3>🎓 徒弟成长</h3>
        <span class="dim mono">离线效率 {{ offlinePct }}%<template v-if="offlineGainLeft > 0"> · 还差 {{ offlineGainLeft }}% 到满</template></span>
      </div>
      <div class="legacy-app-bar">
        <div class="rev-bar-label">
          <span class="dim">Lv{{ appProg.level }} / {{ appProg.max }}</span>
          <span class="dim mono">{{ Math.round(appProg.pct * 100) }}%</span>
        </div>
        <ProgressBar :progress="appProg.pct" />
      </div>
      <div class="legacy-ladder">
        <div
          v-for="r in rankLadder"
          :key="r.name"
          class="legacy-rank"
          :class="{ reached: r.reached, current: r.current }"
        >
          <span class="legacy-rank-name">{{ r.reached ? '🎖' : '🔒' }} {{ r.name }}</span>
          <span class="dim mono">
            Lv{{ r.min }}<template v-if="r.next"> ~ {{ r.next.min - 1 }}</template><template v-else>+</template>
          </span>
          <span v-if="r.current" class="badge badge-on">当前</span>
        </div>
      </div>
      <p class="dim legacy-sub">
        徒弟按<b>真实日历日</b>成长（每天 +1 级，与挂机时长无关，离线也照常长）；每级把离线收益效率 +{{ APPRENTICE_OFFLINE_PER_LEVEL * 100 }}%，
        Lv50 时到达 100%（基础 80% + 20%）。
      </p>
    </div>

    <div class="legacy-preview">
      <div class="card legacy-card">
        <h3>📈 转生传承预览</h3>
        <p class="dim legacy-sub">仅列出当前已达 100 级、可转生的技能；转生后这些技能将从「1 + 传承等级」起步。</p>
        <table class="target-table">
          <tbody>
            <tr v-for="p in preview" :key="p.id">
              <td>{{ p.name }}</td>
              <td class="dim mono" style="width: 90px">Lv{{ p.level }}</td>
              <td class="mono" style="width: 120px">→ 起步 Lv{{ 1 + p.carry }}</td>
            </tr>
            <tr v-if="!preview.length"><td colspan="3" class="dim">暂无满 100 级的技能——先去把某个技能练满再转生。</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card legacy-card">
        <h3>🎓 已保留的传承</h3>
        <p class="dim legacy-sub">每次转生会取「历史最高传承等级」，不会因后续转生而降低。</p>
        <table class="target-table">
          <tbody>
            <tr v-for="c in carryRows" :key="c.id">
              <td>{{ c.name }}</td>
              <td class="mono" style="width: 120px">传承 Lv{{ c.level }}</td>
              <td style="width: 130px">
                <ProgressBar :progress="c.level / CARRY_MAX" />
              </td>
              <td class="dim mono" style="width: 74px">{{ Math.round((c.level / CARRY_MAX) * 100) }}%</td>
            </tr>
            <tr v-if="!carryRows.length"><td colspan="4" class="dim">尚未转生过——首次转生后这里会记录保留等级。</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.legacy-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.legacy-card {
  padding: 12px 14px;
}
.legacy-sub {
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0 8px;
}
/* 总览（2026-09-10 补） */
.legacy-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.legacy-stat {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.legacy-stat-num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--accent, #d95a38);
}
.legacy-stat-max {
  font-size: 13px;
  font-weight: 400;
}
.legacy-stat-label {
  font-size: 12px;
}
.legacy-stat-sub {
  font-size: 11px;
}
/* 徒弟成长（2026-09-10 补） */
.legacy-app {
  margin-top: 12px;
  padding: 12px 14px;
}
.legacy-app-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.legacy-app-bar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0;
}
.rev-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.legacy-ladder {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}
.legacy-rank {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  opacity: 0.6;
}
.legacy-rank.reached {
  opacity: 1;
  border-style: solid;
}
.legacy-rank.current {
  border-color: var(--accent, #d95a38);
}
.legacy-rank-name {
  flex: 1;
}
</style>
