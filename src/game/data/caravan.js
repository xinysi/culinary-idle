// 商队线（2026-09-14 新增）— 「挂机产线」第 6 个系统：**投本金做择时贸易**。
//
// 与既有系统的分工（这是它存在的理由）：
//   · 地窖陈酿 = 固定倍率把酒/腌品换成金币（不看行情）；
//   · 交易所   = 手动买低卖高，有每日件数上限（行情是「此刻」的）；
//   · 商队线   = 装载一批货出海，**按「归队时刻」的行情结算** —— 玩家要判断「什么时候回来」，
//                可能赚也可能亏（有 75% 保底）。行情函数直接复用 exchange.js 的 priceMultiplier
//                （每 4 小时一期的确定性价格），不新增任何价格体系。
//
// 设计约束：不新增物品、不改动既有物品价值与行情公式；商路 = 已考察的产地（读 regions.js）。
import { CARAVAN_CARGO_CAP } from './caps.js'
import { REGIONS, getRegion, isInSeason } from './regions.js'
import { SIDELINE_ITEM_CATEGORIES } from './sidelineWorks.js'

const REGION_IDS = REGIONS.map((r) => r.id)

/** 解锁：调料调配（与交易所同技能，等级更高一档） */
export const CARAVAN_UNLOCK_SKILL = 'spiceMixing'
export const CARAVAN_UNLOCK_LEVEL = 20

/** 槽位：起步 1 个，最多 3 个（扩建费用按顺序取） */
export const CARAVAN_BASE_SLOTS = 1
export const CARAVAN_MAX_SLOTS = 3
export const CARAVAN_EXPAND_COSTS = [30000, 90000]

/** 单槽本金上限（价值合计）与亏损保底 */
export const CARAVAN_CARGO_LIMIT = CARAVAN_CARGO_CAP
export const CARAVAN_LOSS_FLOOR = 0.75 // 最差情况：连本带利只回 75%（亏 25%）

/** 可装载的货物类别（食材/料理/饮品/调料；排除装备、种子、食灵、矿物——它们不是「货」） */
export const CARAVAN_CARGO_TYPES = ['ingredient', 'food', 'drink', 'spice']
/** 排除的类别（矿物/化石/材料/补给 + 全部副业独占品：锻造/宝石/装潢/副业作品的原料，不该被当货卖掉） */
export const CARAVAN_EXCLUDE_CATEGORIES = ['mineral', 'fossil', 'material', 'supply', ...SIDELINE_ITEM_CATEGORIES]

/**
 * 商路：**每个已考察的产地各是一条商路**，按考察费档位分远近：
 * 越远的商路耗时越长、系数越高（收益更高，但资金压得更久）。
 * hours 与 coeff 由考察费档位推导（cost ≤ 20000 → 最近；≥ 120000 → 最远）。
 */
const ROUTE_BY_COST = [
  { maxCost: 25000, hours: 4, coeff: 1.0 },
  { maxCost: 45000, hours: 6, coeff: 1.08 },
  { maxCost: 55000, hours: 6, coeff: 1.08 },
  { maxCost: 65000, hours: 8, coeff: 1.16 },
  { maxCost: 75000, hours: 8, coeff: 1.16 },
  { maxCost: 90000, hours: 10, coeff: 1.24 },
  { maxCost: Infinity, hours: 12, coeff: 1.32 },
]

/** 特产带回概率（当季路线更高） */
export const CARAVAN_SPECIALTY_CHANCE = 0.35
export const CARAVAN_SPECIALTY_SEASON_BONUS = 0.15

/** 产地 → 商路（耗时/系数/特产池/当季加成） */
export function caravanRoute(regionId, month = new Date().getMonth() + 1) {
  const region = getRegion(regionId)
  if (!region) return null
  const byCost = ROUTE_BY_COST.find((r) => (region.cost ?? 0) <= r.maxCost) ?? ROUTE_BY_COST[ROUTE_BY_COST.length - 1]
  const inSeason = isInSeason(region, month)
  return {
    regionId: region.id,
    name: region.name,
    icon: region.icon,
    hours: byCost.hours,
    coeff: byCost.coeff,
    // 当季商路额外 +10%（与采集队派驻的「当季 ×1.5」不同量级：这里是行情生意的顺风，不是产量）
    seasonMult: inSeason ? 1.1 : 1,
    inSeason,
    box: region.box ?? [],
    specialtyChance: CARAVAN_SPECIALTY_CHANCE + (inSeason ? CARAVAN_SPECIALTY_SEASON_BONUS : 0),
  }
}

/** 全部商路（按耗时升序，UI 直接用） */
export function allCaravanRoutes(month = new Date().getMonth() + 1) {
  return REGION_IDS.map((id) => caravanRoute(id, month)).filter(Boolean).sort((a, b) => a.hours - b.hours)
}

/** 某条商路是否可派（该产地已考察） */
export function caravanRouteUnlocked(player, regionId) {
  return !!player?.regions?.[regionId]
}

/** 扩建费用（slots 为当前槽位数；已满返回 null） */
export function nextCaravanExpandCost(slots) {
  return CARAVAN_EXPAND_COSTS[slots - CARAVAN_BASE_SLOTS] ?? null
}
