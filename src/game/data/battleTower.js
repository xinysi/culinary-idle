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
// 100 层以上的**深潜段**（2026-09-19 补）：实测真满配可推到 F1000+（本地仿真记录）
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
  // 楼层属性上浮：hp/atk 按 g 爬坡（温和，前期可碾压、深处变墙）
  //
  // 🔴 **2026-09-26 重标定：g 改两段**（原为单一斜率 0.012）。
  //    · 第一段（F1~250，K1 = 0.012）：**原口径一字不动** —— 塔在 L60 解锁，这一段是刚解锁玩家的主战场。
  //      修好仪器后实测（`scripts/sim/depth_curve.mjs`）：L60 的 50% 深度 = **F225**、全败在 F250
  //      ⇒ 解锁即有挑战、又不劝退。重标定**不得**波及这一段。
  //    · 第二段（F250 之后，K2 = 0.0195）：把深层重新压陡。
  //      **为什么**：单一 0.012 时，满配（20 件顶级料理/场、奥义关、中立风格）实测 50% 深度在
  //      **F1520**（F1500 63% → F1600 0%），比设计口径（标准 ≈F1100 / 精英 ≈F800 / 极限 ≈F450）深约 400 层；
  //      L90 阶段到 F400 仍是 100% ⇒ **F400~F1500 这约 1100 层是「零挑战走廊」**（后期「塔就是点下一层」的根因）。
  //      K2 按「让 50% 深度回到设计口径」反解：阈值在 g ≈ 19.6（料理续航与对手 DPS 的交叉点），
  //      250 + (19.6 − 3.988) / 0.0195 ≈ **F1050**。
  //      ⚠️ 战斗是**阈值型**（续航一旦压不住对手 DPS，胜率从 ~80% 直落 0%），所以这个线性反解只是起点：
  //      改完必须用 sim 复测（`scripts/sim/tower_sim.mjs --tier max --from 900 --to 1150 --step 50`），
  //      三档都要看（`--tier-id elite|extreme`）。
  const F1 = 250
  const K1 = 0.012
  const K2 = 0.0195
  const g = 1 + Math.max(0, Math.min(floorNum - 1, F1 - 1) * K1) + Math.max(0, floorNum - F1) * K2
  // 但 def/eva 不能跟着同一个 g 一起几何爬坡：伤害公式是 def/(def+100) 的饱和减伤，塔的 def 会
  // 很快吃掉玩家的伤害区间。实测（满配：五技能 120 级 + 5 转生 + 各槽最强装备，20 场/层）：
  //   def 跟 g → F90 只剩 6/20、F100 起 0/20 全败（而塔名深到 130+ 层、每 10 层还有里程碑）＝死墙；
  //   def 走 √g → F90 20/20、F100 17/20、F110 起 0/20。
  // 故 def 走 g 的平方根（hp/atk 不变）、eva 的层数项减半，让深处是「难」而不是「不可能」。
  // 复测方法：scripts/sim/endgame_sim.mjs 的挑战塔段（每层必须满血开局，否则量的是假墙）。
  // def 再封一层顶（2026-09-19 实测）：只走 √g 时 def 仍会无限涨，而伤害是 `def/(def+100)` 的**饱和减伤**，
  // 于是深层必然出现「玩家固定伤害被吃干」的断崖。现把 def 的层数增长**封在 3.2 倍**（≈ 减伤 87% 上限），
  // 深层难度改由 hp/atk 的增长提供（2026-09-26 起走上面那条两段曲线）。
  // ⚠️ 上面注释里那句「F900 98% → F1100 34% → F1500 起永久全败」是 **2026-09-19 的实测**；2026-09-26 修好
  //    仪器（`lib/fight.mjs` 第 7 个仪器陷阱）后同层真值是 F1100 = **99%** —— 那组数别再当基线引用。
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
export function towerMilestone(floorNum, rewardMult = 1) {
  if (floorNum % 10 !== 0) return null
  const tier = floorNum / 10
  // 难度档的奖励倍率（2026-09-22）：**只放大金币与抽卡券**，礼包内物品数量保持不变 ——
  // 饼干是离线上限、调料是准货币，按倍率翻倍会把「高难档」变成纯到账翻倍，收益不好标定。
  const rm = Number(rewardMult) > 0 ? Math.round(Number(rewardMult) * 100) / 100 : 1
  const gold = Math.round((80 * tier * tier + 300) * rm)
  const items = {}
  if (tier >= 2) items.energyBiscuit = 1
  if (tier >= 5) items.mysterySpice = 1
  // 觅珍抽卡券：**货币不是物品**（`player.mijian.tickets`，与山海/厨神外环同字段）——
  // ⚠️ 我第一版写成 `items.mijianTicket`，那是个**不存在的物品 id**（靠下面的 C44 守卫抓出来的）。
  //
  // 🔴 **2026-09-26 券发放量翻倍（重标定的补偿）**：`towerFloor` 的爬坡改成两段后，三档的可达深度
  //    从「标准 F1520 / 精英 ~F984 / 极限 ~F717」回退到「**F1050 / F560 / F360**」⇒ 券的**总产出
  //    从约 4500 掉到 1913（−58%）**。这不是设计意图（那轮目的是**难度**，不是砍货币），
  //    而券是「后期稀缺的真货币」（见上面 ② 的设计说明）⇒ **在奖励侧补偿**：
  //    每 25 层的 `5+⌊tier/25⌋×5` → **`10+⌊tier/25⌋×10`**、每 100 层深潜礼包的
  //    `20+⌊floor/100⌋×10` → **`40+⌊floor/100⌋×20`**。
  //    改后三档合计 **3826 张**（≈回到重标定前的设计口径 3600，+6%）。
  //    ⚠️ **只补券、不补金币**：金币在后期本就过剩（满配收入 138 万/小时），而里程碑金币的设计用途是
  //    「配得上推到那里的代价」（见上面 ①）—— 深度回退后补贴自然封顶，是自洽的，不是缺口。
  //    ⚠️ **别用放平 `K2` 来补**：那等于把标准档的墙推回 F1500、把「零挑战走廊」还回去。
  //    守卫：`system_test` 的「塔深层」有「三档设计深度下的券总产出 ≥3600」这条定值断言。
  let tickets = 0
  if (floorNum % 25 === 0) tickets += 10 + Math.floor(tier / 25) * 10         // 每 25 层
  if (floorNum % 100 === 0 && floorNum >= 100) {                              // 每 100 层「深潜礼包」
    tickets += 40 + Math.floor(floorNum / 100) * 20
    items.energyBiscuit = (items.energyBiscuit ?? 0) + 3
    items.mysterySpice = (items.mysterySpice ?? 0) + 2
  }
  return { floor: floorNum, gold, items, tickets: Math.round(tickets * rm), rewardMult: rm }
}

