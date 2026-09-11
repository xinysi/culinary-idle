<script setup>
// 行情与限时窗口（2026-09-11 新增）— 把原先只在弹窗里看得到的限时活动做成可查的排班表。
// 纯读取 data/marketEvents.js：当前命中、今日 24 小时排班、每周固定档、全部活动与叠加倍率。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MARKET_EVENTS, activeMarketEvents, aggregateMarketBoost } from '../game/data/marketEvents.js'
import RelatedPages from '../components/RelatedPages.vue'

const RELATED = [
  { view: 'restaurant', label: '🏮 我的餐厅' },
  { view: 'weather', label: '🌤 天气运势' },
  { view: 'festival', label: '🌗 节庆日历' },
  { view: 'stats', label: '📊 统计' },
]

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
// 每秒刷新「当前命中」，跨过整点/午夜时自动换档（切页即卸载，定时器随组件清理）
const nowMs = ref(Date.now())
let timerId = null
onMounted(() => { timerId = setInterval(() => { nowMs.value = Date.now() }, 1000) })
onUnmounted(() => { if (timerId) clearInterval(timerId) })
const now = computed(() => new Date(nowMs.value))
const nowHour = computed(() => now.value.getHours())
const nowWeekday = computed(() => now.value.getDay())

const activeNow = computed(() => activeMarketEvents(nowHour.value, nowWeekday.value))
const boostNow = computed(() => aggregateMarketBoost(nowHour.value, nowWeekday.value))
// 实际生效倍率（叠加了玩家的其它乘区后，这里只展示市场窗口这一层，故直接读 marketBoost 的乘法项）
const BOOST_LABELS = [
  { key: 'restaurant', label: '餐厅收入' },
  { key: 'combatXp', label: '对决经验' },
  { key: 'gatherXp', label: '采集经验' },
  { key: 'craftXp', label: '制作经验' },
]
const boostRows = computed(() =>
  BOOST_LABELS.map((b) => ({ ...b, mult: boostNow.value[b.key] ?? 1 })).filter((b) => b.mult !== 1)
)

/** 今日 24 小时排班：每小时命中的活动 */
const dayGrid = computed(() =>
  Array.from({ length: 24 }, (_, h) => {
    const evs = activeMarketEvents(h, nowWeekday.value)
    const agg = aggregateMarketBoost(h, nowWeekday.value)
    return { h, evs, agg, hot: Object.values(agg).some((v) => v !== 1) }
  })
)
/** 本周 7 天的固定档（只有带 weekday 的活动才是「固定档」） */
const weeklyFixed = computed(() =>
  MARKET_EVENTS.filter((e) => e.weekday !== undefined).map((e) => ({ ...e, dayName: WEEKDAYS[e.weekday] }))
)
/** 每天常态化（无 weekday）的活动 */
const dailyEvents = computed(() => MARKET_EVENTS.filter((e) => e.weekday === undefined))

const selectedHour = ref(null)
const selectedDetail = computed(() => {
  const h = selectedHour.value
  if (h === null) return null
  return { h, evs: activeMarketEvents(h, nowWeekday.value), agg: aggregateMarketBoost(h, nowWeekday.value) }
})

function hoursText(ev) {
  return ev.hours.map(([s, e]) => `${String(s).padStart(2, '0')}:00–${String(e).padStart(2, '0')}:00`).join(' / ')
}
function multText(agg) {
  const parts = BOOST_LABELS.filter((b) => (agg[b.key] ?? 1) !== 1).map((b) => `${b.label} ×${agg[b.key]}`)
  return parts.length ? parts.join(' · ') : '无加成'
}
/** 剩余时间（当前活动还剩多久） */
function remainText(ev) {
  const h = nowHour.value
  const m = now.value.getMinutes()
  for (const [s, e] of ev.hours) {
    const inRange = s <= e ? h >= s && h < e : h >= s || h < e
    if (!inRange) continue
    const end = h >= s && h < e ? e : (e <= h ? e + 24 : e)
    const mins = (end - h) * 60 - m
    if (mins <= 0) return '即将结束'
    const hh = Math.floor(mins / 60)
    const mm = mins % 60
    return hh > 0 ? `还剩 ${hh} 小时 ${mm} 分` : `还剩 ${mm} 分`
  }
  return ''
}
</script>

