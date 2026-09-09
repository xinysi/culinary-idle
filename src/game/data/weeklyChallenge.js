// 每周挑战赛（2026-09-09 新增）— 与「周常任务」互补：周常是**产量**目标，挑战赛是**难度/技术**目标。
// 每周按周序号确定性轮换 1 个挑战；进度按周累计，达成一次性领大奖；历史最佳按挑战 id 记录（本地榜）。
export const CHALLENGES = [
  { id: 'tower20', name: '塔之试炼', desc: '本周试炼塔推进到第 20 层', kind: 'tower', target: 20, gold: 1500, items: { mysterySpice: 1 } },
  { id: 'boss5', name: '首领猎手', desc: '本周击败 5 位首领', kind: 'boss', target: 5, gold: 1200, items: { energyBiscuit: 1 } },
  { id: 'win200', name: '百战之志', desc: '本周对决胜利 200 场', kind: 'combatWin', target: 200, gold: 1800, items: { mysterySpice: 1 } },
  { id: 'explore100', name: '秘境行者', desc: '本周成功探索 100 次', kind: 'explore', target: 100, gold: 1400, items: { energyBiscuit: 1 } },
  { id: 'arena8', name: '连胜之路', desc: '本周竞技场达成 8 连胜', kind: 'arena', target: 8, gold: 1600, items: { mysterySpice: 1 } },
  { id: 'craft300', name: '百炼成厨', desc: '本周制作 300 件料理/装备', kind: 'craft', target: 300, gold: 1500, items: { energyBiscuit: 1 } },
]

/** 按周序号（epoch 天数/7）确定性选 1 个挑战 */
export function challengeForWeek(weekNum) {
  const n = CHALLENGES.length
  return CHALLENGES[((weekNum % n) + n) % n]
}

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id) ?? null
}
