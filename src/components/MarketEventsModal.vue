<script setup>
// 限时活动轮换时间表 — 点击顶部呼吸徽章打开（2026-09-06）
import { computed } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { MARKET_EVENTS, activeMarketEvents } from '../game/data/marketEvents.js'

const ui = useUiStore()
const nowHour = computed(() => new Date().getHours())
const nowWeekday = computed(() => new Date().getDay())
const activeIds = computed(() => new Set(activeMarketEvents(nowHour.value, nowWeekday.value).map((e) => e.id)))

function hoursText(ev) {
  if (ev.hours.length === 1 && ev.hours[0][0] === 0 && ev.hours[0][1] === 24) return '全天'
  return ev.hours.map(([s, e]) => {
    const f = (h) => `${String(h).padStart(2, '0')}:00`
    return e <= 24 ? `${f(s)}-${f(e)}` : `${f(s)}-次日${f(e)}`
  }).join(' · ')
}

function weekdayText(ev) {
  if (ev.weekday === undefined) return '每天'
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][ev.weekday]
}
</script>

<template>
  <div v-if="ui.showMarketModal" class="modal-backdrop" @click.self="ui.showMarketModal = false">
    <div class="modal market-modal">
      <header class="modal-head">
        <h3>⏰ 限时活动轮换表</h3>
        <button class="btn btn-sm" @click="ui.showMarketModal = false">✕</button>
      </header>
      <p class="dim">事件按「本地时间」轮换，同时命中多个窗口时加成相乘；徽章呼吸动效表示正在进行。</p>
      <div class="market-list">
        <div
          v-for="ev in MARKET_EVENTS"
          :key="ev.id"
          class="market-row"
          :class="{ active: activeIds.has(ev.id) }"
        >
          <span class="market-icon">{{ ev.icon }}</span>
          <div class="market-body">
            <strong>{{ ev.name }}</strong>
            <span class="dim">{{ ev.desc }}</span>
            <span class="dim mono market-schedule">{{ weekdayText(ev) }} {{ hoursText(ev) }}</span>
          </div>
          <span v-if="activeIds.has(ev.id)" class="badge badge-on">进行中</span>
        </div>
      </div>
      <p class="dim market-foot">示例：15 点同时命中「午后茶歇（制作 ×1.5）」；18 点命中「夜市（餐厅 ×2、对决 ×1.5）」；周日晚同时吃「主厨日」与「夜市」餐厅为 ×2×1.5=×3。</p>
    </div>
  </div>
</template>

<style scoped>
.market-modal { max-width: 520px; }
.market-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.market-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(255, 251, 244, 0.85);
  border: 1px dashed rgba(217, 90, 56, 0.25);
}
.market-row.active { border-color: var(--primary); background: rgba(217, 90, 56, 0.1); }
.market-icon { font-size: 24px; }
.market-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.market-schedule { font-size: 11px; }
.market-foot { margin-top: 10px; font-size: 12px; }
:global([data-theme='dark']) .market-row { background: rgba(44, 31, 22, 0.85); color: #e8dccb; }
</style>
