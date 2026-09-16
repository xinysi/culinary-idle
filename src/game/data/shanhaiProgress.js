// 山海食经 · 进度派生（纯读，不改任何既有数据）
// 口径（2026-09-13 定）：条件只看**已持久化**的玩家状态 ——
//   ① 该收集线可收集物品的「已收集件数」（player.collected）
//   ② 该技能等级（player.skills[id].level）
// ⚠️ 刻意**不用**两个陷阱：`actionsDone`（实例态、刷新即清零）与 `collectionPct`（2210 分母被装备/种子/食灵稀释）。
import { SHANHAI_NODES, SHANHAI_PATHS, SHANHAI_RING_COUNT, SHANHAI_GAPS } from './shanhaiTree.js'
import { CROPS } from '../skills/FarmingSkill.js'
import { getSkillInstance } from '../skills/registry.js'

/** 可收集清单索引（懒建；技能实例在 bootstrap 后才有，所以不能在模块顶层建） */
let INDEX = null
function collectiblesOf(skillId) {
  if (skillId === 'farming') return CROPS.map((c) => c.itemId).filter(Boolean)
  const inst = getSkillInstance(skillId)
  if (!inst) return []
  if (Array.isArray(inst.targets)) return inst.targets.map((t) => t.itemId).filter(Boolean)
  if (Array.isArray(inst.recipes)) return inst.recipes.map((r) => r.output?.itemId).filter(Boolean)
  return []
}
export function shanhaiIndex() {
  if (INDEX) return INDEX
  const idx = {}
  for (const p of SHANHAI_PATHS) idx[p.id] = collectiblesOf(p.skill)
  INDEX = idx
  return INDEX
}
export function shanhaiNode(id) {
  return SHANHAI_NODES.find((n) => n.id === id) ?? null
}
export function shanhaiPath(pathId) {
  return SHANHAI_PATHS.find((p) => p.id === pathId) ?? null
}
/** 该线可收集物品总数（用于进度显示与守卫） */
/** 空隙（汇金链）定义：{ id, a, b, aName, bName, aSkill, bSkill, name, index } */
export function shanhaiGap(id) {
  return SHANHAI_GAPS.find((g) => g.id === id) ?? null
}
export function shanhaiPathTotal(pathId) {
  return (shanhaiIndex()[pathId] ?? []).length
}
/** 该线「已收集」件数：只统计该线可收集清单内的物品 */
export function shanhaiPathHave(player, pathId) {
  const list = shanhaiIndex()[pathId]
  if (!list) return 0
  const col = player?.collected ?? {}
  let n = 0
  for (const id of list) if (col[id]) n++
  return n
}
/** 该线技能等级 */
export function shanhaiPathLevel(player, pathId) {
  const p = shanhaiPath(pathId)
  return p ? (player?.skills?.[p.skill]?.level ?? 1) : 1
}
/** 该线技能的**转生次数**（第 8~10 环的里程碑条件；旧档/新档缺字段都回退 0） */
export function shanhaiPathPrestige(player, pathId) {
  const p = shanhaiPath(pathId)
  return p ? (player?.skills?.[p.skill]?.prestiges ?? 0) : 0
}

/**
 * 单节点状态：{ unlocked, can, have, need, level, needLevel, prestige, needPrestige, reason }
 * can = 未解锁 && 收集件数达标 && 技能等级达标 && 转生次数达标（**不消耗任何资源**）
 * ⚠️ 转生环（第 8~10 环）只要求转生次数、不要求当前等级——转生会把等级重置为 1+传承（≤20）。
 */
export function shanhaiNodeState(node, player, unlockedIds = null) {
  const ids = unlockedIds ?? player?.shanhaiUnlocked ?? []
  const unlocked = ids.includes(node.id)
  // 外圈「珍券环」（`req.kind === 'progress'`）：门槛是**已点亮节点数**（不含珍券环自身，避免自引用）
  if (node.req?.kind === 'progress') {
    const lit = SHANHAI_NODES.filter((n) => n.path !== 'ticket' && ids.includes(n.id)).length
    const need = node.req.nodes ?? 0
    return {
      ...node,
      pathName: node.group ?? '珍券环',
      pair: null,
      unlocked,
      have: lit,
      need,
      level: 0,
      needLevel: 0,
      prestige: 0,
      needPrestige: 0,
      can: !unlocked && lit >= need,
      reason: unlocked ? '已点亮' : lit < need ? `需已点亮 ${need} 个节点（当前 ${lit}）` : '条件已达成',
    }
  }
  // 「汇金」节点（空隙里的金币链）横跨相邻两条线：收集件数**两线合计**，等级/转生取**较低者**（即两条线都得达标）
  const gap = node.gap != null ? shanhaiGap(node.path) : null
  const have = gap
    ? shanhaiPathHave(player, gap.a) + shanhaiPathHave(player, gap.b)
    : shanhaiPathHave(player, node.path)
  const level = gap
    ? Math.min(shanhaiPathLevel(player, gap.a), shanhaiPathLevel(player, gap.b))
    : shanhaiPathLevel(player, node.path)
  const prestige = gap
    ? Math.min(shanhaiPathPrestige(player, gap.a), shanhaiPathPrestige(player, gap.b))
    : shanhaiPathPrestige(player, node.path)
  const need = node.req?.count ?? 0
  const needLevel = node.req?.level ?? 0
  const needPrestige = node.req?.prestige ?? 0
  const miss = []
  if (have < need) miss.push(gap ? `还差 ${need - have} 件（两线合计 ${have}/${need}）` : `还差 ${need - have} 件（已收集 ${have}/${need}）`)
  if (level < needLevel) miss.push(gap ? `两条线技能均需 ${needLevel} 级（当前较低者 ${level}）` : `技能需 ${needLevel} 级（当前 ${level}）`)
  if (prestige < needPrestige) miss.push(gap ? `两条线均需转生 ${needPrestige} 次（当前较低者 ${prestige} 次）` : `需转生 ${needPrestige} 次（当前 ${prestige} 次）`)
  return {
    ...node,
    pathName: gap ? gap.name : (shanhaiPath(node.path)?.name ?? node.path),
    pair: gap ? [gap.aName, gap.bName] : null,
    unlocked,
    have,
    need,
    level,
    needLevel,
    prestige,
    needPrestige,
    can: !unlocked && miss.length === 0,
    reason: unlocked ? '已点亮' : miss.length ? miss.join(' · ') : '条件已达成',
  }
}

