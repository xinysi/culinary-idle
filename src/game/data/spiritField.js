// 灵田（2026-09-14 新增）— 「挂机产线」第 8 个系统：**大后期的「定向」稀有灵植产线**。
//
// 为什么需要它：采集队只能跑固定池（随机）、探索是卡片、产地只是乘区；而灵果/龙根/灵芝/松露
// 这类大后期材料此前**没有定向、稳定**的获取方式。灵田把「种子 → 灵植」做成一条长周期产线：
// 种什么得什么，代价是周期长（24~72h）与**消耗种子**（种子本身是硬通货/掉落物，天然限速）。
//
// 与农耕/温室的分工：
//   · 农田  = 按农耕等级种 184 种作物，周期短（90~990 秒），是日常口粮；
//   · 温室  = 农田的「加位 + 提速」版，并伴生蜂蜜（见 greenhouse.js）；
//   · 灵田  = **只收稀有种子**，周期以「小时×天」计，走「种下 → 到点手动收取 → 自动续种」的采集队模型。
//
// 设计约束：不新增物品；种子与产物都是既有物品（灵果种子/龙根种子/灵芝种子/松露种子 → 对应材料）。
// 每格产量按「种子价值 × 周期」标定，保证不会出现「买种子 → 卖材料」的越级刷钱（见注释中的对照）。
import { getItem } from './items.js'

/** 解锁：采摘（灵植属山野采集一脉）+ 需先有灵田的直觉——等级门槛设在中期后段 */
export const SPIRIT_UNLOCK_SKILL = 'foraging'
export const SPIRIT_UNLOCK_LEVEL = 45

export const SPIRIT_BASE_PLOTS = 1
export const SPIRIT_MAX_PLOTS = 3
export const SPIRIT_EXPAND_COSTS = [40000, 120000]

/**
 * 灵植表：seedId → 周期与产物。
 * 数值对照（种子店内价 → 每格每周期产出价值）：
 *   灵芝种子  27 金 / 24h → 灵芝 ×2（180）×1.1 熟练加成 ≈ 198
 *   松露种子  66 金 / 36h → 松露 ×2 + 松茸 ×1（580）
 *   龙根种子  84 金 / 48h → 龙根 ×2（560）
 *   灵果种子 105 金 / 72h → 灵果 ×2（700）
 * 对照地窖（12h ×1.5、单槽上限 16000 → 约 8000 金/12h/槽）：灵田的**金币效率明显更低**，
 * 它的价值在「拿到本来只能靠低概率掉落的稀有材料」，而不是刷钱。
 */
export const SPIRIT_PLANTS = [
  { id: 'lingzhi', seedId: 'lingzhiSeed', name: '灵芝田', icon: '🌿', hours: 24, products: { lingzhi: 2 }, reqLevel: 40 },
  { id: 'truffle', seedId: 'truffleSeed', name: '松露圃', icon: '🫘', hours: 36, products: { truffle: 2, matsutake: 1 }, reqLevel: 55 },
  { id: 'dragonRoot', seedId: 'dragonRootSeed', name: '龙根畦', icon: '🐉', hours: 48, products: { dragonRoot: 2 }, reqLevel: 70 },
  { id: 'spiritFruit', seedId: 'spiritFruitSeed', name: '灵果藤', icon: '✨', hours: 72, products: { spiritFruit: 2 }, reqLevel: 85 },
]

const PLANT_BY_SEED = new Map(SPIRIT_PLANTS.map((p) => [p.seedId, p]))

export function getSpiritPlantBySeed(seedId) {
  return PLANT_BY_SEED.get(seedId) ?? null
}

export function getSpiritPlant(id) {
  return SPIRIT_PLANTS.find((p) => p.id === id) ?? null
}

/** 该种子此刻是否可种（等级门槛 + 背包有种子）——由调用方补 inventory 判定 */
export function spiritSeedAvailable(player, seedId) {
  const plant = getSpiritPlantBySeed(seedId)
  if (!plant) return false
  return (player?.skills?.[SPIRIT_UNLOCK_SKILL]?.level ?? 1) >= plant.reqLevel
}

/** 产物文案（UI 复用） */
export function spiritProductText(def) {
  return Object.entries(def?.products ?? {})
    .map(([id, q]) => `${getItem(id)?.name ?? id}×${q}`)
    .join(' + ')
}

/** 扩建费用（plots 为当前格数；已满返回 null） */
export function nextSpiritExpandCost(plots) {
  return SPIRIT_EXPAND_COSTS[plots - SPIRIT_BASE_PLOTS] ?? null
}
