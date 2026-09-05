// 经验曲线 — 需求文档 §11.1：经典 RuneScape 指数曲线
// 基础曲线：1~99 级累计约 13,034,431 经验。
// 数值平衡：满级改为 100；保留 RuneScape 指数形状，整体同形状缩放系数
// EXP_SCALE，使"99→100 级所需经验恰好 = 3亿"。
// 缩放后累计到 100 级约 31.8 亿经验，各级门槛逐级陡增。

/** 缩放系数：由 99→100 级所需经验 = 3亿 反推。
 *  原版 base(100)-base(99) = 1,356,729，故 EXP_SCALE = 3e8 / 1,356,729 ≈ 221.12 */
const EXP_SCALE = 221.120062

/** 计算缓存：totalXpForLevel 为纯函数且被高频调用（升级判定/进度条），缓存结果避免重复累加循环 */
const xpCache = new Map()

/**
 * 到达指定等级所需的累计经验（total xp at level）
 * 原版 RuneScape 指数公式，整体乘以 EXP_SCALE（同形状缩放，99→100 = 3亿）。
 */
export function totalXpForLevel(level) {
  const cached = xpCache.get(level)
  if (cached !== undefined) return cached
  let total = 0
  for (let i = 1; i < level; i++) {
    total += Math.floor((i + 300 * Math.pow(2, i / 7)) * EXP_SCALE)
  }
  const result = Math.floor(total / 4)
  xpCache.set(level, result)
  return result
}

/** 从 level 升到 level+1 所需经验 */
export function xpRequiredForLevelUp(level) {
  return totalXpForLevel(level + 1) - totalXpForLevel(level)
}

/** 由累计经验反推等级（二分查找），默认上限 100 级 */
export function levelFromXp(exp, maxLevel = 100) {
  if (exp <= 0) return 1
  let lo = 1
  let hi = maxLevel
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (totalXpForLevel(mid) <= exp) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** 经验进度分解：{ level, current(本级内经验), needed(升到下一级所需), progress(0~1) }
 *  `level` 可选：若提供则作为当前等级（权威值，如存档 skillState.level），
 *  否则由 levelFromXp 根据累计经验反推。进度条在两种情况下都基于该当前等级的累计基线。 */
export function xpProgress(exp, maxLevel = 100, level = null) {
  const cur = level ?? levelFromXp(exp, maxLevel)
  if (cur >= maxLevel) {
    return { level: maxLevel, current: 0, needed: 0, progress: 1 }
  }
  const base = totalXpForLevel(cur)
  const next = totalXpForLevel(cur + 1)
  const current = Math.floor(exp - base)
  const needed = next - base
  return { level: cur, current, needed, progress: Math.min(1, current / needed) }
}
