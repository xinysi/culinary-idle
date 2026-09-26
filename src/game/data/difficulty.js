import { tunerOver } from './tuner.js'
// 全局难度系数 —— 「所有概率获得」的唯一缩放出口（2026-09-21 用户要求：按钮材向、整体大幅下调，金币除外）
//
// 🔴 为什么用系数而不是改数据值
//   对决掉落（`combat.js` 的 drops.chance）、美食探索战利品与成功率（`explorationTargets.js` 的
//   loot[].chance / baseSuccess）、各配方成功率（1,213 条 `successChance`）**全部**受 AGENTS「数据铁律」
//   保护，写着「任何功能都不得改动它们」——2026-09 就是因为改这类数据导致材料-产物失衡、效果倒挂才立的铁律。
//   所以在**读取点**乘系数、不动数据层：① 铁律不破（数据仍是唯一真相）；② 以后想从「大幅」调到「极狠」
//   只改下面 DIFFICULTY 里的数字，不用再碰 2,900 多个数据点。
//
// 🔴 纪律：UI 显示的概率必须走**同一个出口**
//   否则页面写着「30%」而实际按 6% 结算 —— 正是 AGENTS 反复警告的静默不一致。
//   已接线的显示点：
//     · 对决掉落 → `components/DropList.vue` 的百分比
//     · 探索战利品 / 成功率 → `views/ExplorationView.vue` 的 lootLine 与成功率
//     · 制作成功率 → `views/ProductionView.vue`（读的就是 `instance.successChance(r)`，天然同源）
//   **新增任何「显示概率」的地方，一律走本模块的函数，不要直接读数据字段。**
//
// 🔴 金币一律不受影响（用户明确要求「除了金币」）：
//   探索 loot 里 `type==='gold'` 的条目、探索失败的 failGold、对决/任务的固定金币奖励都不经本模块。
//   调用方要自己按 `type` 分流（见 ExplorationSkill）。

/** 缩放系数（1 = 原样；越小越难） */
export const DIFFICULTY = {
  /** 对决掉落（区域对手 + 首领）÷5 */
  drop: 0.2,
  /** 制作类技能成功率 ÷2（覆盖全部制作/烘焙/腌制/调酒/调料/锻造/保鲜/木工/15 支副业/食灵召唤） */
  craft: 0.5,
  /** 美食探索·成功率 ÷2 */
  explore: 0.5,
  /** 美食探索·物品战利品 ÷2（金币条目除外） */
  exploreLoot: 0.5,
  /** 其它功能页的概率型产出 ÷2（见下方清单） */
  other: 0.5,
  /**
   * 采集线上的**附产**概率 ÷2（采摘附带木材、挖掘附带铜/铁/化石、种子、狩猎野鸡蛋）。
   * ⚠️ **单独一个常量**：这几支是 AGENTS 记录的**主供应链**（「采摘附带木材…供锻造同档装备」、
   *    挖掘附带矿石是早期锻造的金属来源），压它们会连带影响锻造/全部副业/配方材料。
   *    若觉得供应链被压过头，把这里改回 1 即可，不影响其它系统。
   *    注意：**只作用于常量基准值**，不作用于 `daoEffects.seedChancePct` 这类玩家练出来的加成。
   */
  gatherExtra: 0.5,
}

/**
 * 下限：避免出现「实际没人碰得到」的极端低值；见 scaleChance 的夹取规则。
 * ⚠️ 下限**故意设得很低**：它只负责挡住「乘完变成 0.02%」这种极端值，而不是给系统兜底。
 *    若把 `other` 设成 1%，那么本来就低于 1% 的（奇遇 0.2%、远行队稀有 0.5%）会因为
 *    「永不抬高」规则被整段豁免、一点没降 —— 第一版就踩了这个坑。
 */
export const CHANCE_FLOOR = {
  drop: 0.01, // 用户指定：掉落 ≥1%
  craft: 0.08, // 用户指定：制作成功率 ≥8%
  explore: 0.12, // 用户指定：探索成功率 ≥12%
  exploreLoot: 0.01,
  other: 0.001,
  gatherExtra: 0.005,
}

/**
 * 唯一的概率缩放函数。
 * 夹取规则（**三个不变量**）：
 *   ① `raw <= 0` 直接返回 0 —— 0 表示「本就不产出」，**绝不能**被下限抬成 1%（那会凭空造出产出）。
 *   ② 下限**只托底、不封顶**，且**绝不超过原值**：本来就比下限还稀有的（如稀有鱼 0.5%）
 *      一律原样保留，免得把「已经够稀有」的东西反而调高。
 *   ③ 永远不会超过原值（mult ≤ 1 时），所以本模块只会让事情变难、不会变简单。
 */
export function scaleChance(raw, mult, floor) {
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) return 0
  const scaled = v * mult
  return Math.max(Math.min(v, floor), scaled)
}

