// 地窖陈酿（2026-09-10 新增）— 时间型放置线：把酒类/腌制品放入地窖，按档位成熟后领取金币。
// 设计约束：不新增任何物品、不改动既有物品数值与配方；消耗既有物品、产出金币（按物品价值 × 成熟倍率）。
// 与远行采集队同模型：纯时间戳驱动（离线照常计时），到期手动领取；撤回可无损取回原物。

/** 解锁条件：调酒达到该等级 */
export const CELLAR_UNLOCK_SKILL = 'brewing'
export const CELLAR_UNLOCK_LEVEL = 10

/** 可陈酿的物品类别（酒类 / 腌制品——越陈越醇） */
export const CELLAR_CATEGORIES = ['wine', 'pickled']

/** 初始槽位与扩建（扩建费用递增，上限 9 格） */
export const CELLAR_BASE_SLOTS = 3
export const CELLAR_MAX_SLOTS = 9
export const CELLAR_EXPAND_COSTS = [5000, 25000] // 3→6→9

/** 单槽限制：件数 1~99，且基础价值（Σ 单价×件数）不超过该上限 */
export const CELLAR_MAX_QTY = 99
export const CELLAR_MAX_BASE_VALUE = 16000

/** 成熟档位：{ hours 时长, mult 价值倍率 } */
export const CELLAR_TIERS = [
  { hours: 12, mult: 1.5 },
  { hours: 24, mult: 2 },
  { hours: 48, mult: 3 },
]

export function cellarTier(hours) {
  return CELLAR_TIERS.find((t) => t.hours === hours) ?? CELLAR_TIERS[0]
}

/** 某槽位可扩建到的下一档费用（已满级返回 null） */
export function nextCellarExpandCost(slots) {
  const idx = Math.round((slots - CELLAR_BASE_SLOTS) / 3)
  if (idx < 0) return CELLAR_EXPAND_COSTS[0] ?? null
  return CELLAR_EXPAND_COSTS[idx] ?? null
}

/** 陈酿结算金币：基础价值 × 倍率（向下取整） */
export function cellarPayout(baseValue, mult) {
  return Math.max(1, Math.round(baseValue * mult))
}
