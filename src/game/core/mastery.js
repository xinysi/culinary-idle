// 精通（mastery）系统 — 每个卡片独立的精通等级 0~100
// 精通通过「获得次数」累加：每次触发该卡片产出/制作，该卡片精通次数 +1。
// 精通升级所需次数（阶梯，2026-09 降为约 1/4）：1-25 每级 15 次；26-50 每级 45 次；51-75 每级 90 次；76-100 每级 150 次。
// 精通档位效果（2026-09：经验倍数温和化 ×1.5~×20，双倍/间隔保留）：
//   5 级：经验×1.5、双倍 1%、间隔减 1/3；10 级：×2、5%、减半；20 级：×3、10%、固定 1.2s；
//   30 级：×4、15%、1.2s；40 级：×5、20%、0.8s；50 级：×6、30%、0.8s；60 级：×8、40%、0.6s；
//   70 级：×10、50%、0.6s；80 级：×12、60%、0.4s；90 级：×15、70%、0.4s；100 级：×20、80%、0.2s。

export const MASTERY_LEVEL_CAP = 100

/** 升到第 lv 级所需次数（lv 从 1 起）。返回该级的升级门槛次数（2026-09 降为约 1/4）。 */
function masteryLevelReq(lv) {
  if (lv <= 0) return 0
  if (lv <= 25) return 15
  if (lv <= 50) return 45
  if (lv <= 75) return 90
  return 150
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

/** 精通等级对应的采集间隔因子（比例）：<5 为 1；5~9 减 1/3（×2/3）；10~19 减半（×1/2）；≥20 由固定间隔接管 */
export function masteryIntervalFactor(level) {
  if (level >= 20) return 1
  if (level >= 10) return 0.5
  if (level >= 5) return 2 / 3
  return 1
}

/** 精通等级对应的固定采集间隔（秒）：≥20 返回固定值，否则 null（用比例）。 */
export function masteryFixedInterval(level) {
  if (level >= 100) return 0.2
  if (level >= 90) return 0.4
  if (level >= 80) return 0.4
  if (level >= 70) return 0.6
  if (level >= 60) return 0.6
  if (level >= 50) return 0.8
  if (level >= 40) return 0.8
  if (level >= 30) return 1.2
  if (level >= 20) return 1.2
  return null
}

/** 精通等级对应的基础经验倍数（2026-09 方向 A：降为温和档，避免精通主导升级）；
 *  5→×1.5、10→×2、20→×3、30→×4、40→×5、50→×6、60→×8、70→×10、80→×12、90→×15、100→×20 */
export function masteryXpMultiplier(level) {
  if (level >= 100) return 20
  if (level >= 90) return 15
  if (level >= 80) return 12
  if (level >= 70) return 10
  if (level >= 60) return 8
  if (level >= 50) return 6
  if (level >= 40) return 5
  if (level >= 30) return 4
  if (level >= 20) return 3
  if (level >= 10) return 2
  if (level >= 5) return 1.5
  return 1
}
