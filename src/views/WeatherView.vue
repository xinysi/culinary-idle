<script setup>
// 天气与运势（2026-09-10 新增）— 每日变量层：天气加成 + 今日运势 + 宜做建议。
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { WEATHERS, weatherForDay } from '../game/data/weather.js'
import { getItem } from '../game/data/items.js'
import { dayKeyOf } from '../game/data/weather.js'

const player = usePlayerStore()
const key = computed(() => player.todayKey ?? dayKeyOf())
const weather = computed(() => player.todayWeather())
const fx = computed(() => player.weatherEffects())
const fortune = computed(() => player.todayFortune())
const luckyName = computed(() => getItem(fortune.value.luckyItem)?.name ?? fortune.value.luckyItem)
/** 未来 7 天天气预告 */
const week = computed(() => {
  const out = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000)
    out.push({ key: dayKeyOf(d), d, w: weatherForDay(dayKeyOf(d)), today: i === 0 })
  }
  return out
})
import RelatedPages from '../components/RelatedPages.vue'
// 相关页面（2026-09-10 补）
const RELATED = [{ view: 'festival', label: '🌗 节庆' }, { view: 'mascot', label: '🍀 吉祥物' }, { view: 'restaurant', label: '🏮 餐厅' }]
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>🌤 天气与运势</h2>
        <p class="dim">
          每天 0 点刷新：<b>天气</b>给一条全局加成（与节庆、限时活动三层叠加），<b>运势</b>指定今日幸运食材（采集它产量 +20%）与宜做建议。
          今天是 {{ key }}。
        </p>
      </div>
    </header>

    <div class="card wx-hero">
      <div class="wx-now">
        <div class="wx-icon">{{ weather.icon }}</div>
        <div>
          <div class="wx-name">今日{{ weather.name }}</div>
          <div class="dim wx-sub">{{ weather.desc }}</div>
        </div>
      </div>
      <div class="wx-eff">
        <div class="dim">今日加成</div>
        <div class="mono wx-eff-line">采集产量 ×{{ fx.gatherYield }} · 采集经验 ×{{ fx.gatherXp }}</div>
        <div class="mono wx-eff-line">制作经验 ×{{ fx.craftXp }} · 对决经验 ×{{ fx.combatXp }} · 餐厅收入 ×{{ fx.restaurant }}</div>
      </div>
    </div>

    <div class="card status-line">
      <span class="badge badge-on">🍀 幸运食材</span>
      <span><b>{{ luckyName }}</b></span>
      <span class="dim">今日采集该食材产量 +20%（挂机时选它更划算）</span>
    </div>

    <h3>今日宜做</h3>
    <div class="wx-tips">
      <div v-for="(t, i) in fortune.tips" :key="i" class="card wx-tip">{{ t }}</div>
    </div>

    <h3 style="margin-top: 16px">未来一周天气</h3>
    <div class="wx-week">
      <div v-for="d in week" :key="d.key" class="card wx-day" :class="{ today: d.today }">
        <div class="wx-day-head">{{ d.d.getMonth() + 1 }}/{{ d.d.getDate() }}</div>
        <div class="wx-icon wx-icon-sm">{{ d.w.icon }}</div>
        <div class="wx-day-name">{{ d.w.name }}</div>
        <div class="dim wx-sub">{{ d.w.desc }}</div>
      </div>
    </div>

    <h3 style="margin-top: 16px">全部天气</h3>
    <div class="card">
      <table class="target-table">
        <tbody>
          <tr v-for="w in WEATHERS" :key="w.id">
            <td style="width: 120px">{{ w.icon }} {{ w.name }}</td>
            <td class="dim">{{ w.desc }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <RelatedPages :links="RELATED" />
</div>
</template>

<style scoped>
.wx-hero {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 14px 16px;
  flex-wrap: wrap;
}
.wx-now {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 200px;
}
.wx-icon {
  font-size: 34px;
}
.wx-icon-sm {
  font-size: 22px;
}
.wx-name {
  font-size: 18px;
  font-weight: 700;
}
.wx-sub {
  font-size: 12px;
  line-height: 1.6;
}
.wx-eff {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}
.wx-eff-line {
  font-size: 13px;
}
.wx-tips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.wx-tip {
  padding: 12px 14px;
  font-size: 13px;
}
.wx-week {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.wx-day {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
}
.wx-day.today {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
.wx-day-head {
  font-size: 12px;
  font-weight: 700;
}
.wx-day-name {
  font-size: 13px;
}
</style>
