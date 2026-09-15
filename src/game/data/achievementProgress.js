// 成就进度计算（2026-09-11 从 LogView 抽出，供「图鉴 → 成就」与新的「成就与称号」独立页共用一份）
// 纯读取：只根据 player 当前状态换算进度，不改动任何成就数据（数据铁律）。
import { ITEMS, getItem } from './items.js'
import { HONEY_TIERS } from './honey.js'
import { ESSENCE_TIERS } from './essences.js'
import { FRIENDS, FRIEND_BOND_STEPS, friendBondLevel } from './friends.js'
import { EXPEDITIONS, expeditionTier, EXPEDITION_TIER_STEPS } from './expeditions.js'
import { BRANCHES } from './branches.js'
import { MASCOTS } from './mascots.js'
import { setMealBoard } from './setMeals.js'
import { DAO_PATHS, DAO_NODES } from './daoTree.js'

/** 各成就的达成阈值（技能类成就用 id 内嵌的数字，见 achievementNeed） */
const NEEDS = {
  firstWin: 1, win10: 10, win100: 100, win500: 500, win1000: 1000, bossAll: 28, hardBossAll: 28,
  log25: 25, log50: 50, log75: 75, log100: 100,
  explore1: 1, explore50: 50, region3: 3, region6: 6, region10: 10,
  gold10k: 10000, gold100k: 100000, items50: 50, prestige1: 1, prestige3: 3, prestige5: 5, prestige8: 8, prestige12: 12, level120: 120,
  totalLevel500: 500, totalLevel1000: 1000, hardcore10: 10, season5: 5, season10: 10, seasonAll: 40,
  collection25: 25, collection50: 50, collection75: 75, collection100: 100,
  hardcoreDay1: 1, hardcoreDay7: 7, hardcoreDay30: 30, hardcoreDay100: 100,
  daoFirst: 1, daoPathAll: 20, // 四路各 5 个 = 20 个节点
  shanhaiFirst: 1, shanhai30: 30, shanhai90: 90, shanhai180: 180, shanhaiAll: 400, // 山海食经点亮节点数（v2.1：全树 400）
  friendBondAll: FRIENDS.length, expeditionTier5: EXPEDITIONS.length, branch6: BRANCHES.length, mascot7: MASCOTS.length, setMeal3: 3, chefWin10: 10,
  // 挂机产线四套（2026-09-14）
  caravan1: 1, caravan30: 30, mushroom50: 50, spiritField10: 10, honey8: 8, honey100: 100, essence1: 1, essenceAll: 8, prime10: 10, prime200: 200,
}

/** 图鉴总数缓存（ITEMS 全表只数一次，供 need/进度复用） */
const ACH_TOTAL = {
  allDishes: Object.values(ITEMS).filter((it) => it.type === 'food').length,
  allGear: Object.values(ITEMS).filter((it) => it.type === 'equipment').length,
  allFish: Object.values(ITEMS).filter((it) => it.category === 'fish' || it.category === 'seafood').length,
}

/**
 * 成就的目标值（技能类成就与三类「集齐」成就才有固定目标，其余返回 null）
 * @param {{id:string}} a 成就定义
 * @returns {number|null}
 */
export function achievementNeed(a) {
  const m = a.id.match(/^skill_(\w+)_(\d+)$/)
  if (m) return Number(m[2])
  if (a.id === 'allDishes' || a.id === 'allGear' || a.id === 'allFish') return ACH_TOTAL[a.id] ?? 0
  return null
}

/**
 * 成就当前进度（无固定目标的成就返回 null）
 * @param {object} p player store 实例
 * @param {{id:string}} a 成就定义
 * @returns {{cur:number, need:number, pct:number}|null}
 */
