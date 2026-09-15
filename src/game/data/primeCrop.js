// 精耕作物（2026-09-15 新增，v2.5.0）— **农耕专属的高级产物**，用来把「农耕」与「采摘/挖掘」拉开差异。
//
// 起因（用户 2026-09-15）：「我觉得农耕和采摘挖掘获得作物的差异性还是不够」。
// 诊断：两者机制差很多（采集瞬间/占并行槽/单目标；农耕要等/不占槽/可同时种 20 块地、有当季/天气/农具/施肥），
//   但**产出的物品是同一批 id** ⇒ 玩家感觉仍是「同一件事的两种速度」。所以要真正拉开差异，必须让农耕有**独占产物**。
//
// 本物品 = 那个独占产物：① 只有**农田**能出（reqLevel ≥ PRIME_MIN_LEVEL 的作物，概率随该作物精通提高）
//   ② type=consumable ⇒ 不进采集表 / 商店 / 抽奖池 / 交易所 / 自动出售（保证「采集拿不到」）
//   ③ 两条出口：**萃露炉加料**（酿造时间 ×0.6）或**商店出售**（价值 ×0.5）——绝不会是死物品。
export const PRIME_CROP_ID = 'primeCrop'

export const PRIME_CROP_ITEM = {
  id: PRIME_CROP_ID,
  name: '精耕作物',
  type: 'consumable',
  category: 'supply',
  tier: 5,
  value: 220,
  stackable: true,
  maxStack: 9999,
  image: 'images/items/tool/精耕作物.png',
}

/** 只有该等级及以上的作物才可能附产（低阶作物量太大，附产会泛滥） */
export const PRIME_MIN_LEVEL = 40
/** 基础概率与「满精通再加」的额度（合计上限 10%） */
export const PRIME_BASE_CHANCE = 0.04
export const PRIME_MASTERY_CHANCE = 0.06
export const PRIME_MAX_CHANCE = 0.10

/** 该作物精通等级 → 附产概率（0.04 ~ 0.10） */
export function primeCropChance(masteryLevel = 0) {
  const lv = Math.max(0, Math.min(100, Number(masteryLevel) || 0))
  return Math.min(PRIME_MAX_CHANCE, PRIME_BASE_CHANCE + (lv / 100) * PRIME_MASTERY_CHANCE)
}

/** 萃露炉加料：酿造时间 ×0.6（−40%） */
export const PRIME_CATALYST_TIME = 0.6

/** 农耕精通 → 采集该物品时的额外产出几率（#2 精通联动：每 10 级 +2%，上限 +20%） */
export const FARM_MASTERY_GATHER_PER_10 = 0.02
export const FARM_MASTERY_GATHER_MAX = 0.20

export function farmMasteryGatherChance(masteryLevel = 0) {
  const lv = Math.max(0, Math.min(100, Number(masteryLevel) || 0))
  return Math.min(FARM_MASTERY_GATHER_MAX, Math.floor(lv / 10) * FARM_MASTERY_GATHER_PER_10)
}
