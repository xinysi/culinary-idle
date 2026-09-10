<script setup>
// 节庆日历（2026-09-10 新增）— 每月固定日期的限时加成，与整点的限时活动互补。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { FESTIVALS, festivalBoost, daysInMonth, festivalsOn } from '../game/data/festivals.js'

const player = usePlayerStore()

const now = computed(() => new Date())
const today = computed(() => festivalBoost(now.value))
const upcoming = computed(() => player.festivalUpcoming(12))
const monthDays = computed(() => daysInMonth(now.value.getMonth(), now.value.getFullYear()))
/** 当月日历格子：标注每节庆日 */
const calendar = computed(() => {
  const out = []
  for (let d = 1; d <= monthDays.value; d++) {
    out.push({ day: d, hits: festivalsOn(d, monthDays.value), today: d === now.value.getDate() })
  }
  return out
})

const hasFestivalToday = computed(() => today.value.active.length > 0)
function boostText(b) {
  const parts = []
  if ((b.restaurant ?? 1) !== 1) parts.push(`餐厅收入 ×${b.restaurant}`)
  if ((b.gatherYield ?? 1) !== 1) parts.push(`采集产量 ×${b.gatherYield}`)
  if ((b.gatherXp ?? 1) !== 1) parts.push(`采集经验 ×${b.gatherXp}`)
  if ((b.craftXp ?? 1) !== 1) parts.push(`制作经验 ×${b.craftXp}`)
  if ((b.combatXp ?? 1) !== 1) parts.push(`对决经验 ×${b.combatXp}`)
  return parts.join(' · ') || '无加成'
}
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'weather', label: '🌤 天气运势' }, { view: 'restaurant', label: '🏮 餐厅' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🌗 节庆日历</h2>
        <p class="dim">
          每月固定日期触发的<b>全服节庆</b>：当天自动生效，无需操作；与整点的限时活动（夜市/晨集/茶歇）乘区叠加。
          今天是 {{ now.getMonth() + 1 }} 月 {{ now.getDate() }} 日。
        </p>
      </div>
    </header>

    <div class="card status-line">
      <template v-if="hasFestivalToday">
        <span class="badge badge-on">今日节庆</span>
        <span v-for="f in today.active" :key="f.id" class="badge">{{ f.icon }} {{ f.name }}</span>
        <span class="dim">{{ boostText(today) }}</span>
      </template>
      <template v-else>
        <span class="badge">今日无节庆</span>
        <span class="dim">下一个节庆见下方预告</span>
      </template>
    </div>

    <h3 style="margin-top: 14px">节庆一览</h3>
    <div class="fest-grid">
      <div v-for="f in FESTIVALS" :key="f.id" class="card fest-card" :class="{ on: today.active.some((x) => x.id === f.id) }">
        <div class="fest-head"><span class="fest-icon">{{ f.icon }}</span><strong>{{ f.name }}</strong></div>
        <div class="dim fest-sub">{{ f.desc }}</div>
        <div class="dim fest-sub mono">
          日期：{{ f.days ? f.days.map((d) => `${d} 日`).join('、') : f.range ? `${f.range[0]}~${f.range[1]} 日` : `月末 ${f.lastDays} 天` }}
        </div>
      </div>
    </div>

    <h3 style="margin-top: 16px">本月日历</h3>
    <div class="card fest-calendar">
      <div v-for="c in calendar" :key="c.day" class="fest-day" :class="{ on: c.hits.length > 0, today: c.today }" :title="c.hits.map((h) => h.name).join('、')">
        <span class="fest-day-num mono">{{ c.day }}</span>
        <span class="fest-day-icons">{{ c.hits.map((h) => h.icon).join('') }}</span>
      </div>
    </div>

    <h3 style="margin-top: 16px">未来 12 天预告</h3>
    <div class="card">
      <table class="target-table">
        <tbody>
          <tr v-for="u in upcoming" :key="u.date">
            <td class="dim mono" style="width: 80px">{{ u.date }}</td>
            <td class="dim" style="width: 90px">{{ u.inDays === 0 ? '今天' : `${u.inDays} 天后` }}</td>
            <td>{{ u.festivals.map((f) => `${f.icon} ${f.name}`).join('、') }}</td>
            <td class="dim">{{ u.festivals.map((f) => f.desc).join('；') }}</td>
          </tr>
          <tr v-if="!upcoming.length"><td colspan="4" class="dim">未来 12 天暂无节庆。</td></tr>
        </tbody>
      </table>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.fest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.fest-card {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fest-card.on {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.fest-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.fest-icon {
  font-size: 18px;
}
.fest-sub {
  font-size: 12px;
  line-height: 1.6;
}
.fest-calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  padding: 12px;
}
.fest-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--muted);
}
.fest-day.on {
  border-color: var(--primary);
  color: var(--primary-strong);
  background: var(--primary-soft);
}
.fest-day.today {
  box-shadow: 0 0 0 2px var(--primary);
  font-weight: 700;
}
.fest-day-num {
  font-size: 12px;
}
.fest-day-icons {
  font-size: 12px;
}
</style>
