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
// 单次离线补算上限已收敛到 caps.js 的 IDLE_CAP_HOURS（与菌房/网箱同源，2026-09-14）

/**
 * 可驯养的动物：{ id, name, icon, cost 购买金币, hours 周期, feed 每周期饲料, products 每周期产物 }
 * 产物均为既有食材（野鸡蛋 / 牛奶 / 各类肉）。
 */
export const RANCH_ANIMALS = [
  { id: 'chicken', name: '野鸡', icon: '🐔', cost: 8000, hours: 4, feed: { corn: 3 }, products: { pheasantEgg: 2, pheasantMeat: 1, chickenOil: 1 } },
  { id: 'boar', name: '野猪', icon: '🐗', cost: 15000, hours: 6, feed: { potato: 4 }, products: { boarMeat: 2, lard: 1 } },
  { id: 'goat', name: '山羊', icon: '🐐', cost: 25000, hours: 8, feed: { cabbage: 4 }, products: { goatMeat: 1, milk: 1, cheese: 1 } },
  { id: 'bison', name: '野牛', icon: '🐃', cost: 45000, hours: 12, feed: { rice: 5 }, products: { bisonMeat: 1, milk: 2, boneBroth: 1 } },
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

// ── 网箱（2026-09-14 新增；按用户要求**并入牧场页**，不单独开页）──
// 与畜栏同构：占位 + 吃饲料 + 按小时产鱼。差别只在饲料与产物都属水产一脉，
// 且「数量更多、单价更低」（对照畜栏：野鸡 4h 吃玉米×3 → 蛋×2 + 肉×1）。
// 饲料用**海苔**（现有食材，可采集）：项目里没有任何「鱼饵/饵料」物品，新增会牵动图鉴三查
// 与自动出售白名单，故刻意复用既有食材。
export const POND_BASE = 2
export const POND_MAX = 4
export const POND_EXPAND_COSTS = [25000, 70000]

/** 网箱鱼种：{ id, name, icon, cost 购买金币, hours 周期, feed 每周期饲料, products 每周期产物 } */
export const POND_FISH = [
  { id: 'crucian', name: '鲫鱼', icon: '🐟', cost: 6000, hours: 3, feed: { seaweed: 1 }, products: { crucian: 3, fishPaste: 1 } },
  { id: 'salmon', name: '鲑鱼', icon: '🐠', cost: 15000, hours: 5, feed: { seaweed: 2 }, products: { salmon: 3, carp: 2, caviar: 1 } },
  { id: 'lobster', name: '龙虾', icon: '🦞', cost: 26000, hours: 8, feed: { seaweed: 3 }, products: { lobster: 2, perch: 2, shrimpOil: 1 } },
  { id: 'abalone', name: '鲍鱼', icon: '🐚', cost: 48000, hours: 12, feed: { seaweed: 4 }, products: { abalone: 2, tuna: 1, abaloneSauce: 1 } },
]

const POND_INDEX = new Map(POND_FISH.map((f) => [f.id, f]))

export function getPondFish(id) {
  return POND_INDEX.get(id) ?? null
}

/** 网箱下一档扩建费用（已满返回 null） */
export function nextPondExpandCost(ponds) {
  const idx = Math.max(0, Math.round(ponds - POND_BASE))
  return POND_EXPAND_COSTS[idx] ?? null
}
