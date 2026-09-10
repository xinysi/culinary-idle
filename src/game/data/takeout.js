// 外卖业务（2026-09-10 新增）— 餐厅第三条经营线：按小时消耗库存料理换金币（单价高于堂食）。
// 与堂食（菜单按小时产金币）、分店（纯金币时收）互补：外卖需要「有存货」才能成交，逼玩家多备货。
// 设计约束：只消耗既有料理、产出金币；不新增物品、不改动餐厅/分店既有数值。

/** 外卖等级：每级 +1 并发单量、+10% 单价 */
export const TAKEOUT_MAX_LEVEL = 5
export const TAKEOUT_UPGRADE_COST = [0, 20000, 60000, 150000, 400000] // 升到第 N 级的花费（index = 目标等级-1）

/** 每单消耗 1 份料理，单价 = 料理价值 × 1.2 × (1 + 0.1 × (等级-1)) */
export const TAKEOUT_PRICE_MULT = 1.2

export function takeoutLevelFromExp(exp) {
  const n = Math.max(0, Math.floor(exp ?? 0))
  return Math.max(1, Math.min(TAKEOUT_MAX_LEVEL, 1 + Math.floor(n / 50))) // 每完成 50 单升 1 级
}

/** 升到 nextLevel 的花费（nextLevel 2~5）；超范围返回 null */
export function takeoutUpgradeCost(nextLevel) {
  const lv = Math.floor(nextLevel ?? 1)
  if (lv < 2 || lv > TAKEOUT_MAX_LEVEL) return null
  return TAKEOUT_UPGRADE_COST[lv - 1] ?? null
}

/** 每小时并发单量 = 等级 */
export function takeoutConcurrency(level) {
  return Math.max(1, Math.min(TAKEOUT_MAX_LEVEL, Math.floor(level ?? 1)))
}

/** 单份料理的外卖价格 */
export function takeoutPrice(item, level = 1) {
  const base = (item?.value ?? 0) + (item?.heal ?? 0) * 0.5
  return Math.max(1, Math.round(base * TAKEOUT_PRICE_MULT * (1 + 0.1 * (Math.max(1, level) - 1))))
}
