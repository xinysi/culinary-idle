// 美食探索 · Lv102-120 扩展（2026-09-29，Lv101-120 补档的第三条线）
//
// 为什么这批**不需要新美术**：探索目标的战利品是**引用已有物品**（`loot[].itemId`），
// 而本批前两条线已经补齐了 Lv102~120 的**原料与料理**（`lateGameFood.js` 的 12 件原料 + 9 件制作产物）
// ⇒ 直接用它们当战利品即可（原先顶档就是这么干的：掉 `excavation_ext2_30` 蓝晶矿 + 料理）。
//
// 🔴 三条口径（都照抄既有顶档，不发明新公式）：
//   ① 字段形状与 `explorationTargets.js` 完全一致：`{id,name,reqLevel,intervalSec,xp,baseSuccess,failGold,loot[]}`。
//   ② **段位曲线不用改**：`explorationBalance.exploreBandFactor` 的式子 `1 − (段−1)×(1/9)` 在**段 10 就是 0**、
//      段 11/12 由 `Math.max(0, …)` 继续为 0 ⇒ 新目标与段 10 同口径（**0% 起步，靠精通 + 专属装备补足**）。
//      这正是 2026-09-27 那次改版要的形状（「初始成功率随等级段降到 0%，靠精通提高」）。
//   ③ 战利品的**等级带**要匹配：探索虽说「不参与材料锚」（`recipeBalance.js` 明确排除它），
//      但既有审计会查「掉落物品等级 ≤ 目标等级 + 5」（同一条严格标准）⇒ 本模块按档挑料：
//      Lv102~107 用本批 Lv102 料、Lv108~112 用 Lv112 料（112 ≤ 108+5 ✓）、Lv114+ 再放开到制作产物。
//      概率沿用既有取值区间（原料 0.35 / 料理 0.28 / 金币 0.7）—— 这样难度系数桶与审计都不用动。
//
// ⚠️ 本模块**不改** `explorationTargets.js`（生成器产物、且探索数据在铁律冻结清单里）：
// 像采集目标那样 push 进**被 import 的那张表**（`itemSources` / `spoilBalance` / `ExplorationSkill` 都读它）。
// 做法：**副作用导入** —— 谁需要扩展后的表，谁 `import './lateExplore.js'`（ESM 保证先求值）。
// 三处消费方（`itemSources` / `spoilBalance` / `ExplorationSkill`）+ 守卫都显式导入本模块，
// 谁都不依赖「碰巧别的模块先加载了它」。push 带幂等保护（模块被多次导入也只加一遍）。

/** 每档：`[等级, 摊位名, 金币 min~max, [ [物品 id, 概率] ... ] ]`（概率只有两种：原料 0.35 / 料理 0.28） */
const DEFS = [
  [102, '霜果集', [58, 174], [['late_for_02', 0.35], ['late_fish_01', 0.28]]],
  [104, '雪夜市', [59, 177], [['late_fish_01', 0.35], ['late_coo_01', 0.28]]],
  [106, '铁匠巷', [60, 180], [['late_min_01', 0.35], ['late_bak_01', 0.28]]],
  [108, '沉香铺', [61, 183], [['late_wood_01', 0.35], ['late_bre_01', 0.28]]],
  [110, '香料行', [62, 186], [['late_for_03', 0.35], ['late_spi_01', 0.28]]],
  [112, '赤霄巷', [63, 189], [['late_min_02', 0.35], ['late_hun_02', 0.28]]],
  [114, '陨铁坊', [64, 192], [['late_min_02', 0.35], ['late_coo_02', 0.28]]],
  [116, '天罡阁', [65, 195], [['late_wood_02', 0.35], ['late_bak_02', 0.28]]],
  [118, '山海楼', [66, 198], [['late_exc_02', 0.35], ['late_coo_03', 0.28]]],
  [120, '九畹斋', [67, 201], [['late_for_03', 0.35], ['late_spi_02', 0.28]]],
]

/** 扩展目标（供 `explorationTargets.js` 底部 push；id 前缀 `explore_late_` 便于识别与守卫断言） */
export const LATE_EXPLORE_TARGETS = DEFS.map(([lv, name, [gmin, gmax], items], i) => ({
  id: `explore_late_${String(i + 1).padStart(2, '0')}`,
  name,
  reqLevel: lv,
  intervalSec: 8, // 与既有顶档同节奏（全站上限 8s）
  xp: 480 + (lv - 102) * 6, // 顶档 480@99 ⇒ 顺势外推（480@102 → 588@120）
  baseSuccess: 0.6, // 与顶档同值：段 10+ 的初始成功率本来就归 0，这个值只在段位系数里当基数
  failGold: 140, // 与顶档同值
  loot: [
    { type: 'gold', min: gmin, max: gmax, chance: 0.7 },
    ...items.map(([itemId, chance]) => ({ type: 'item', itemId, min: 1, max: chance === 0.35 ? 2 : 1, chance })),
  ],
}))

// ── 接线：push 进共享数组（幂等）─────────────────────────────────────────
import { EXPLORATION_TARGETS_ALL } from './explorationTargets.js'

if (!EXPLORATION_TARGETS_ALL.some((t) => String(t.id).startsWith('explore_late_'))) {
  EXPLORATION_TARGETS_ALL.push(...LATE_EXPLORE_TARGETS)
}
