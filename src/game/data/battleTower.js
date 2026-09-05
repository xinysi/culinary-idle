// 无尽挑战塔 — 对决毕业后的长期目标（2026-09-06）
// 对手由 opp() 动态生成（arena 同款先例）：从玩家对决等级起步、每 4 层 +1 级，
// 属性随层数温和上浮 → 塔深无限、无固定敌人数据（不触碰 combat.js 铁律 COMBAT_REGIONS/BOSS）。
import { opp } from './combat.js'

// 每 10 层一组楼层名（塔深无限循环用，文化味）
const TOWER_NAMES = [
  '第一层·试炼石台', '第十层·不夜厨房', '第二十层·味觉回廊', '第三十层·赤焰灶堂',
  '第四十层·百味渊薮', '第五十层·无名山门', '第六十层·辞喜长廊', '第七十层·沸海孤岛',
  '第八十层·星火祭坛', '第九十层·混沌食窟', '第一百层·厨神之路', '更深处·轮回饕餮殿',
]

/** 楼层名：按层数取段名（非精确到层，仅供展示） */
export function towerFloorName(floorNum) {
  if (floorNum <= 10) return TOWER_NAMES[0]
  if (floorNum <= 20) return TOWER_NAMES[1]
  if (floorNum <= 30) return TOWER_NAMES[2]
  if (floorNum <= 40) return TOWER_NAMES[3]
  if (floorNum <= 50) return TOWER_NAMES[4]
  if (floorNum <= 60) return TOWER_NAMES[5]
  if (floorNum <= 70) return TOWER_NAMES[6]
  if (floorNum <= 80) return TOWER_NAMES[7]
  if (floorNum <= 90) return TOWER_NAMES[8]
  if (floorNum <= 100) return TOWER_NAMES[9]
  if (floorNum <= 130) return TOWER_NAMES[10]
  return TOWER_NAMES[11]
}

const STYLES = ['knife', 'plating', 'flavor']

/**
 * 生成第 floorNum 层对手（玩家对决等级决定起点，确保挑战有意义）
 * @param {number} floorNum 目标层（1 起）
 * @param {number} baseLevel 玩家对决等级
 */
export function towerFloor(floorNum, baseLevel) {
  const level = Math.min(140, Math.max(1, baseLevel + Math.floor((floorNum - 1) / 4)))
  const style = STYLES[floorNum % 3]
  const name = `守塔人·${['刀', '盘', '味'][floorNum % 3]}${floorNum}层`
  // 楼层属性上浮：hp ×(1+0.012×(层-1))，atk/def 同比例爬坡（温和，前期可碾压、深处变墙）
  const g = 1 + Math.max(0, (floorNum - 1) * 0.012)
  return opp(level, name, style, {
    isTower: true,
    hp: Math.round((12 + level * 6) * g),
    atk: (1 + level * 0.7) * g,
    def: Math.round(level * 1.5 * g),
    eva: 4 + level * 1.5 + Math.max(0, floorNum - 1) * 0.1,
    drops: [],
  })
}

/** 每 10 层里程碑奖励（一次性发放，player.tower.rewarded 记录） */
export function towerMilestone(floorNum) {
  if (floorNum % 10 !== 0) return null
  const tier = floorNum / 10
  const gold = 200 * tier + 300
  const items = {}
  if (tier >= 2) items.energyBiscuit = 1
  if (tier >= 5) items.mysterySpice = 1
  return { floor: floorNum, gold, items }
}

/** 解锁条件：对决等级 99（转生毕业内容） */
export const TOWER_UNLOCK_LEVEL = 99