/**
 * 塔的难度档（2026-09-22 用户批准「按合理平衡的方式改」）：
 * 把「后期难度」做成**玩家自选**，而不是全局抬高敌人数值。
 *
 * 依据（`scripts/sim/enemy_ttk.mjs` + `tower_sim.mjs` 实测）：
 *   · 普通对决 248 个敌人：同等级白板 100% 胜率、中位 6.0s；把敌人数值 ×1.5 只是把时长翻倍
 *     （6→13.2s、L81+ 段 12→25s），败率仅 0→11%（区域 4%）⇒ 玩家感知是「变磨」不是「变难」。
 *   · 塔是全游戏**唯一存在真墙**的地方：设计档满配 F1000 仍 100%、F1200 掉到 20%、F1400 起全败。
 *   ⇒ 所以难度加在这里、且由玩家选，普通对决一个字节不动。
 *
 * ⚠️ 倍率只作用在**运行时副本**上（与「困难模式」对首领的 ×1.5 同一做法）——
 *    `COMBAT_REGIONS` / `COMBAT_BOSSES` 的冻结数据一字未改（守卫有断言）。
 */
export const TOWER_TIERS = [
  { id: 'standard', name: '标准', icon: '🗼', mult: 1, rewardMult: 1, desc: '原始强度' },
  { id: 'elite', name: '精英', icon: '🔥', mult: 1.5, rewardMult: 1.5, desc: '守塔人属性 ×1.5 · 里程碑金币与抽卡券 ×1.5' },
  { id: 'extreme', name: '极限', icon: '💀', mult: 2, rewardMult: 2, desc: '守塔人属性 ×2 · 里程碑金币与抽卡券 ×2（墙会明显前移）' },
]
export function towerTierOf(id) {
  return TOWER_TIERS.find((t) => t.id === id) ?? TOWER_TIERS[0]
}
/** 把档位倍率作用到对手副本上（**返回新对象，不改传入数据**） */
export function applyTowerTier(opponent, tierId) {
  const t = towerTierOf(tierId)
  if (!opponent || t.mult === 1) return opponent
  return {
    ...opponent,
    tierId: t.id,
    tierName: t.name,
    hp: Math.round(opponent.hp * t.mult),
    atk: opponent.atk * t.mult,
    def: Math.round(opponent.def * t.mult),
    eva: Math.round(opponent.eva * t.mult),
  }
}
/** 里程碑记账键：标准档沿用旧档的**数字键**（旧存档无需迁移），其它档带前缀 */
export function towerMilestoneKey(floorNum, tierId) {
  return towerTierOf(tierId).id === 'standard' ? floorNum : `${towerTierOf(tierId).id}:${floorNum}`
}
/** 失败代价：塔内被击退 → **退回上一层**（从第 5 层起生效，低层不给新手施压；`best` 永不回退） */
export const TOWER_FLOOR_DROP_FROM = 5

/** 解锁条件：对决等级 60
 *  ⚠️ 2026-09-19 参照 Rocky Idle 从 **99 下调到 60**：参考作的挑战内容随档位**连续开放**（随时有下一档可推），
 *  而本作原本把**唯一的可重复挑战**锁在 99 —— 恰好在大后期之后，而 85→120 级占全经验的 96%，
 *  导致中后期那 160+ 小时只有重复挂机。下调后：60 级起就能「爬到自己的上限」，塔自然按战力封顶（对手每 4 层 +1 级）。 */
export const TOWER_UNLOCK_LEVEL = 60
