// 限时窗口活动（2026-09-06）— 每日/每周轮换的小徽章 buff，均为基础乘区（不触碰任何固定数据）
// 时段为本地时间小时窗（hours: [起, 止)）；weekday: 0=周日…6=周六（缺省=每天都开）

export const MARKET_EVENTS = [
  {
    id: 'nightMarket',
    icon: '🌙',
    name: '夜市狂潮',
    hours: [[16, 22]],
    desc: '餐厅收入 ×2 · 对决经验 ×1.5',
    effect: { restaurant: 2, combatXp: 1.5 },
  },
  {
    id: 'morningMarket',
    icon: '☀️',
    name: '晨间集市',
    hours: [[6, 9]],
    desc: '采集经验 ×1.5',
    effect: { gatherXp: 1.5 },
  },
  {
    id: 'brainstorm',
    icon: '💡',
    name: '思想风暴',
    hours: [[10, 13]],
    desc: '制作经验 ×2',
    effect: { craftXp: 2 },
  },
  {
    id: 'teaBreak',
    icon: '🍵',
    name: '午后茶歇',
    hours: [[14, 17]],
    desc: '制作经验 ×1.5',
    effect: { craftXp: 1.5 },
  },
  {
    id: 'nightDiner',
    icon: '🌌',
    name: '午夜食堂',
    hours: [[22, 24], [0, 1]],
    desc: '对决经验 ×2（深夜对决党）',
    effect: { combatXp: 2 },
  },
  {
    id: 'chefDay',
    icon: '🎉',
    name: '主厨日',
    weekday: 0, // 仅周日
    hours: [[9, 21]],
    desc: '【每周日】餐厅收入 ×1.5',
    effect: { restaurant: 1.5 },
  },
  {
    id: 'kfcThursday',
    icon: '🐔',
    name: '疯狂星期四',
    weekday: 4, // 仅周四
    hours: [[9, 21]],
    desc: '【每周四】餐厅收入 ×1.5',
    effect: { restaurant: 1.5 },
  },
]

/** 夜市狂潮的活动 id（**副业·蜡烛的出口就是延长它**） */
export const NIGHT_MARKET_ID = 'nightMarket'
/** 夜市狂潮的**基础**起止小时（16:00–22:00）；延长量只加在结束侧 */
const NIGHT_MARKET_BASE_START = 16
const NIGHT_MARKET_BASE_END = 22
/** 蜡烛能延长的上限小时数（= 8 件蜡烛各 +1h，见 `SIDELINE_AXIS_TOTALS.nightHours`） */
export const NIGHT_MARKET_MAX_EXTRA_HOURS = 8

/**
 * 把夜市狂潮窗口按 `extraHours` 向**后**延长，返回一份替换过的活动表。
 * 结束时间越过 24 点就拆成两段（`[[16,24],[0,余]]`）——与既有「午夜食堂」跨夜的写法一致，
 * 于是 `hoursText()`、排班表、命中判定**全部不用改**就能正确显示与判定。
 * @param {number} extraHours 已解锁的延长小时数（0 = 原样返回 `MARKET_EVENTS`）
 */
export function marketEventsWithNightExtension(extraHours = 0) {
  const extra = Math.max(0, Math.min(NIGHT_MARKET_MAX_EXTRA_HOURS, Math.floor(extraHours || 0)))
  if (!extra) return MARKET_EVENTS
  return MARKET_EVENTS.map((ev) => {
    if (ev.id !== NIGHT_MARKET_ID) return ev
    const end = NIGHT_MARKET_BASE_END + extra
    const hours = end <= 24 ? [[NIGHT_MARKET_BASE_START, end]] : [[NIGHT_MARKET_BASE_START, 24], [0, end - 24]]
    return { ...ev, hours, desc: `餐厅收入 ×2 · 对决经验 ×1.5（蜡烛延长至次日 ${String(end % 24).padStart(2, '0')}:00）` }
  })
}

/** 夜市狂潮的结束小时（可 >24 表示跨夜；UI 文案用） */
export function nightMarketEndHour(events = MARKET_EVENTS) {
  const ev = events.find((e) => e.id === NIGHT_MARKET_ID)
  if (!ev || !ev.hours.length) return NIGHT_MARKET_BASE_END
  const last = ev.hours[ev.hours.length - 1]
  return ev.hours.length > 1 ? 24 + last[1] : last[1]
}

/** 当前时间命中的活动列表（可传参测试；weekday 缺省取真实星期；
 *  `events` 可传「已按蜡烛延长的活动表」，缺省用基础表） */
export function activeMarketEvents(hour = null, weekday = null, events = MARKET_EVENTS) {
  const h = hour ?? new Date().getHours()
  const w = weekday ?? new Date().getDay()
  return events.filter((ev) => {
    if (ev.weekday !== undefined && ev.weekday !== w) return false
    return ev.hours.some(([s, e]) => (s <= e ? h >= s && h < e : h >= s || h < e)) // 支持跨夜 [22,24)+(0,1)
  })
}

/** 聚合倍率：命中活动相乘（可叠加） */
export function aggregateMarketBoost(hour = null, weekday = null, events = MARKET_EVENTS) {
  const out = { restaurant: 1, combatXp: 1, gatherXp: 1, craftXp: 1 }
  for (const ev of activeMarketEvents(hour, weekday, events)) {
    for (const [k, v] of Object.entries(ev.effect)) out[k] = (out[k] ?? 1) * v
  }
  return out
}
