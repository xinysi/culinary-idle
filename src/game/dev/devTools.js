// 开发者工具：运行时状态操作（一键满配 / 发放资源 / 解锁全部 / 离线跳时 …）
//
// ⚠️ **只操作玩家存档（Pinia store），绝不写 `src/game/data/*`**。
//    项目有「固定数据铁律」：采集/制作/对决/食灵/奥义/探索/赛季/竞技场的数值是冻结的，
//    开发者面板只能改「这台机器上的这份存档」，不能改数据层——否则会连环破坏守卫与既标定的经济。
//    （守卫 `scripts/ci/dev_panel_audit.mjs` 会断言这些模块不 import/改写数据文件的导出。）
import { ITEMS } from '../data/items.js'
import { ALL_ACHIEVEMENTS } from '../data/achievements.js'
import { SHANHAI_NODES } from '../data/shanhaiTree.js'
import { INSIGHT_NODES } from '../data/insightTree.js'
import { DAO_NODES } from '../data/daoTree.js'
import { REGULARS } from '../data/regulars.js'
import { REGIONS } from '../data/regions.js'
import { EXPEDITIONS } from '../data/expeditions.js'
import { SPIRITS } from '../data/spiritTiers.js'
import { MAX_LEVEL } from '../skills/Skill.js'
import { CAP_MAX } from '../data/caps.js'

/** 满档数量：物品给这么多，够开所有配方 */
const STOCK = 999

export function grantGold(player, n = 1e9) {
  player.gold = Math.max(0, Math.floor(n))
  return `金币 = ${player.gold.toLocaleString()}`
}

export function grantGameCoins(player, n = 1e6) {
  player.gameCoins = Math.max(0, Math.floor(n))
  return `游戏币 = ${player.gameCoins.toLocaleString()}`
}

/** 全物品入库（食灵走食灵阁，不占背包格） */
export function grantAllItems(player, qty = STOCK) {
  let n = 0
  let spirits = 0
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.type === 'spirit') { player.spirits.owned[id] = (player.spirits.owned[id] ?? 0) + 1; spirits++; continue }
    player.inventory[id] = qty
    n++
  }
  return `入库 ${n} 种物品 ×${qty}${spirits ? ` · 食灵阁 +${spirits}` : ''}（背包上限 ${CAP_MAX.inventory}，超出部分请用「存档体检」查看）`
}

export function clearInventory(player) {
  const n = Object.keys(player.inventory ?? {}).length
  player.inventory = {}
  player.bank = {}
  player.coldStorage = {}
  return `已清空背包/仓库/冷库（${n} 种物品）`
}

export function setAllSkillLevels(player, lv = MAX_LEVEL) {
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(lv)))
  for (const id of Object.keys(player.skills ?? {})) {
    player.skills[id].level = level
    player.skills[id].exp = 0
  }
  return `全部技能等级 = ${level}`
}

/** 解锁全部：成就 / 图鉴 / 山海食经 / 菜系图谱 / 厨神之路 / 产地 / 常客 / 远行队 / 餐厅 */
export function unlockEverything(player) {
  player.achievements = ALL_ACHIEVEMENTS.map((a) => a.id)
  player.collected = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, true]))
  player.shanhaiUnlocked = SHANHAI_NODES.map((n) => n.id)
  player.insights = INSIGHT_NODES.map((n) => n.id)
  player.daoUnlocked = DAO_NODES.map((n) => n.id)
  for (const r of REGIONS) player.regions[r.id] = true
  for (const r of REGULARS) player.regulars[r.id] = { serves: 99, lastDay: null, giftClaimed: false }
  for (const e of EXPEDITIONS) {
    player.expeditions[e.id] = { completions: 9, slots: [{ startedAt: Date.now() - 3600e3, readyAt: Date.now() - 60e3 }] }
  }
  player.restaurant.level = 10
  player.tower.floor = 50
  player.tower.best = 40
  player.michelin.score = 300
  player.michelin.stars = 3
  player.mijian.tickets = 55
  player.tastePoints = 99999
  player.stats.prestiges = 99
  return `已解锁：成就 ${ALL_ACHIEVEMENTS.length} · 图鉴 ${Object.keys(ITEMS).length} · 山海 ${SHANHAI_NODES.length} · 产地 ${REGIONS.length} · 餐厅 Lv10`
}

/** 一键满配 = 金币 + 全物品 + 技能满级 + 全解锁（答辩演示用：不用等 40 分钟就能看到终局内容） */
export function maxOut(player) {
  const out = [
    grantGold(player),
    grantAllItems(player),
    setAllSkillLevels(player),
    unlockEverything(player),
  ]
  return out.join(' · ')
}

/**
 * 离线跳时：把 `lastOnlineAt` 往前推 N 小时，**然后刷新页面**。
 * 走的是真实路径（重新进游戏 → 引擎自己 settleOffline 并弹离线报告），
 * 比在面板里伪造一份结算更能反映真实表现。
 */
export function offlineJump(player, hours) {
  const h = Math.max(0.01, Number(hours) || 1)
  const ms = Math.round(h * 3600_000)
  player.lastOnlineAt = Date.now() - ms
  return `已把上次在线时间往前推 ${h} 小时（上限受 offlineMaxHours = ${player.offlineMaxHours?.() ?? '?'}h 约束）——刷新后走真实离线结算`
}

/** 清空当日/本周进度类状态（测试「跨天刷新」用，不动等级与物品） */
export function rolloverReset(player) {
  player.daily = { day: null, streak: player.daily?.streak ?? 0, tasks: [], claimedAll: false }
  player.weekly = { week: null, task: null, progress: 0, claimed: false }
  player.challenge = { week: null, id: null, progress: 0, done: false }
  player.exchange = { dayKey: null, traded: {} }
  player.orders = { list: [], nextAt: 0 }
  player.critic = { order: null, nextAt: 0 }
  return '已清空每日/周常/每周挑战/交易所/订单/评论家的当日状态（等级与物品保留）'
}

/** 给几个常见的「锁」解绑（硬核模式、暂停的技能、关闭的挂机任务） */
export function clearLocks(player) {
  player.pausedSkills = {}
  player.closedIdleTasks = {}
  return '已恢复全部暂停/关闭的挂机任务'
}

export { STOCK, MAX_LEVEL }
