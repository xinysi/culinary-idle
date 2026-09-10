<script setup>
// 师徒传承（2026-09-10 新增）— 转生「留一手」 + 徒弟按日成长（提升离线效率）。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { SKILL_DEFS } from '../game/data/skills.js'
import { CARRY_MAX, CARRY_RATIO, APPRENTICE_MAX_LEVEL, APPRENTICE_OFFLINE_PER_LEVEL } from '../game/data/legacy.js'

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
            </tr>
            <tr v-if="!carryRows.length"><td class="dim">尚未转生过——首次转生后这里会记录保留等级。</td></tr>
          </tbody>
        </table>
      </div>
    </div>
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
</style>
