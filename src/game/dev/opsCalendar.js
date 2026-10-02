// 运营日历 —— **只读**排期聚合（2026-10-02 新角色 ops 的方案 1）
//
// 用途：把散在各页的限时活动（`marketEvents`）与节庆（`festivals`）收成一张「运营日历」：
//   今日命中 / 本周限时排班 / 本月节庆 / 未来预告 —— 并导出 JSON / Markdown（排期表）。
//
// 🔒 只读 + **不接覆盖层**（刻意）：限时窗口/节庆的倍率是「成长标定口径」的一部分（AGENTS 明令），
//    给它们加运行时覆盖会牵动已标定的时长/经济曲线 ⇒ 本层只做**展示 + 导出**，不改任何结算。
import { MARKET_EVENTS, activeMarketEvents } from '../data/marketEvents.js'
import { FESTIVALS, festivalsOn, daysInMonth, festivalBoost, upcomingFestivals } from '../data/festivals.js'

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 限时活动周排班：7(天) × 24(小时) → 命中的活动 id 数组 */
export function weeklyGrid() {
  const grid = []
  for (let w = 0; w < 7; w++) {
    const row = []
    for (let h = 0; h < 24; h++) row.push(activeMarketEvents(h, w).map((e) => e.id))
    grid.push(row)
  }
  return grid
}

/** 某活动在周几的哪些小时开（排班表用；含跨夜拆段） */
export function eventHoursText(ev) {
  if (!ev?.hours?.length) return '全天'
  return ev.hours.map(([s, e]) => `${String(s).padStart(2, '0')}:00–${String(e).padStart(2, '0')}:00`).join(' + ')
}

/** 当月节庆日历：每天 → 命中的节庆 */
export function monthFestivals(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const n = daysInMonth(m, y)
  const out = []
  for (let d = 1; d <= n; d++) out.push({ day: d, festivals: festivalsOn(d, n) })
  return out
}

/** 今日快照：命中的限时活动 + 节庆聚合加成 */
export function todaySnapshot(now = new Date()) {
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    weekday: WEEKDAYS[now.getDay()],
    market: activeMarketEvents(now.getHours(), now.getDay()),
    festival: festivalBoost(now),
  }
}

/** 一次性算齐「运营日历」页要的块 */
export function collectCalendar(now = new Date()) {
  return {
    today: todaySnapshot(now),
    grid: weeklyGrid(),
    month: monthFestivals(now),
    upcoming: upcomingFestivals(now, 14),
    marketEvents: MARKET_EVENTS,
    festivals: FESTIVALS,
  }
}

const pct = (v) => (v === 1 ? '' : ` ×${Number(v).toFixed(2)}`)

/** 今日加成摘要（限时 + 节庆合并成一句） */
export function todayBoostText(today) {
  const parts = []
  for (const ev of today.market) parts.push(`${ev.icon}${ev.name}`)
  for (const f of today.festival.active ?? []) parts.push(`${f.icon}${f.name}`)
  const gains = []
  const fb = today.festival
  for (const k of ['restaurant', 'gatherXp', 'craftXp', 'combatXp', 'gatherYield']) if (fb[k] && fb[k] !== 1) gains.push(`${k}${pct(fb[k])}`)
  const head = parts.length ? parts.join(' · ') : '无'
  return gains.length ? `${head}（${gains.join('、')}）` : head
}

/** 导出 JSON（排期定义 + 今日命中 + 未来预告） */
export function scheduleExport(now = new Date()) {
  return {
    exportedAt: now.toISOString(),
    marketEvents: MARKET_EVENTS.map((e) => ({ id: e.id, name: e.name, weekday: e.weekday ?? null, hours: e.hours, effect: e.effect, desc: e.desc })),
    festivals: FESTIVALS.map((f) => ({ id: f.id, name: f.name, days: f.days ?? null, range: f.range ?? null, lastDays: f.lastDays ?? null, boost: f.boost, desc: f.desc })),
    today: todaySnapshot(now),
    upcoming: upcomingFestivals(now, 14),
  }
}

/** 导出 Markdown（一页排期表） */
export function scheduleMarkdown(now = new Date()) {
  const cal = collectCalendar(now)
  const L = []
  L.push('# 运营排期表')
  L.push('')
  L.push(`> 导出时间：${now.toLocaleString()} · ${cal.today.date}（${cal.today.weekday}）`)
  L.push('')
  L.push(`**今日加成**：${todayBoostText(cal.today)}`)
  L.push('')
  L.push('## 限时活动（每日/每周时段）')
  L.push('')
  L.push('| 活动 | 时段 | 生效日 | 效果 |')
  L.push('| --- | --- | --- | --- |')
  for (const e of cal.marketEvents) {
    L.push(`| ${e.icon} ${e.name} | ${eventHoursText(e)} | ${e.weekday !== undefined ? WEEKDAYS[e.weekday] : '每天'} | ${e.desc} |`)
  }
  L.push('')
  L.push('## 本月节庆')
  L.push('')
  L.push('| 日期 | 节庆 | 效果 |')
  L.push('| --- | --- | --- |')
  for (const d of cal.month) {
    if (!d.festivals.length) continue
    L.push(`| ${d.day} 日 | ${d.festivals.map((f) => `${f.icon} ${f.name}`).join(' / ')} | ${d.festivals.map((f) => f.desc).join('；')} |`)
  }
  L.push('')
  L.push('## 未来 14 天预告')
  L.push('')
  for (const u of cal.upcoming) L.push(`- ${u.date}（${u.inDays === 0 ? '今天' : u.inDays + ' 天后'}）：${u.festivals.map((f) => `${f.icon} ${f.name}${f.desc ? '（' + f.desc + '）' : ''}`).join(' · ')}`)
  L.push('')
  return L.join('\n')
}
