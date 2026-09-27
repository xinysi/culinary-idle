// 美食探索的**读取点平衡**（2026-09-27 用户一轮要求；冻结数据一个字节没动）
//
// 为什么另开模块：铁律把 `explorationTargets.js` 的 200 个目标（id/name/reqLevel/intervalSec/xp/
//   baseSuccess/failGold/loot）列为**已固定**，所以「初始成功率随等级段下降至 0%」「最大 90%」
//   「精通/装备把成功率补回来」这些**规则**一律在读取点算，数据层只提供 baseSuccess 与掉落表。
//
// 公式（唯一出口 `exploreSuccessChance()`）：
//   段位因子 = max(0, 1 − (段−1) × EXPLORE_BAND_DECAY)     段 = floor((reqLevel−1)/10)+1（1~10）
//   核心值   = min(EXPLORE_SUCCESS_CAP, baseSuccess × 段位因子 + 精通 + 精通池)
//   最终值   = min(1, 核心值 + 装备)                        ← 装备在**上限之外**，正好补足剩下的 10%
//   · 段 1 ×1.00（≈84%）→ 段 10 ×0.00：**「初始成功率」到末段归零**，要靠精通练回来。
//   · 🔴 **精通次数改成「每次探索动作」都算**（成功与否都加，见 ExplorationSkill.performAction）——
//     否则末段卡片 0% 起步 ⇒ 永远不成功 ⇒ 精通永远不涨 ⇒ **死卡**（用户已确认走这条）。
export const EXPLORE_BAND_SIZE = 10

/** 每往后一段衰减多少（整档只改这一个数）：1/(段数−1) ⇒ 段 1 为 1.0、段 10 恰为 0 */
export const EXPLORE_BAND_DECAY = 1 / 9

/** 卡片成功率的**硬上限**（不含装备）。装备可以把剩下的 10% 补满（见 EXPLORE_GEAR_*） */
export const EXPLORE_SUCCESS_CAP = 0.9

/** 单卡精通 100 级能补的百分点：末段（因子 0）也够把卡片拉起来 */
export const EXPLORE_MASTERY_PP_MAX = 0.6

/** 该目标属于第几段（1 起；reqLevel 1~10 → 1 段，91~100 → 10 段） */
export function exploreBandOf(reqLevel) {
  const lv = Number(reqLevel)
  if (!Number.isFinite(lv) || lv <= 0) return 1
  return Math.min(10, Math.floor((lv - 1) / EXPLORE_BAND_SIZE) + 1)
}

/** 段位因子：段 1 = 1.0，逐段线性降到段 10 = 0 */
export function exploreBandFactor(reqLevel) {
  const band = exploreBandOf(reqLevel)
  return Math.max(0, 1 - (band - 1) * EXPLORE_BAND_DECAY)
}

/** 单卡精通带来的成功率（百分点，0~EXPLORE_MASTERY_PP_MAX），线性 */
export function exploreMasteryPP(masteryLevel) {
  const lv = Math.max(0, Math.min(100, Number(masteryLevel) || 0))
  return EXPLORE_MASTERY_PP_MAX * (lv / 100)
}

/** 该卡片此刻的「初始成功率」（不含精通与装备）—— 卡片上「初始」那一行显示它 */
export function exploreInitialChance(target) {
  const base = Number(target?.baseSuccess) || 0
  return Math.max(0, base * exploreBandFactor(target?.reqLevel))
}

/**
 * 成功率**唯一出口**。参数全部是已算好的分段值，调用方（技能）负责取精通/池/装备。
 * @param {object} target 探索目标（只用 baseSuccess / reqLevel）
 * @param {object} ctx { masteryLevel, poolSuccessPP, gearPP }（gearPP 已是 0~0.10 的小数）
 */
export function exploreSuccessChance(target, ctx = {}) {
  const coreRaw = exploreInitialChance(target)
    + exploreMasteryPP(ctx.masteryLevel)
    + Math.max(0, Number(ctx.poolSuccessPP) || 0) / 100
  const core = Math.min(EXPLORE_SUCCESS_CAP, Math.max(0, coreRaw))
  const gear = Math.max(0, Number(ctx.gearPP) || 0)
  return Math.min(1, core + gear)
}

/** 上限（不含装备）：卡片 tooltip 用它解释「为什么堆到 90% 就不再涨」 */
export const EXPLORE_CAP_TEXT = `${Math.round(EXPLORE_SUCCESS_CAP * 100)}%`
