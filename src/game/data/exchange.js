// 交易所（2026-09-10 新增）— 动态价格市场：每 4 小时轮换 6 种货物，价格随行情浮动，买低卖高。
// 设计约束：不新增物品、不改动既有物品价值；价格以物品 value 为基准做确定性浮动（同一时段同一价格）。
// 行情公式：倍率 = 0.6 + (hash(id, 时段) % 101) / 100 × 1.0 → [0.60, 1.60]；
//   收购价 = value × 倍率（玩家卖出）；售出价 = 收购价 × 1.35（玩家买入），保证买卖有价差。
// 每日每件限 60 件，防止无限套利。

/** 解锁条件：调料调配达到该等级 */
export const EXCHANGE_UNLOCK_SKILL = 'spiceMixing'
export const EXCHANGE_UNLOCK_LEVEL = 10

/** 轮换周期（小时）与每期货物品数 */
export const EXCHANGE_CYCLE_HOURS = 4
export const EXCHANGE_GOODS_COUNT = 6

/** 买卖价差与每日限额 */
export const EXCHANGE_SPREAD = 1.35
export const EXCHANGE_DAILY_LIMIT = 60

/** 候选货池：可交易食材（价值 20~300，排除矿物/化石/材料/补给——它们是锻造与宝石原料） */
export const EXCHANGE_POOL_CATEGORIES = [
  'root', 'vegetable', 'fruit', 'meat', 'seafood', 'egg', 'fungus', 'mushroom',
  'crop', 'grain', 'flower', 'herb', 'legume', 'spicePlant', 'dairy', 'drinkBase', 'pickled', 'seasoning',
]

/** 当前时段序号（每 4 小时一期） */
export function exchangeCycleIndex(nowMs = Date.now()) {
  return Math.floor(nowMs / (EXCHANGE_CYCLE_HOURS * 3600_000))
}

/** 确定性哈希（同一 (id, 期) 恒等） */
function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0)
}

/** 价格倍率 ∈ [0.60, 1.60] */
export function priceMultiplier(itemId, cycle = exchangeCycleIndex()) {
  return 0.6 + ((hash32(`${itemId}#${cycle}`) % 101) / 100) * 1.0
}

/** 玩家卖出价（收购价） */
export function sellPriceOf(item, cycle = exchangeCycleIndex()) {
  return Math.max(1, Math.round((item?.value ?? 0) * priceMultiplier(item.id, cycle)))
}

/** 玩家买入价（含价差） */
export function buyPriceOf(item, cycle = exchangeCycleIndex()) {
  return Math.max(1, Math.round(sellPriceOf(item, cycle) * EXCHANGE_SPREAD))
}

/** 本期货单：从货池中按 (id, 期) 哈希确定性挑 EXCHANGE_GOODS_COUNT 件 */
export function pickGoods(allItems, cycle = exchangeCycleIndex(), count = EXCHANGE_GOODS_COUNT) {
  const pool = Object.values(allItems).filter(
    (it) => it.type === 'ingredient' && EXCHANGE_POOL_CATEGORIES.includes(it.category) && (it.value ?? 0) >= 20 && (it.value ?? 0) <= 300
  )
  return pool
    .map((it) => ({ it, rank: hash32(`${it.id}@${cycle}`) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .map((x) => x.it)
}
