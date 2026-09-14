// 蜂蜜（2026-09-14 新增）— 8 个品级，**唯一来源是「温室蜂场」**（作物伴生 10% + 蜂箱直产），
// 不进任何掉落/商店/抽卡池/交易所，也不作为任何配方材料（因此不会被平衡系统改写数值）。
//
// 为什么这样定：
//  · 既有的 15 件增益剂（preserveTiers.js）是**单效**（只经验 / 只产量），蜂蜜做成**双效**——
//    它占用一个背包格子同时给两条乘区，代价是数值上限低于「两支同阶增益剂叠加」，
//    属于「省心」而非「更强」；品级越高越接近、但永不超越双剂叠加（×4.5 × ×4.5）。
//  · 品级由**产出侧的等级**决定：温室里作物伴生产蜜按「该作物 reqLevel」定级，
//    蜂箱直产按「蜜源作物 reqLevel」定级（见 greenhouse.js / apiary 的调用方）。
//  · type=consumable / category=buff ⇒ valueBalance、itemBalance、spoilBalance 三套平衡**都不会碰它**
//    （它们的作用域要求「是采集/农耕/配方产物」或 category ∈ meat/seafood/egg），故数值在此定死。
export const HONEY_TIERS = [
  { tier: 1, id: 'honeyPale', name: '浅芳蜜', minLevel: 1, xp: 1.15, yield: 1.2, minutes: 30, value: 60, desc: '初春浅色花蜜，清淡回甘' },
  { tier: 2, id: 'honeyGreen', name: '青蕊蜜', minLevel: 11, xp: 1.25, yield: 1.35, minutes: 45, value: 110, desc: '青蕊初绽时采的蜜，带一点草木清气' },
  { tier: 3, id: 'honeyBloom', name: '繁花蜜', minLevel: 21, xp: 1.4, yield: 1.5, minutes: 60, value: 175, desc: '百花盛放期的蜜，香甜饱满' },
  { tier: 4, id: 'honeyAutumn', name: '秋荆蜜', minLevel: 31, xp: 1.6, yield: 1.7, minutes: 80, value: 240, desc: '秋日荆花蜜，色深味厚、回味绵长' },
  { tier: 5, id: 'honeyLocust', name: '山槐蜜', minLevel: 41, xp: 1.85, yield: 1.95, minutes: 100, value: 310, desc: '山中槐花蜜，清亮微酸，厨师最爱' },
  { tier: 6, id: 'honeyCinnamon', name: '野桂蜜', minLevel: 56, xp: 2.15, yield: 2.25, minutes: 125, value: 385, desc: '野桂花蜜，一缕桂香久留不散' },
  { tier: 7, id: 'honeyRock', name: '岩花蜜', minLevel: 71, xp: 2.5, yield: 2.6, minutes: 150, value: 465, desc: '岩缝石花所酿，产量极稀，蜜体稠亮' },
  { tier: 8, id: 'honeySupreme', name: '百花臻蜜', minLevel: 86, xp: 3.0, yield: 3.1, minutes: 180, value: 560, desc: '四时百花之精，一勺抵百味' },
]

/** 供 items.js 合并进 ITEMS（沿用 preserveTiers 的写法：显式 image 指向 tool/ 目录） */
export const HONEY_ITEMS = HONEY_TIERS.map((h) => ({
  id: h.id,
  name: h.name,
  type: 'consumable',
  category: 'buff',
  tier: h.tier,
  value: h.value,
  stackable: true,
  maxStack: 9999,
  use: { buffXp: { mult: h.xp, minutes: h.minutes }, buffYield: { mult: h.yield, minutes: h.minutes } },
  image: `images/items/tool/${h.name}.png`,
}))

const HONEY_INDEX = new Map(HONEY_TIERS.map((h) => [h.id, h]))

export function getHoney(id) {
  return HONEY_INDEX.get(id) ?? null
}

/** 等级 → 品级（1~8）；低于 1 级也至少给 1 品级 */
export function honeyTierForLevel(level = 1) {
  let t = 1
  for (const h of HONEY_TIERS) if (level >= h.minLevel) t = h.tier
  return t
}

/** 等级 → 蜂蜜物品 id */
export function honeyItemForLevel(level = 1) {
  return HONEY_TIERS[honeyTierForLevel(level) - 1].id
}
