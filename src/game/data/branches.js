// 餐厅分店（2026-09-10 新增）— 金币开店 → 每小时自动收入；可雇店长提升 25%。
// 设计约束：纯金币经济层，不新增物品、不改动餐厅/装饰既有数值；
// 收入随餐厅等级缩放（与主店成长挂钩），离线照常结算（单次最多补 12 小时）。

/** 解锁条件：餐厅达到该等级 */
export const BRANCH_UNLOCK_LEVEL = 5

/** 离线最多补算时长（小时） */
export const BRANCH_OFFLINE_CAP_HOURS = 12

/** 分店：cost 开店费、goldPerHour 基础时收、managerCost 店长费 */
export const BRANCHES = [
  { id: 'east', name: '城东分店', icon: '🏮', cost: 50000, goldPerHour: 800, managerCost: 20000 },
  { id: 'west', name: '城西分店', icon: '🍜', cost: 150000, goldPerHour: 2200, managerCost: 60000 },
  { id: 'south', name: '城南分店', icon: '🍢', cost: 400000, goldPerHour: 6000, managerCost: 160000 },
  { id: 'north', name: '城北分店', icon: '🍣', cost: 1000000, goldPerHour: 16000, managerCost: 400000 },
]

const BRANCH_INDEX = new Map(BRANCHES.map((b) => [b.id, b]))

export function getBranch(id) {
  return BRANCH_INDEX.get(id) ?? null
}

/** 店长加成（+25% 时收） */
export const MANAGER_BONUS = 0.25

/** 某分店实际时收（含店长 + 餐厅等级缩放） */
export function branchHourly(def, { manager = false, restaurantLevel = 1 } = {}) {
  const lvMult = 1 + 0.1 * Math.max(0, (restaurantLevel ?? 1) - 1)
  const mgr = manager ? 1 + MANAGER_BONUS : 1
  return Math.floor((def?.goldPerHour ?? 0) * lvMult * mgr)
}
