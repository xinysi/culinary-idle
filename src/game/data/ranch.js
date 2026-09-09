// 牧场养殖（2026-09-10 新增）— 驯养野生动物，按周期消耗作物产出蛋/奶/肉（全部为既有物品）。
// 设计约束：不新增物品、不改动既有物品数值；饲料为既有作物，产物为既有食材。
// 与采集队同模型：纯时间戳驱动，离线照常结算（单次最多补 12 小时）。

/** 解锁条件：农耕达到该等级 */
export const RANCH_UNLOCK_SKILL = 'farming'
export const RANCH_UNLOCK_LEVEL = 15

/** 栏位：初始 2 个，扩建至 4 个 */
export const RANCH_BASE_PENS = 2
export const RANCH_MAX_PENS = 4
export const RANCH_EXPAND_COSTS = [20000, 60000]

/** 离线最多补算时长（小时） */
export const RANCH_OFFLINE_CAP_HOURS = 12

/**
 * 可驯养的动物：{ id, name, icon, cost 购买金币, hours 周期, feed 每周期饲料, products 每周期产物 }
 * 产物均为既有食材（野鸡蛋 / 牛奶 / 各类肉）。
 */
export const RANCH_ANIMALS = [
  { id: 'chicken', name: '野鸡', icon: '🐔', cost: 8000, hours: 4, feed: { corn: 3 }, products: { pheasantEgg: 2, pheasantMeat: 1 } },
  { id: 'boar', name: '野猪', icon: '🐗', cost: 15000, hours: 6, feed: { potato: 4 }, products: { boarMeat: 1 } },
  { id: 'goat', name: '山羊', icon: '🐐', cost: 25000, hours: 8, feed: { cabbage: 4 }, products: { goatMeat: 1, milk: 1 } },
  { id: 'bison', name: '野牛', icon: '🐃', cost: 45000, hours: 12, feed: { rice: 5 }, products: { bisonMeat: 1, milk: 2 } },
]

const ANIMAL_INDEX = new Map(RANCH_ANIMALS.map((a) => [a.id, a]))

export function getAnimal(id) {
  return ANIMAL_INDEX.get(id) ?? null
}

/** 下一档扩建费用（已满返回 null） */
export function nextRanchExpandCost(pens) {
  const idx = Math.max(0, Math.round((pens - RANCH_BASE_PENS) / 1))
  return RANCH_EXPAND_COSTS[idx] ?? null
}

/** 单周期产物文字（用于日志/界面） */
export function productText(def) {
  return Object.entries(def?.products ?? {}).map(([id, q]) => `${id} ×${q}`).join('、')
}
