// 菜系研究 / 学派（2026-09-10 新增）— 按「料理大类」分组研究，逐级投入材料 + 真实时间，换取该类料理的永久加成。
// 设计约束：不新增物品（研究材料为既有食材）、不改动任何配方/物品数值；加成在既有聚合点（制作经验/进食回血/餐厅收入）叠加。

/** 六大流派：按既有料理/物品类别划分，避免脆弱的名称匹配 */
export const SCHOOLS = [
  { id: 's_main', name: '红案', icon: '🥘', cats: ['主菜'], mats: ['salt', 'garlic', 'soySauce'], desc: '各类主菜——火候与调味的正面战场' },
  { id: 's_soup', name: '汤羹', icon: '🍲', cats: ['汤品'], mats: ['salt', 'cabbage', 'ginger'], desc: '汤品——慢炖出的鲜味' },
  { id: 's_staple', name: '白案', icon: '🍚', cats: ['主食', 'baking'], mats: ['flour', 'wheat', 'rice'], desc: '主食与烘焙——粮食的本事' },
  { id: 's_dessert', name: '甜点', icon: '🍰', cats: ['甜点'], mats: ['milk', 'pheasantEgg', 'flour'], desc: '甜点——糖与奶的学问' },
  { id: 's_drink', name: '酒饮', icon: '🍷', cats: ['wine', 'juice', 'tea', '茶饮'], mats: ['grape', 'apple', 'jasmine'], desc: '酒、果汁与茶——杯中风味' },
  { id: 's_pickle', name: '腌酿', icon: '🫙', cats: ['pickled', 'seasoning'], mats: ['cabbage', 'salt', 'riceWine'], desc: '腌制品与复合调料——时间的味道' },
]

const SCHOOL_INDEX = new Map(SCHOOLS.map((s) => [s.id, s]))

export function getSchool(id) {
  return SCHOOL_INDEX.get(id) ?? null
}

export const SCHOOL_MAX_LEVEL = 5

/** 升到第 level 级（1~5）的花费：材料 qty = 基础量 × 等级、时长 = 2 + 等级 小时、金币 = 2000 × 等级² */
export function schoolCost(school, level) {
  const lv = Math.max(1, Math.min(SCHOOL_MAX_LEVEL, Math.round(level)))
  const mats = {}
  for (const id of school?.mats ?? []) mats[id] = 10 * lv
  return { mats, hours: 2 + lv, gold: 2000 * lv * lv }
}

/** 每级加成：制作该类配方经验 +5%、进食该类料理回血 +6%、餐厅该类料理贡献 +8% */
export const SCHOOL_PERKS = { craftXpPct: 5, healPct: 6, incomePct: 8 }

/** 某个料理类别属于哪个学派（无匹配返回 null） */
export function schoolOfCategory(category) {
  return SCHOOLS.find((s) => s.cats.includes(category)) ?? null
}