/** 对决掉落概率（对手 / 首领共用） */
export const dropChance = (raw) => scaleChance(raw, tunerOver('diffDrop', DIFFICULTY.drop, CHANCE_FLOOR.drop, DIFFICULTY.drop), CHANCE_FLOOR.drop)

/** 制作类技能成功率（`ProductionSkill.successChance()` 是唯一出口） */
export const craftSuccessChance = (raw) => scaleChance(raw, tunerOver('diffCraft', DIFFICULTY.craft, CHANCE_FLOOR.craft, DIFFICULTY.craft), CHANCE_FLOOR.craft)

/** 美食探索·成功率 */
export const exploreSuccessChance = (raw) => scaleChance(raw, tunerOver('diffExplore', DIFFICULTY.explore, CHANCE_FLOOR.explore, DIFFICULTY.explore), CHANCE_FLOOR.explore)

/** 美食探索·**物品**战利品概率（金币条目不要传进来）
 *  ⚠️ key 与 `TunerPanel.vue` 的 ROWS **必须逐字一致（含大小写）** —— `tunerOver` 按名字查表，查不到就
 *  静默返回基线（首版这里写成 `diffExploreloot`、面板写 `diffExploreLoot` ⇒ 该滑杆在游戏内空转）。
 *  C9b 有「面板每个 key 都有读取点 / 每个读取点都被面板暴露」双向断言兜底。 */
export const exploreLootChance = (raw) => scaleChance(raw, tunerOver('diffExploreLoot', DIFFICULTY.exploreLoot, CHANCE_FLOOR.exploreLoot, DIFFICULTY.exploreLoot), CHANCE_FLOOR.exploreLoot)

/**
 * 其它功能页的概率型产出（÷2）。已接线的系统：
 *   · 吉祥物每日礼物 `itemChance`（`data/mascots.js` 的 mascotItemChance）
 *   · 商队稀有货 `rare.chance` 与线路特产 `specialtyChance`（`stores/player.js`）
 *   · 温室蜂蜜 `GREENHOUSE_HONEY_CHANCE`（`greenhouseHoneyChance()`）
 *   · **垂钓的成功率与稀有鱼**（`FishingSkill.successChance` / `rareChance`）—— 垂钓是采集类里
 *     唯一的概率闸门（失败不给鱼），所以也属于「概率获得」；`rareFishPP` 是制网练出来的，不压
 *   · 采集线附产：挖掘（化石/铜/铁/种子）、采摘（种子）、狩猎（野鸡蛋）—— 见 `gatherExtraChance`
 *   · 随机奇遇触发率（`bootstrap.js`）
 *   · 竞技场 / 名厨挑战 / 食神秘境掉落 —— 它们与对决共用 `Combat.onWin` 的掷骰，自动同源
 * **有意排除**（都不是「掉落」，而是玩家练出来的加成、概率「节省」或纯机制；要一起压请单独说）：
 *   · 精通「双倍产出」（`masteryDoubleChance`）—— 练精通换来的，压它等于惩罚投入
 *   · 采集附产 `GatheringSkill.yieldExtraChance` 的合成值 —— 它聚合了山海食经/轮回天赋等**已发放的奖励**
 *   · 农耕「精耕作物」「附产」—— 同上，由精通与 daoTree 派生（显示处也因此保持原值，非漏改）
 *   · 狩猎「省箭」`ammoSaveChance` —— 是「概率**不**消耗」不是获得，且是制箭副业的轴
 *   · 订单食材/商队特产件数等**数量扰动**（`Math.random() < 0.35 ? 1 : 0`）—— 不是「获得与否」
 *   · 命中/暴击/枯萎/敌人机制 —— 战斗与天气机制
 *   · 小游戏内部随机与游戏币掉落 —— 玩法难度，且游戏币不是金币
 */
export const otherChance = (raw) => scaleChance(raw, tunerOver('diffOther', DIFFICULTY.other, CHANCE_FLOOR.other, DIFFICULTY.other), CHANCE_FLOOR.other)

/**
 * 采集线附产概率（采摘木材 / 挖掘铜·铁·化石 / 种子 / 狩猎野鸡蛋）。
 * 🔴 **只传常量基准值**；玩家练出来的加成（如 `daoEffects.seedChancePct`）要在外面**加回去**，
 *    即 `gatherExtraChance(SEED_CHANCE) + daoPct / 100` —— 别把加成一并压掉。
 * ⚠️ key 必须与面板 ROWS 逐字一致（含大小写）——见上面 `exploreLootChance` 那条注释。
 */
export const gatherExtraChance = (raw) => scaleChance(raw, tunerOver('diffGatherExtra', DIFFICULTY.gatherExtra, CHANCE_FLOOR.gatherExtra, DIFFICULTY.gatherExtra), CHANCE_FLOOR.gatherExtra)

/** 供效果总览 / 调试面板展示「当前难度」用 */
export function difficultyReport() {
  return { ...DIFFICULTY, floors: { ...CHANCE_FLOOR } }
}
