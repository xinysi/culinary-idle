// 平衡实验台 —— 投影 + A/B 对比引擎（2026-10-02 新角色 ops）
//
// 定位：把「🧪 平衡实验台」的四条影响链与「定义实验 → 跑对比 → 出报告」收成**一个真身**。
//   · 四条链的每一环（OpsPanel 渲染）与 A/B 对比的终值，全部由本文件的 `proj*` 出口算出 ——
//     页面不再各算一份（本项目最忌「同一件事两份口径」）。
//   · ⚠️ 投影是**解析式**（浏览器跑不了 `scripts/sim/*.mjs` 的 node 脚本）。标定参照值在
//     `opsBenchmarks.js`（OPS_CALIBRATION），本文件只做「同一套读取点下的相对变化」。
//
// 🔴 三条红线（与 tuner.js 同源）：只读运行时读取点；覆盖只活会话内存；A/B 用 `withOverrides`
//    临时施加后**原样恢复**（CI 的 C9c 有「跑完覆盖为空 + 存档未动」断言）。
import { tunerOver, tunerSet, tunerResetKey, tunerResetAll, tunerActiveKeys, tunerRawValue } from '../data/tuner.js'
import { MATERIAL_COST_MULT, materialQty } from '../data/materialCost.js'
import { XP_STACK_DAMPING, dampXpStack } from '../core/growthRate.js'
import { combatTurnIntervalSec, COMBAT_RESPAWN_SEC, COMBAT_SPEED_BASE_SEC, COMBAT_SPEED_DECAY_PER_LEVEL } from '../data/caps.js'
import { REFUND_PCT, MIX_BRANCH, refundOf, branchOf, MIJIAN_POOLS, QUALITY_WEIGHT, poolItems, cheapTier } from '../data/mijianDraws.js'
import { CHANCE_FLOOR } from '../data/difficulty.js'

/** 池回收率（与 scripts/sim/mijian_economy.mjs 同口径）：(金币返还 + 物品价值×0.5) / 池价 */
export function recycleOf(poolId, branch, refund) {
  const def = MIJIAN_POOLS.find((p) => p.id === poolId)
  if (!def?.price) return null
  const mean = (arr) => (arr.length ? arr.reduce((a, x) => a + (x.value ?? 0), 0) / arr.length : 0)
  const cheapAvg = mean(cheapTier(poolId))
  let normalAvg
  if (poolId === 'mix') {
    const gear = poolItems('gear')
    const tot = Object.values(QUALITY_WEIGHT).reduce((a, b) => a + b, 0)
    normalAvg = 0
    for (const [q, w] of Object.entries(QUALITY_WEIGHT)) {
      const cand = gear.filter((i) => i.quality === q)
      if (cand.length) normalAvg += (w / tot) * mean(cand)
    }
  } else {
    normalAvg = mean(poolItems(poolId))
  }
  const ev = branch.gold * refund(def.price) + branch.cheap * cheapAvg * 0.5 + branch.normal * normalAvg * 0.5
  return ev / def.price
}

/** 链 A：战斗节奏（参考 L40 对手、5 回合基准） */
export function projCombat() {
  const hpMult = tunerOver('enemyHp', 1, 0.25, 4)
  const respawn = tunerOver('respawnSec', COMBAT_RESPAWN_SEC, 0, 10)
  const ivBase = Math.max(1.2, COMBAT_SPEED_BASE_SEC - 40 * COMBAT_SPEED_DECAY_PER_LEVEL)
  const ivCur = combatTurnIntervalSec(40)
  const roundsBase = 5
  const roundsCur = Math.max(1, Math.round(roundsBase * hpMult))
  const tBase = roundsBase * ivBase
  const tCur = roundsCur * ivCur
  const kBase = 3600 / (tBase + COMBAT_RESPAWN_SEC)
  const kCur = 3600 / (tCur + respawn)
  const ttkBase = tBase + COMBAT_RESPAWN_SEC
  const ttkCur = tCur + respawn
  const xpCur = kCur * Math.min(hpMult, 2)
  return { hpMult, respawn, ivBase, ivCur, roundsBase, roundsCur, ttkBase, ttkCur, kBase, kCur, xpCur }
}

/** 链 B：成长叠区（示例乘积 ×10） */
export function projGrowth() {
  const g = tunerOver('globalXp', 1, 0, 20)
  const card = tunerOver('cardXpScale', 1, 0.1, 10)
  const stackRef = 10
  const dampBase = 1 + (stackRef - 1) * XP_STACK_DAMPING
  const dampCur = dampXpStack(stackRef)
  return { card, g, stackRef, dampBase, dampCur, rateBase: dampBase, rateCur: card * dampCur * g }
}

/** 链 C：制作与升级时长（材料限速） */
export function projCraft() {
  const mc = tunerOver('materialCost', MATERIAL_COST_MULT, 1, 8)
  const qtyBase = Math.max(1, Math.round(5 * MATERIAL_COST_MULT))
  const qtyCur = materialQty(5)
  return { mc, qtyBase, qtyCur }
}

