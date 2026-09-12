// 精通（mastery）系统 — 每个卡片独立的精通等级 0~100
// 精通通过「获得次数」累加：每次触发该卡片产出/制作，该卡片精通次数 +1。
// 精通升级所需次数（阶梯，2026-09-09 降速：总次数 7500 → 3750，正反馈更密）：1-25 每级 8 次；
// 26-50 每级 22 次；51-75 每级 45 次；76-100 每级 75 次。
// 精通档位效果（2026-09-09 平衡：经验上限 ×20→×8、固定间隔 0.5s→2.0s，抑制「蹲最低级目标刷精通」
//   并把单技能满级从 ~15h 拉回 1.5~3 天量级；双倍/比例间隔保留）：
//   5 级：经验×1.1、双倍 1%、间隔减 1/3；10 级：×1.2、5%、减半；20 级：×1.4、10%、固定 3.6s；
//   30 级：×1.6、15%、3.2s；40 级：×1.9、20%、3.0s；50 级：×2.2、30%、2.8s；60 级：×2.5、40%、2.6s；
//   70 级：×2.8、50%、2.4s；80 级：×3.2、60%、2.2s；90 级：×3.6、70%、2.1s；100 级：×4、80%、2.0s。

export const MASTERY_LEVEL_CAP = 100

/** 升到第 lv 级所需次数（lv 从 1 起）。返回该级的升级门槛次数（2026-09-09 降为约 1/2）。 */
function masteryLevelReq(lv) {
  if (lv <= 0) return 0
  if (lv <= 25) return 8
  if (lv <= 50) return 22
  if (lv <= 75) return 45
  return 75
}

/** 累计达到精通等级 level 所需的总次数 */
export function countForMasteryLevel(level) {
  if (level <= 0) return 0
  let c = 0
  for (let lv = 1; lv <= level; lv++) c += masteryLevelReq(lv)
  return c
}

/** 由累计次数 count 反推当前精通等级（0~100） */
export function masteryLevelFromCount(count) {
  if (!(count > 0)) return 0
  let level = 0
  for (let lv = 1; lv <= MASTERY_LEVEL_CAP; lv++) {
    if (count >= countForMasteryLevel(lv)) level = lv
    else break
  }
  return level
}

/** 当前精通等级内的累计次数（用于进度显示） */
export function masteryLevelProgress(count) {
  const level = masteryLevelFromCount(count)
  if (level >= MASTERY_LEVEL_CAP) return { level, current: countForMasteryLevel(level), needed: countForMasteryLevel(level), progress: 1 }
  const base = countForMasteryLevel(level)
  const next = countForMasteryLevel(level + 1)
  return { level, current: count - base, needed: next - base, progress: Math.min(1, (count - base) / (next - base)) }
}

/** 精通等级对应的双倍概率（新档位：5→1%、10→5%、20→10%、30→15%、40→20%、50→30%、60→40%、70→50%、80→60%、90→70%、100→80%） */
export function masteryDoubleChance(level) {
  if (level >= 100) return 0.8
  if (level >= 90) return 0.7
  if (level >= 80) return 0.6
  if (level >= 70) return 0.5
  if (level >= 60) return 0.4
  if (level >= 50) return 0.3
  if (level >= 40) return 0.2
  if (level >= 30) return 0.15
  if (level >= 20) return 0.1
  if (level >= 10) return 0.05
  if (level >= 5) return 0.01
  return 0
}

/** 精通等级对应的采集间隔因子（比例）：<5 为 1；5~9 减 1/3（×2/3）；≥10 减半（×1/2）。
 *  ≥20 仍取 1/2 —— 固定间隔（masteryFixedInterval）只作「上限」叠加（取更快者），
 *  不再整段替换比例口径（2026-09-12 修：整段替换会让 51% 的目标在精通 19→20 时反而变慢，最差 2.4 倍）。 */
export function masteryIntervalFactor(level) {
  if (level >= 10) return 0.5
  if (level >= 5) return 2 / 3
  return 1
}

/** 精通等级对应的固定采集间隔（秒）：≥20 返回固定值，否则 null（该档无固定值）。
 *  语义是**上限**（取更快者，见 GatheringSkill.intervalMs），不是整段替换：固定值给「基础间隔长」的目标提速，
 *  基础间隔短的目标继续走「基础÷2」，因此精通升级永远不会让同一张卡变慢。2026-09-09 定值、2026-09-12 改为取更快者。 */
export function masteryFixedInterval(level) {
  if (level >= 100) return 2.0
  if (level >= 90) return 2.1
  if (level >= 80) return 2.2
  if (level >= 70) return 2.4
  if (level >= 60) return 2.6
  if (level >= 50) return 2.8
  if (level >= 40) return 3.0
  if (level >= 30) return 3.2
  if (level >= 20) return 3.6
  return null
}

/** 精通档位的保底产量加成（2026-09-09，参照 Rocky Idle 的 batch 机制：档位同时给经验与产出）
 *  50 级起每次动作额外 +1 个产物、100 级 +2（叠加在双倍几率之上，作用于采集/农耕/制作） */
export function masteryYieldBonus(level) {
  if (level >= 100) return 2
  if (level >= 50) return 1
  return 0
}

/** 精通等级对应的基础经验倍数（2026-09-09 降速：上限 ×20→×4，档位同步下调）；
 *  5→×1.1、10→×1.2、20→×1.4、30→×1.6、40→×1.9、50→×2.2、60→×2.5、70→×2.8、80→×3.2、90→×3.6、100→×4 */
export function masteryXpMultiplier(level) {
  if (level >= 100) return 4
  if (level >= 90) return 3.6
  if (level >= 80) return 3.2
  if (level >= 70) return 2.8
  if (level >= 60) return 2.5
  if (level >= 50) return 2.2
  if (level >= 40) return 1.9
  if (level >= 30) return 1.6
  if (level >= 20) return 1.4
  if (level >= 10) return 1.2
  if (level >= 5) return 1.1
  return 1
}
