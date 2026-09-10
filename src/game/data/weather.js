// 天气与运势（2026-09-10 新增）— 每日变量层：按自然日确定性抽取「天气」与「今日运势」。
// 与「节庆」（按月固定）、「限时活动」（按整点）三层互不冲突；效果只挂在既有聚合点（采集产量/经验、制作经验、餐厅收入）。
// 设计约束：纯日期计算（无存档状态）、不新增物品、不改动任何固定数据。

/** 天气：boost 键与 marketBoost 对齐（gatherYield 单独在采集产量处生效） */
export const WEATHERS = [
  { id: 'sunny', name: '晴朗', icon: '☀️', boost: { gatherXp: 1.10 }, desc: '采集经验 +10%' },
  { id: 'rain', name: '细雨', icon: '🌧️', boost: { gatherYield: 1.15 }, desc: '采集产量 +15%' },
  { id: 'snow', name: '落雪', icon: '❄️', boost: { craftXp: 1.12 }, desc: '制作经验 +12%' },
  { id: 'fog', name: '薄雾', icon: '🌫️', boost: { gatherYield: 1.08, craftXp: 1.06 }, desc: '采集产量 +8%、制作经验 +6%' },
  { id: 'thunder', name: '雷暴', icon: '⛈️', boost: { combatXp: 1.15 }, desc: '对决经验 +15%' },
  { id: 'wind', name: '劲风', icon: '🌬️', boost: { restaurant: 1.12 }, desc: '餐厅收入 +12%' },
]

/** 今日「宜做」建议池（按日抽 3 条） */
export const FORTUNE_TIPS = [
  '宜 挂机采集：选一个高等级目标连挂一小时',
  '宜 制作料理：把库存食材清一清，顺便刷配方精通',
  '宜 对决：带足回血料理推一推区域进度',
  '宜 探索：美食探索成功给稀有战利品',
  '宜 经营：把菜单换成高价值料理，餐厅收入更可观',
  '宜 招客：招待一轮常客，好感换小费',
  '宜 远行：把采集队槽位排满，回来就有货',
  '宜 地窖：把囤积的酒入窖，明日出窖换金币',
  '宜 牧场：补一批作物饲料，蛋奶肉不断供',
  '宜 图谱：花见闻点一个节点，永久加成到手',
]

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** 日期键（本地 YYYY-MM-DD） */
export function dayKeyOf(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今日天气（按日期确定性） */
export function weatherForDay(dayKey = dayKeyOf()) {
  return WEATHERS[hash32('w#' + dayKey) % WEATHERS.length]
}

/**
 * 今日运势：幸运食材 + 宜做三条（幸运食材从给定物品池中确定性抽取）
 * @param {string} dayKey
 * @param {string[]} itemPool 候选食材 id（调用方传「食材」类物品 id）
 */
export function fortuneForDay(dayKey = dayKeyOf(), itemPool = []) {
  const pool = itemPool.length ? itemPool : ['apple']
  const luckyItem = pool[hash32('f#' + dayKey) % pool.length]
  const tips = []
  const seen = new Set()
  let i = 0
  while (tips.length < 3 && i < 40) {
    const t = FORTUNE_TIPS[hash32(`t#${dayKey}#${i}`) % FORTUNE_TIPS.length]
    if (!seen.has(t)) { seen.add(t); tips.push(t) }
    i++
  }
  return { luckyItem, tips }
}

/** 天气聚合加成（无参路径用；显式传日期便于测试） */
export function weatherBoost(dayKey = dayKeyOf()) {
  const w = weatherForDay(dayKey)
  const out = { gatherYield: 1, gatherXp: 1, craftXp: 1, combatXp: 1, restaurant: 1, weather: w }
  for (const [k, v] of Object.entries(w.boost ?? {})) out[k] = v
  return out
}
