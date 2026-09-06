// 限时窗口活动（2026-09-06）— 每日/每周轮换的小徽章 buff，均为基础乘区（不触碰任何固定数据）
// 时段为本地时间小时窗（hours: [起, 止)）；weekday: 0=周日…6=周六（缺省=每天都开）

export const MARKET_EVENTS = [
  {
    id: 'nightMarket',
    icon: '🌙',
    name: '夜市狂潮',
    hours: [[12, 20]],
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
]

/** 当前时间命中的活动列表（可传参测试；weekday 缺省取真实星期 */
export function activeMarketEvents(hour = null, weekday = null) {
  const h = hour ?? new Date().getHours()
  const w = weekday ?? new Date().getDay()
  return MARKET_EVENTS.filter((ev) => {
    if (ev.weekday !== undefined && ev.weekday !== w) return false
    return ev.hours.some(([s, e]) => (s <= e ? h >= s && h < e : h >= s || h < e)) // 支持跨夜 [22,24)+(0,1)
  })
}

/** 聚合倍率：命中活动相乘（可叠加） */
export function aggregateMarketBoost(hour = null, weekday = null) {
  const out = { restaurant: 1, combatXp: 1, gatherXp: 1, craftXp: 1 }
  for (const ev of activeMarketEvents(hour, weekday)) {
    for (const [k, v] of Object.entries(ev.effect)) out[k] = (out[k] ?? 1) * v
  }
  return out
}
