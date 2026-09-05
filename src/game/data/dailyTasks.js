// 每日/周常任务 — 长线日活钩子（2026-09-06）
// 每日从模板池按日期序号确定性选取 3 条；周常每周 1 条大目标。
// 进度走 player.bumpDaily/bumpWeekly（与主线任务/赛季/公会同一条事件链，向上兼容，不触碰铁律数据）。
// 奖励：gold 为基准值，领取时按玩家对决等级放大（见 player.claimDailyTask）；items 为固定物品 id。

export const DAILY_POOL = [
  { name: '🌿 采集专家', kind: 'gather', param: 'any', qty: 40, gold: 180 },
  { name: '🍳 厨房快手', kind: 'craft', param: 'any', qty: 12, gold: 220 },
  { name: '🌾 丰收农夫', kind: 'harvest', param: 'any', qty: 10, gold: 200 },
  { name: '⚔️ 决斗新星', kind: 'combatWin', param: 'any', qty: 10, gold: 260 },
  { name: '👑 精英猎人', kind: 'boss', param: 'any', qty: 2, gold: 320 },
  { name: '🧭 环球探索', kind: 'explore', param: 'any', qty: 10, gold: 240 },
  { name: '🎣 深海垂钓', kind: 'gather', param: 'fishing', qty: 30, gold: 200 },
  { name: '⛏️ 秘境挖宝', kind: 'gather', param: 'excavation', qty: 30, gold: 220 },
  { name: '🧪 炼金大师', kind: 'alchemy', param: 'any', qty: 6, gold: 280 },
  { name: '🕶️ 快手收成', kind: 'gather', param: 'foraging', qty: 40, gold: 200 },
  { name: '🍖 狩猎时刻', kind: 'gather', param: 'hunting', qty: 25, gold: 220 },
  { name: '🎁 每日签到', kind: 'signin', param: 'any', qty: 1, gold: 120 },
]

// 每周 1 条大目标（1000+ 产量级，奖励翻倍档）
export const WEEKLY_POOL = [
  { name: '🌿 本周采集马拉松', kind: 'gather', param: 'any', qty: 1200, gold: 1500, items: { energyBiscuit: 1 } },
  { name: '🍳 一周大厨', kind: 'craft', param: 'any', qty: 250, gold: 1800, items: { mysterySpice: 1 } },
  { name: '⚔️ 斗士的荣耀', kind: 'combatWin', param: 'any', qty: 200, gold: 2200, items: { mysterySpice: 1, energyBiscuit: 1 } },
  { name: '👑 高层猎手', kind: 'boss', param: 'any', qty: 12, gold: 2600 },
  { name: '🧭 探索家的一周', kind: 'explore', param: 'any', qty: 150, gold: 1600, items: { energyBiscuit: 1 } },
  { name: '🌾 丰收周', kind: 'harvest', param: 'any', qty: 180, gold: 1500, items: { saltOre: 3 } },
  { name: '🧪 炼金工坊周', kind: 'alchemy', param: 'any', qty: 40, gold: 1700, items: { ironOre: 5 } },
  { name: '🎣 渔获季', kind: 'gather', param: 'fishing', qty: 300, gold: 1600, items: { mysterySpice: 1 } },
]

// 每日全部完成礼包（一次性）
export const DAILY_BONUS = { gold: 300, items: { energyBiscuit: 1 } }

/** 按日期序号（YYYYMMDD 数值）确定性选 3 条每日任务（同一天全服一致；跨天轮换窗口） */
export function dailyTasksFor(dayNum) {
  const items = []
  const n = DAILY_POOL.length
  for (let i = 0; i < 3; i++) {
    items.push(DAILY_POOL[(dayNum + i * 5) % n])
  }
  // 去重（池内相邻可能撞）
  const seen = new Set()
  const out = []
  for (const t of items) {
    let key = t.name
    while (seen.has(key)) { key += '·' }
    seen.add(key)
    out.push(t)
  }
  return out
}

/** 按周序号（epoch 天数/7）确定性选 1 条周常 */
export function weeklyTaskFor(weekNum) {
  return WEEKLY_POOL[((weekNum % WEEKLY_POOL.length) + WEEKLY_POOL.length) % WEEKLY_POOL.length]
}
