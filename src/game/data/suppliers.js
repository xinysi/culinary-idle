// 供应商合约（2026-09-10 新增）— 与交易所互补的长约：锁定单价、每日定量到货，期限 7 天。
// 设计约束：交货为既有食材、结算为金币；不新增物品、不改动物价基准（单价 = 价值 × 0.78，比商店便宜、比自采贵）。
export const SUPPLIER_TERM_DAYS = 7
export const SUPPLIER_PRICE_MULT = 0.78

/** 可签约的供应商（物品池为既有食材，按稀有度分档，签约门槛用金币） */
export const SUPPLIERS = [
  { id: 'sp_grain', name: '粮油行', icon: '🌾', itemId: 'flour', qty: 30, deposit: 6000, desc: '每日 30 袋面粉' },
  { id: 'sp_veg', name: '菜商', icon: '🥬', itemId: 'cabbage', qty: 40, deposit: 8000, desc: '每日 40 颗白菜' },
  { id: 'sp_meat', name: '肉铺', icon: '🥩', itemId: 'boarMeat', qty: 20, deposit: 20000, desc: '每日 20 份野猪肉' },
  { id: 'sp_sea', name: '渔行', icon: '🐟', itemId: 'salmon', qty: 20, deposit: 26000, desc: '每日 20 尾三文鱼' },
  { id: 'sp_spice', name: '香料铺', icon: '🌿', itemId: 'peppercorn', qty: 15, deposit: 30000, desc: '每日 15 份花椒' },
  { id: 'sp_wine', name: '酒坊', icon: '🍶', itemId: 'riceWine', qty: 15, deposit: 24000, desc: '每日 15 坛糯米酒' },
  { id: 'sp_lux', name: '山珍行', icon: '🍄', itemId: 'truffle', qty: 5, deposit: 90000, desc: '每日 5 颗松露' },  { id: 'sp_egg', name: '蛋品行', icon: '🥚', itemId: 'pheasantEgg', qty: 30, deposit: 12000, desc: '每日 30 个野鸡蛋' },
  { id: 'sp_sauce', name: '酱园', icon: '🫙', itemId: 'soySauce', qty: 20, deposit: 18000, desc: '每日 20 坛酱油' },

]

const SUPPLIER_INDEX = new Map(SUPPLIERS.map((s) => [s.id, s]))

export function getSupplier(id) {
  return SUPPLIER_INDEX.get(id) ?? null
}

/** 每日货款（单价 = 物品价值 × 0.78 × 数量） */
export function supplierDailyCost(def, itemValue) {
  return Math.max(1, Math.round((itemValue ?? 0) * SUPPLIER_PRICE_MULT * (def?.qty ?? 0)))
}

/** 同时可签约的合约数上限 */
export const SUPPLIER_MAX_CONTRACTS = 3
