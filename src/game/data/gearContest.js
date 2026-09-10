// 厨具大赛（2026-09-10 新增）— 每周一届：用当前全身装备的"厨具评分"参赛，按分数取档位名次并发奖。
// 设计约束：只读取既有装备数据（物品数值 / 词条 / 宝石 / 强化等级），不改动任何装备数值。

/** 解锁条件：对决达到该等级（先要有装备基础） */
export const GEAR_CONTEST_UNLOCK_LEVEL = 20

/** 评分权重 */
export const GEAR_SCORE_WEIGHTS = {
  value: 1,        // 装备价值
  stats: 6,        // 属性合计（攻击/防御/命中/闪避/生命）
  crit: 400,       // 暴击率（每 1% = 400 分 → 权重按 0.01 计）
  speed: 200,      // 攻速（每 1%）
  mods: 220,       // 每 1 条词条
  gems: 160,       // 每 1 颗已镶嵌宝石
  upgrade: 320,    // 每 1 级强化
}

/** 名次档位：达到 min 分即取该档（从高到低匹配） */
export const GEAR_RANKS = [
  { id: 'S', name: '至尊厨具', min: 12000, gold: 30000, items: { mysterySpice: 2, energyBiscuit: 1 } },
  { id: 'A', name: '名家之作', min: 7000, gold: 16000, items: { mysterySpice: 2 } },
  { id: 'B', name: '上品厨具', min: 3500, gold: 8000, items: { mysterySpice: 1 } },
  { id: 'C', name: '堪用之器', min: 1500, gold: 3500, items: { energyBiscuit: 1 } },
  { id: 'D', name: '新手上路', min: 0, gold: 1200, items: {} },
]

export function rankFromScore(score) {
  return GEAR_RANKS.find((r) => score >= r.min) ?? GEAR_RANKS[GEAR_RANKS.length - 1]
}

/** 本周届次编号（epoch 周，确定性） */
export function contestWeek(nowMs = Date.now()) {
  return Math.floor(nowMs / (7 * 24 * 3600_000))
}

/** 本届主题（按届次确定性轮换，仅作展示） */
export const GEAR_CONTEST_THEMES = ['锋刃之周', '重装之周', '轻盈之周', '华彩之周', '淬火之周']
export function themeOfWeek(week) {
  return GEAR_CONTEST_THEMES[((week % GEAR_CONTEST_THEMES.length) + GEAR_CONTEST_THEMES.length) % GEAR_CONTEST_THEMES.length]
}