/** 链 D：抽卡经济（混池 80 价） */
export function projGacha() {
  const refundBase = Math.floor(80 * REFUND_PCT)
  const refundCur = refundOf(80)
  const recBase = recycleOf('mix', MIX_BRANCH, (p) => Math.floor(p * REFUND_PCT))
  const recCur = recycleOf('mix', branchOf('mix'), refundOf)
  return { refundBase, refundCur, recBase, recCur }
}

/** 四条影响链的全部标量（OpsPanel 渲染链节点读它 —— 唯一真身） */
export function projectionGroups() {
  return { combat: projCombat(), growth: projGrowth(), craft: projCraft(), gacha: projGacha() }
}

/**
 * 四个「验收线」终值（单位与 OpsPanel 展示一致）：
 *   ttk 秒 · xpRate 以基线=100 · craftTime 相对基线=×1 · recycle（百分点）
 */
export function projectMetrics() {
  const c = projCombat()
  const cr = projCraft()
  const ga = projGacha()
  return {
    ttk: c.ttkCur,
    xpRate: (c.xpCur / c.kBase) * 100,
    craftTime: cr.qtyCur / cr.qtyBase,
    recycle: Math.round(ga.recCur * 1000) / 10,
  }
}

/**
 * 在「一组覆盖」下算指标，算完**原样恢复**调用前的覆盖。
 * 与 OpsPanel 的「零副作用校验」同一手法：临时施加 → 取值 → 还原。
 */
export function withOverrides(map, fn) {
  const savedKeys = tunerActiveKeys()
  const saved = {}
  for (const k of savedKeys) saved[k] = tunerRawValue(k)
  tunerResetAll()
  for (const [k, v] of Object.entries(map ?? {})) tunerSet(k, v)
  try {
    return fn()
  } finally {
    tunerResetAll()
    for (const [k, v] of Object.entries(saved)) {
      if (v == null) tunerResetKey(k)
      else tunerSet(k, v)
    }
  }
}

/** 零覆盖（基线）下的指标 —— 用作 A/B 的基准列 */
export function baselineMetrics() {
  return withOverrides({}, projectMetrics)
}

/** 当前（玩家此刻滑杆）的指标 */
export function currentMetrics() {
  return projectMetrics()
}

/** 当前生效的覆盖快照（作为 A/B 的「现状组」输入；A/B 会原样恢复，不丢） */
export function currentOverrideMap() {
  const out = {}
  for (const k of tunerActiveKeys()) out[k] = tunerRawValue(k)
  return out
}

/**
 * A/B 对比：分别在两组覆盖下算指标（各算完即恢复），返回 { A, B }。
 * @param {object} aMap 组 A 的覆盖（常传 currentOverrideMap() = 现状）
 * @param {object} bMap 组 B 的覆盖
 */
export function runComparison(aMap, bMap) {
  const A = withOverrides(aMap, projectMetrics)
  const B = withOverrides(bMap, projectMetrics)
  return { A, B }
}

/** 现成情景（一键情景行 + A/B 的组 B 候选，**唯一真身**：OpsPanel 从这里取，不各自抄一份） */
export const LAB_SCENARIOS = [
  {
    id: 'hard', label: '🐢 硬核演示',
    hint: '全部概率压到下限 + 敌人血量 ×1.5 + 材料 ×3 + 重生 3s',
    sets: { diffDrop: CHANCE_FLOOR.drop, diffCraft: CHANCE_FLOOR.craft, diffExplore: CHANCE_FLOOR.explore, diffExploreLoot: CHANCE_FLOOR.exploreLoot, diffOther: CHANCE_FLOOR.other, diffGatherExtra: CHANCE_FLOOR.gatherExtra, enemyHp: 1.5, materialCost: 3, respawnSec: 3 },
  },
  {
    id: 'fast', label: '🚀 爽游演示',
    hint: '全局经验 ×5 + 卡片经验 ×2 + 敌人血量 ×0.5 + 重生 0.5s + 材料 ×1 + 离线上限 48h',
    sets: { globalXp: 5, cardXpScale: 2, enemyHp: 0.5, respawnSec: 0.5, materialCost: 1, offlineHours: 48 },
  },
  {
    id: 'heavy', label: '⚔️ 重战斗演示',
    hint: '敌人血量 ×4 + 重生 5s —— 看「击杀/时」与「经验/时」的非线性下跌',
    sets: { enemyHp: 4, respawnSec: 5 },
  },
  {
    id: 'gacha', label: '🎲 抽卡经济演示',
    hint: '返金降到 10% + 混池正常分支抬到 30% + 软保底 0.3 + 保底 10 抽 —— 看回收率',
    sets: { refundPct: 0.1, mixNormal: 0.3, softMaxP: 0.3, gearPity: 10, mixPity: 20 },
  },
]