<template>
  <div class="skill-view">
    <header class="skill-head">
      <div>
        <h2>💹 行情与限时窗口</h2>
        <p class="dim">
          每天 <b>{{ MARKET_EVENTS.length }}</b> 个限时窗口按<b>本地时段</b>轮换（部分只在固定星期开放）。
          命中期间给的是<b>基础乘区</b>，多个窗口重叠时<b>相乘叠加</b>；与天气、节庆、奥义等其它乘区也相乘。
        </p>
      </div>
      <div class="skill-head-right">
        <div class="xp-num">{{ WEEKDAYS[nowWeekday] }} {{ String(nowHour).padStart(2, '0') }}:{{ String(now.getMinutes()).padStart(2, '0') }}</div>
        <p class="dim mono">{{ activeNow.length ? `${activeNow.length} 个窗口进行中` : '当前无窗口' }}</p>
      </div>
    </header>

    <!-- 当前命中 -->
    <div class="card mk-hero">
      <div class="mk-now">
        <span class="dim">此刻行情</span>
        <div v-if="activeNow.length" class="mk-now-list">
          <div v-for="ev in activeNow" :key="ev.id" class="mk-now-item">
            <span class="mk-now-name">{{ ev.icon }} {{ ev.name }}</span>
            <span class="dim">{{ ev.desc }}</span>
            <span class="badge badge-on">{{ remainText(ev) }}</span>
          </div>
        </div>
        <p v-else class="dim mk-none">当前没有限时窗口——看看下面的排班表，挑个时段再来。</p>
      </div>
      <div v-if="boostRows.length" class="mk-boost">
        <span class="dim">叠加后</span>
        <span v-for="b in boostRows" :key="b.key" class="mk-chip">{{ b.label }} <b class="mono">×{{ b.mult }}</b></span>
      </div>
    </div>

    <!-- 今日排班 -->
    <div class="card mk-card">
      <div class="mk-h">🕒 今日排班（{{ WEEKDAYS[nowWeekday] }} · 本地时间）</div>
      <div class="mk-grid">
        <button
          v-for="c in dayGrid"
          :key="c.h"
          class="mk-cell"
          :class="{ hot: c.hot, now: c.h === nowHour }"
          :title="`${String(c.h).padStart(2, '0')}:00–${String(c.h + 1).padStart(2, '0')}:00 ${multText(c.agg)}`"
          @click="selectedHour = selectedHour === c.h ? null : c.h"
        >
          <span class="mk-cell-h mono">{{ String(c.h).padStart(2, '0') }}</span>
          <span class="mk-cell-icons">{{ c.evs.map((e) => e.icon).join('') || '·' }}</span>
        </button>
      </div>
      <div v-if="selectedDetail" class="mk-detail">
        <strong>{{ String(selectedDetail.h).padStart(2, '0') }}:00–{{ String(selectedDetail.h + 1).padStart(2, '0') }}:00</strong>
        <template v-if="selectedDetail.evs.length">
          <span v-for="ev in selectedDetail.evs" :key="ev.id" class="mk-chip">{{ ev.icon }} {{ ev.name }}</span>
          <span class="dim">{{ multText(selectedDetail.agg) }}</span>
        </template>
        <span v-else class="dim">无窗口</span>
      </div>
      <p class="dim mk-note">格子里是命中的窗口图标（深色格 = 有加成）；点格子看该小时的叠加明细。带 <b class="mono">·</b> 的时段没有任何窗口。</p>
    </div>

    <!-- 每周固定档 -->
    <div class="card mk-card">
      <div class="mk-h">📅 每周固定档（只在特定星期开放）</div>
      <div class="mk-table">
        <div class="mk-th"><span>活动</span><span>开放日</span><span>时段</span><span>效果</span></div>
        <div v-for="ev in weeklyFixed" :key="ev.id" class="mk-tr" :class="{ on: ev.weekday === nowWeekday }">
          <span>{{ ev.icon }} {{ ev.name }}</span>
          <span class="mono">{{ ev.dayName }}<span v-if="ev.weekday === nowWeekday" class="badge badge-on">今天</span></span>
          <span class="dim mono">{{ hoursText(ev) }}</span>
          <span class="dim">{{ ev.desc }}</span>
        </div>
      </div>
    </div>

    <!-- 每日轮换 -->
    <div class="card mk-card">
      <div class="mk-h">🔁 每日轮换（每天都开）</div>
      <div class="mk-table">
        <div class="mk-th"><span>活动</span><span>时段</span><span>效果</span><span>状态</span></div>
        <div
          v-for="ev in dailyEvents"
          :key="ev.id"
          class="mk-tr"
          :class="{ on: activeNow.some((a) => a.id === ev.id) }"
        >
          <span>{{ ev.icon }} {{ ev.name }}</span>
          <span class="dim mono">{{ hoursText(ev) }}</span>
          <span class="dim">{{ ev.desc }}</span>
          <span>
            <span v-if="activeNow.some((a) => a.id === ev.id)" class="badge badge-on">{{ remainText(ev) }}</span>
            <span v-else class="dim">未开始</span>
          </span>
        </div>
      </div>
      <p class="dim mk-note">
        「午夜食堂」跨夜（22:00–次日 01:00），排班表里拆成两段显示。时段按<b>本机时间</b>判定，改系统时区会影响命中。
      </p>
    </div>

    <RelatedPages :links="RELATED" />
  </div>
</template>

<style scoped>
.mk-hero {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mk-now {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mk-now-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.mk-now-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  padding: 6px 9px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px solid var(--accent, #d95a38);
}
.mk-now-name {
  font-weight: 600;
}
.mk-none {
  font-size: 13px;
  margin: 0;
}
.mk-boost {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.mk-chip {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.mk-card {
  margin-top: 12px;
}
.mk-h {
  font-weight: 600;
}
.mk-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
  margin-top: 10px;
}
@media (max-width: 720px) {
  .mk-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.mk-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 2px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px dashed var(--border);
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.mk-cell.hot {
  background: rgba(217, 90, 56, 0.16);
  border-style: solid;
  border-color: rgba(217, 90, 56, 0.45);
}
.mk-cell.now {
  outline: 2px solid var(--accent, #d95a38);
  outline-offset: 1px;
}
.mk-cell-h {
  font-size: 11px;
}
.mk-cell-icons {
  font-size: 11px;
  line-height: 1.1;
  min-height: 13px;
}
.mk-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  padding: 7px 9px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
}
.mk-note {
  font-size: 12px;
  line-height: 1.7;
  margin-top: 8px;
}
.mk-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 13px;
}
.mk-th,
.mk-tr {
  display: grid;
  grid-template-columns: minmax(120px, 1.1fr) 1.3fr 1.4fr 1.6fr;
  gap: 10px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
}
.mk-th {
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px dashed var(--border);
}
.mk-tr {
  background: var(--bg-soft);
  border: 1px dashed var(--border);
}
.mk-tr.on {
  border-style: solid;
  border-color: var(--accent, #d95a38);
}
</style>
