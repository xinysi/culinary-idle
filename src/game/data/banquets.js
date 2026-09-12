// 宴会承办（2026-09-10 新增）— 限时大订单：一次性交付大量指定类别料理，换大奖。
// 与食客订单（1~2 份小单）、评论家（1 份高 tier）互补；消耗库存与批量制作产能。
// 设计约束：要求与奖励只读取/使用既有物品与金币，不新增物品、不改动任何固定数据。

/** 宴席规模：越大要求越多、时限越长、奖励越厚 */
export const BANQUET_TIERS = [
  { id: 'b10', name: '家宴', tables: 10, hours: 12, goldBase: 6000, spice: 1, minTier: 2, reqCats: 1 },
  { id: 'b20', name: '寿宴', tables: 20, hours: 18, goldBase: 14000, spice: 1, minTier: 3, reqCats: 2 },
  { id: 'b40', name: '官宴', tables: 40, hours: 24, goldBase: 32000, spice: 2, minTier: 4, reqCats: 2 },
  { id: 'b60', name: '国宴', tables: 60, hours: 36, goldBase: 70000, spice: 3, minTier: 5, reqCats: 3 },
  { id: 'b80', name: '皇宴', tables: 80, hours: 48, goldBase: 120000, spice: 4, minTier: 5, reqCats: 3 },
]

/** 可承办的料理类别（与图鉴分类一致） */
export const BANQUET_CATS = ['主菜', '汤品', '甜点', 'baking', '主食']

/** 每位客人按「桌数 × 每桌份数」折算需求份数 */
export const PORTIONS_PER_TABLE = 2

/** 按对决等级挑选合适的宴席规模（等级越高规模越大） */
export function banquetTierFor(combatLevel = 1) {
  const lv = Math.max(1, combatLevel)
  if (lv >= 95) return BANQUET_TIERS[4]
  if (lv >= 70) return BANQUET_TIERS[3]
  if (lv >= 45) return BANQUET_TIERS[2]
  if (lv >= 20) return BANQUET_TIERS[1]
  return BANQUET_TIERS[0]
}

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * 生成一张宴席订单（按「天 + 等级」确定性，便于同日一致）：
 * { tier, cat, need, gold, spice, startedAt, expiresAt }
 */
export function makeBanquetOrder(combatLevel = 1, dayKey = '', cats = BANQUET_CATS) {
  const tier = banquetTierFor(combatLevel)
  const pool = cats.length ? cats : BANQUET_CATS
  const cat = pool[hash32(`banquet#${dayKey}#${tier.id}`) % pool.length]
  const need = tier.tables * PORTIONS_PER_TABLE
  const gold = Math.round(tier.goldBase * (1 + Math.max(0, combatLevel - 1) * 0.02))
  return { tierId: tier.id, tierName: tier.name, cat, minTier: tier.minTier, need, gold, spice: tier.spice, hours: tier.hours, dayKey }
}

/** 交付判定：库存里符合「该类别 + tier ≥ minTier」的料理总份数 */
export function banquetAvailable(player, order, allItems) {
  if (!order) return 0
  let n = 0
  for (const [id, qty] of Object.entries(player.inventory ?? {})) {
    const it = allItems[id]
    if (!it || it.type !== 'food') continue
    if (it.category !== order.cat) continue
    if ((it.tier ?? 0) < order.minTier) continue
    n += qty
  }
  return n
}