export function achievementProgress(p, a) {
  const m = a.id.match(/^skill_(\w+)_(\d+)$/)
  if (m) {
    const cur = Math.min(p.skills[m[1]]?.level ?? 1, Number(m[2]))
    return { cur, need: Number(m[2]), pct: Math.min(100, (cur / Number(m[2])) * 100) }
  }
  const need = NEEDS[a.id]
  let cur = null
  if (a.id.startsWith('log')) cur = p.collectionPct
  else if (a.id.startsWith('collection')) cur = p.collectionPct
  else if (a.id.startsWith('hardcoreDay')) cur = p.hardcoreDayCount()
  else if (['firstWin', 'win10', 'win100', 'win500', 'win1000'].includes(a.id) || a.id === 'hardcore10') cur = p.stats.combatWins
  else if (a.id === 'bossAll') cur = p.stats.bosses.length
  else if (a.id === 'hardBossAll') cur = p.stats.hardBosses?.length ?? 0
  else if (a.id.startsWith('explore')) cur = p.stats.explorations
  else if (a.id.startsWith('region')) cur = p.regionsUnlocked
  else if (a.id.startsWith('gold')) cur = p.stats.totalGoldEarned
  else if (a.id === 'items50') cur = Object.keys(p.collected).length
  else if (a.id === 'prestige1') cur = p.stats.prestiges
  else if (a.id.startsWith('prestige')) cur = p.stats.prestiges
  else if (a.id === 'level120') cur = Math.max(...Object.values(p.skills).map((s) => s.level ?? 1))
  else if (a.id.startsWith('totalLevel')) cur = p.totalLevels
  else if (a.id.startsWith('season')) cur = Object.values(p.seasons ?? {}).filter((s) => (s.claimed?.length ?? 0) > 0).length
  else if (a.id === 'allDishes') cur = Object.keys(p.collected).filter((id) => getItem(id)?.type === 'food').length
  else if (a.id === 'allGear') cur = Object.keys(p.collected).filter((id) => getItem(id)?.type === 'equipment').length
  else if (a.id === 'allFish') cur = Object.keys(p.collected).filter((id) => ['fish', 'seafood'].includes(getItem(id)?.category)).length
  else if (a.id === 'friendBondAll') cur = FRIENDS.filter((f) => friendBondLevel(p.friends?.data?.[f.id]?.bond ?? 0) >= FRIEND_BOND_STEPS.length).length
  else if (a.id === 'expeditionTier5') cur = EXPEDITIONS.filter((e) => expeditionTier(p.expeditions?.[e.id]?.completions ?? 0) >= EXPEDITION_TIER_STEPS.length).length
  else if (a.id === 'branch6') cur = BRANCHES.filter((b) => !!p.branches?.[b.id]).length
  else if (a.id === 'mascot7') cur = MASCOTS.filter((m) => !!p.mascots?.owned?.[m.id]).length
  else if (a.id === 'setMeal3') cur = setMealBoard(p.restaurant?.menu ?? []).filter((m) => m.ok).length
  else if (a.id === 'chefWin10') cur = p.stats?.chefWins ?? 0
  else if (a.id.startsWith('caravan')) cur = p.stats?.caravanTrips ?? 0
  else if (a.id.startsWith('mushroom')) cur = p.stats?.mushroomCycles ?? 0
  else if (a.id.startsWith('spiritField')) cur = p.stats?.spiritHarvests ?? 0
  else if (a.id === 'honey8') cur = HONEY_TIERS.filter((h) => (p.collected?.[h.id] ?? 0) > 0).length
  else if (a.id === 'honey100') cur = p.stats?.honeyHarvests ?? 0
  else if (a.id.startsWith('prime')) cur = p.stats?.primeCrops ?? 0
  else if (a.id === 'essence1') cur = p.stats?.essenceBrews ?? 0
  else if (a.id === 'essenceAll') cur = ESSENCE_TIERS.filter((e) => (p.collected?.[e.id] ?? 0) > 0).length
  else if (a.id === 'daoFirst') cur = (p.daoUnlocked ?? []).length
  else if (a.id === 'daoPathAll') cur = (p.daoUnlocked ?? []).length
  if (cur === null || !need) return null
  return { cur: Math.min(cur, need), need, pct: Math.min(100, (cur / need) * 100) }
}
