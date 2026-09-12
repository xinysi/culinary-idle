// 节庆日历（2026-09-10 新增）— 按「每月固定日期」触发的限时加成（与每日整点的限时活动互补）。
// 设计约束：纯读取日期计算，不新增物品、不改动任何既有数值；效果并入 marketBoost 与采集产量两条既有乘区。

/**
 * 节庆定义：dayRule 命中当月某日即生效（days / range / lastDays 三种写法）。
 * boost 字段可含 restaurant / gatherXp / craftXp / combatXp / gatherYield（倍率，缺省 1）。
 */
export const FESTIVALS = [
  { id: 'opening', name: '开市日', icon: '🎊', days: [1], boost: { restaurant: 1.5 }, desc: '餐厅收入 ×1.5' },
  { id: 'harvest', name: '丰收祭', icon: '🌾', range: [8, 10], boost: { gatherYield: 1.25, gatherXp: 1.15 }, desc: '采集产量 ×1.25、采集经验 ×1.15' },
  { id: 'moonbanquet', name: '满月宴', icon: '🌕', days: [15], boost: { restaurant: 1.3 }, desc: '餐厅收入 ×1.3' },
  { id: 'stoveking', name: '灶王诞', icon: '🔥', days: [18], boost: { craftXp: 1.35 }, desc: '制作经验 ×1.35' },
  { id: 'foodgod', name: '食神祭', icon: '🕯️', days: [22], boost: { combatXp: 1.35 }, desc: '对决经验 ×1.35' },
  { id: 'nightmarket', name: '月末夜市', icon: '🏮', lastDays: 2, boost: { restaurant: 1.6, combatXp: 1.2 }, desc: '餐厅收入 ×1.6、对决经验 ×1.2' },  { id: 'teaday', name: '品茶日', icon: '🍵', days: [6], boost: { gatherXp: 1.25, restaurant: 1.2 }, desc: '采集经验 ×1.25、餐厅收入 ×1.2' },
  { id: 'hotpotday', name: '暖锅日', icon: '🍲', days: [21], boost: { craftXp: 1.3, gatherYield: 1.15 }, desc: '制作经验 ×1.3、采集产量 ×1.15' },

]

/** 当月天数 */
export function daysInMonth(month /* 0-11 */, year = new Date().getFullYear()) {
  return new Date(year, month + 1, 0).getDate()
}

/** 命中的节庆列表（day 为 1-based） */
export function festivalsOn(day, monthDays) {
  return FESTIVALS.filter((f) => {
    if (f.days) return f.days.includes(day)
    if (f.range) return day >= f.range[0] && day <= f.range[1]
    if (f.lastDays) return day > monthDays - f.lastDays
    return false
  })
}

const NEUTRAL = { restaurant: 1, gatherXp: 1, craftXp: 1, combatXp: 1 }

/** 当日节庆聚合加成（无节庆时全为 1） */
export function festivalBoost(now = new Date()) {
  const day = now.getDate()
  const hits = festivalsOn(day, daysInMonth(now.getMonth(), now.getFullYear()))
  if (!hits.length) return { ...NEUTRAL, active: [], gatherYield: 1 }
  const out = { ...NEUTRAL, gatherYield: 1 }
  for (const f of hits) {
    for (const [k, v] of Object.entries(f.boost ?? {})) out[k] = (out[k] ?? 1) * v
  }
  out.active = hits
  return out
}

/** 未来 10 天的节庆预告（含今天） */
export function upcomingFestivals(now = new Date(), days = 10) {
  const out = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const hits = festivalsOn(d.getDate(), daysInMonth(d.getMonth(), d.getFullYear()))
    if (hits.length) out.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, inDays: i, festivals: hits })
  }
  return out
}