/** 全树状态列表（画布用） */
export function shanhaiAllStates(player) {
  const ids = player?.shanhaiUnlocked ?? []
  return SHANHAI_NODES.map((n) => shanhaiNodeState(n, player, ids))
}

/** 某条线的进度：{ unlocked, total, have, level, ringCount } */
export function shanhaiPathProgress(player, pathId) {
  const ids = player?.shanhaiUnlocked ?? []
  const nodes = SHANHAI_NODES.filter((n) => n.path === pathId)
  return {
    unlocked: nodes.filter((n) => ids.includes(n.id)).length,
    total: nodes.length,
    have: shanhaiPathHave(player, pathId),
    level: shanhaiPathLevel(player, pathId),
    prestige: shanhaiPathPrestige(player, pathId),
    ringCount: SHANHAI_RING_COUNT,
  }
}

/** 已点亮节点的效果合计：{ offlineH, gold, flatYield: { skillId: n }, caps: { inventory, bank, cold } } */
export function shanhaiEffectSum(unlockedIds = []) {
  const out = { offlineH: 0, gold: 0, flatYield: {}, caps: { inventory: 0, bank: 0, cold: 0 } }
  for (const id of unlockedIds) {
    const n = shanhaiNode(id)
    if (!n?.effect) continue
    const { field, amount } = n.effect
    if (field === 'offlineH') out.offlineH += amount
    else if (field === 'gold') out.gold += amount
    else if (field === 'flatYield') {
      const skill = shanhaiPath(n.path)?.skill
      if (skill) out.flatYield[skill] = (out.flatYield[skill] ?? 0) + amount
    } else if (field === 'inventoryCap') out.caps.inventory += amount
    else if (field === 'bankCap') out.caps.bank += amount
    else if (field === 'coldStorageCap') out.caps.cold += amount
  }
  return out
}

/** 已点亮节点**应发**的容量总量（原值，不含「满了转投下一档」的顺位）—— 读档对账用 */
export function shanhaiCapGrant(unlockedIds = []) {
  const sum = shanhaiEffectSum(unlockedIds)
  return { inventory: sum.caps.inventory, bank: sum.caps.bank, cold: sum.caps.cold }
}

/** 效果字段白名单（守卫与展示共用） */
export const SHANHAI_EFFECT_FIELDS = ['inventoryCap', 'bankCap', 'coldStorageCap', 'offlineH', 'flatYield', 'gold']
/**
 * 全树效果上限（守卫：防日后悄悄加码；容量类按「一次性发放」计）。
 * ⚠️ **加线/改环奖励后必须同步这里**（`system_test` C22 会断言「全树实际总量 ≤ 上限」，
 *    C23 还会断言 `offlineH` 与 `flatYieldPerSkill` **恰好等于**上限——多了会被 `offlineMaxHours`
 *    与采集逻辑夹掉＝发了读不到的奖励，少了＝浪费设计位）。
 * 当前（2026-09-16，12 条线：10 原有 + 伐薪/矿脉，552 节点）**实测总量**：
 *   背包 276 · 仓库 456 · 冷库 70 · 离线 8h（= `OFFLINE_CAP.shanhaiMaxHours`）·
 *   每技能每次 +2 件（7 条采集线各自用满）· 金币 5,904,000（12 个汇金空隙 × 492k）。
 * 取值口径：**贴着实测值取**（不预留余量）——留余量等于给「悄悄加码」放行，而这里正是那道闸门。
 * 另注：容量三档必须满足 `CAP_MAX.x ≥ PAID_CAP_MAX.x + 本表.x`（C23 断言），改这里要回头看 caps.js。
 */
export const SHANHAI_EFFECT_CAPS = { inventoryCap: 276, bankCap: 456, coldStorageCap: 70, offlineH: 8, flatYieldPerSkill: 2, gold: 5904000 }
