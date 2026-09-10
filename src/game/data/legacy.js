// 师徒传承（2026-09-10 新增）— 两条线：
//   ① 转生「留一手」：转生时把该技能等级的 5%（上限 20 级）带进轮回，重置后不再从 1 级起步；
//   ② 徒弟档案：按真实日历日成长（每天 +1 级，上限 50），每级提升离线收益效率 0.4%（0.8 → 最高 1.0）。
// 设计约束：不改动转生既有规则（+20% 经验/层、上限 120 保持不变），传承等级与徒弟均为新增层。

/** 转生传承：按转生前等级取 5%，上限 20 级 */
export const CARRY_RATIO = 0.05
export const CARRY_MAX = 20

export function carryFromLevel(level) {
  return Math.max(0, Math.min(CARRY_MAX, Math.floor((level ?? 0) * CARRY_RATIO)))
}

/** 徒弟：每日 +1 级，上限 50 级；每级离线效率 +0.4%（0.8 → 最高 1.0） */
export const APPRENTICE_MAX_LEVEL = 50
export const APPRENTICE_OFFLINE_PER_LEVEL = 0.004

export function apprenticeOfflineBonus(level) {
  return Math.min(0.2, Math.max(0, level ?? 0) * APPRENTICE_OFFLINE_PER_LEVEL)
}

/** 徒弟等级的阶段称号（展示用） */
export const APPRENTICE_RANKS = [
  { min: 0, name: '新入门弟子' },
  { min: 5, name: '小厨' },
  { min: 15, name: '大厨' },
  { min: 30, name: '掌勺弟子' },
  { min: 45, name: '衣钵传人' },
]

export function apprenticeRank(level) {
  let out = APPRENTICE_RANKS[0]
  for (const r of APPRENTICE_RANKS) if ((level ?? 0) >= r.min) out = r
  return out
}
