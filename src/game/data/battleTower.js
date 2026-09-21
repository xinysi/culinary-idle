// 无尽挑战塔 — 对决毕业后的长期目标（2026-09-06）
// 对手由 opp() 动态生成（arena 同款先例）：从玩家对决等级起步、每 4 层 +1 级，
// 属性随层数温和上浮 → 塔深无限、无固定敌人数据（不触碰 combat.js 铁律 COMBAT_REGIONS/BOSS）。
import { opp } from './combat.js'

// 每 10 层一组楼层名（塔深无限循环用，文化味）
const TOWER_NAMES = [
  '第一层·试炼石台', '第十层·不夜厨房', '第二十层·味觉回廊', '第三十层·赤焰灶堂',
  '第四十层·百味渊薮', '第五十层·无名山门', '第六十层·辞喜长廊', '第七十层·沸海孤岛',
  '第八十层·星火祭坛', '第九十层·混沌食窟', '第一百层·厨神之路',
]
// 100 层以上的**深潜段**（2026-09-19 补）：实测真满配可推到 F1000+（见 docs/实验记录/…_阶段与塔深度）
// ⇒ 原来「130 层之后统称轮回饕餮殿」的命名已跟不上实际深度，每个百层段各给一个名号。
const TOWER_NAMES_DEEP = [
  '第二百层·轮回饕餮殿', '第三百层·万味星河', '第四百层·食髓天阶', '第五百层·无垢鼎宫',
  '第六百层·饕云深处', '第七百层·百骸宴台', '第八百层·寂味长夜', '第九百层·终焉食界',
  '第一千层·厨道尽头', '更深处·无名之灶',
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
  const band = Math.min(1000, Math.ceil(floorNum / 100) * 100)
  return TOWER_NAMES_DEEP[Math.min(band / 100 - 2, TOWER_NAMES_DEEP.length - 1)]
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
  // 楼层属性上浮：hp/atk 按 g 线性爬坡（温和，前期可碾压、深处变墙）
  const g = 1 + Math.max(0, (floorNum - 1) * 0.012)
  // 但 def/eva 不能跟着同一个 g 一起几何爬坡：伤害公式是 def/(def+100) 的饱和减伤，塔的 def 会
  // 很快吃掉玩家的伤害区间。实测（满配：五技能 120 级 + 5 转生 + 各槽最强装备，20 场/层）：
  //   def 跟 g → F90 只剩 6/20、F100 起 0/20 全败（而塔名深到 130+ 层、每 10 层还有里程碑）＝死墙；
  //   def 走 √g → F90 20/20、F100 17/20、F110 起 0/20。
  // 故 def 走 g 的平方根（hp/atk 不变）、eva 的层数项减半，让深处是「难」而不是「不可能」。
  // 复测方法：scripts/sim/endgame_sim.mjs 的挑战塔段（每层必须满血开局，否则量的是假墙）。
  // def 再封一层顶（2026-09-19 实测）：只走 √g 时 def 仍会无限涨，而伤害是 `def/(def+100)` 的**饱和减伤**，
  // 于是深层必然出现「玩家固定伤害被吃干」的断崖（满配实测：F900 98% → F1100 34% → F1500 起永久全败）。
  // 现把 def 的层数增长**封在 3.2 倍**（≈ 减伤 87% 上限），深层难度改由 hp/atk 的线性增长提供
  // ⇒ 从「断崖」变成「DPS 竞速」的平滑下坡（胜率随层缓慢下降，而不是某一层突然归零）。
  const gSoft = Math.min(Math.sqrt(g), 3.2)
  return opp(level, name, style, {
    isTower: true,
    hp: Math.round((12 + level * 6) * g),
    atk: (1 + level * 0.7) * g,
    def: Math.round(level * 1.5 * gSoft),
    eva: 4 + level * 1.5 + Math.max(0, floorNum - 1) * 0.05,
    drops: [],
  })
}

/** 每 10 层里程碑奖励（一次性发放，`player.tower.rewarded` 记录）
 *
 * 2026-09-19 参照 Rocky Idle「随时有下一档、**下一档要有意义**」加深（实测真满配可推到 F1000+）：
 *   ① 金币由**线性**改为**平方**：`200×tier+300` → `80×tier²+300`（F100=1.4 万 → 仍小；F500=20 万、F1000=80 万
 *      —— 后期时收约 138 万/小时，深层里程碑才配得上「推到那里」的代价；全塔到 1000 层合计约 2700 万，属一次性长尾）。
 *   ② 深层补**非金币**奖励：每 25 层给**觅珍抽卡券**（真货币，后期稀缺），每 100 层给「深潜礼包」（券 + 饼干 + 调料）。
 *   ⚠️ 里程碑是**一次性**的（`tower.rewarded` 记账），可重复刷的只有战斗本身，所以不构成刷金币漏洞。
 */
export function towerMilestone(floorNum) {
  if (floorNum % 10 !== 0) return null
  const tier = floorNum / 10
  const gold = 80 * tier * tier + 300
  const items = {}
  if (tier >= 2) items.energyBiscuit = 1
  if (tier >= 5) items.mysterySpice = 1
  // 觅珍抽卡券：**货币不是物品**（`player.mijian.tickets`，与山海/厨神外环同字段）——
  // ⚠️ 我第一版写成 `items.mijianTicket`，那是个**不存在的物品 id**（靠下面的 C44 守卫抓出来的）。
  let tickets = 0
  if (floorNum % 25 === 0) tickets += 5 + Math.floor(tier / 25) * 5          // 每 25 层
  if (floorNum % 100 === 0 && floorNum >= 100) {                              // 每 100 层「深潜礼包」
    tickets += 20 + Math.floor(floorNum / 100) * 10
    items.energyBiscuit = (items.energyBiscuit ?? 0) + 3
    items.mysterySpice = (items.mysterySpice ?? 0) + 2
  }
  return { floor: floorNum, gold, items, tickets }
}

/** 解锁条件：对决等级 60
 *  ⚠️ 2026-09-19 参照 Rocky Idle 从 **99 下调到 60**：参考作的挑战内容随档位**连续开放**（随时有下一档可推），
 *  而本作原本把**唯一的可重复挑战**锁在 99 —— 恰好在大后期之后，而 85→120 级占全经验的 96%，
 *  导致中后期那 160+ 小时只有重复挂机。下调后：60 级起就能「爬到自己的上限」，塔自然按战力封顶（对手每 4 层 +1 级）。 */
export const TOWER_UNLOCK_LEVEL = 60
