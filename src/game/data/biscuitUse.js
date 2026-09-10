// 能量饼干的第二用途（2026-09-10）— 解决「离线时长封顶后饼干就无用」的溢出问题。
//
// 背景：能量饼干的效果是「离线上限 +4h」（物品效果，属固定数据，不可改），而离线上限本身封顶 +12h，
//       所以一生只用得上 3 块；但它的来源是消耗品式的（30 项成就共发 38 块 + 烘焙配方可无限制作 + 7 处可重复掉落）。
// 解决：为它开两个**不封顶**的出口（都是新增功能读取既有物品，不改动物品定义本身）：
//   A. 战斗内「能量补给」：消耗 1 块 → 立刻回品鉴值 + 数回合「精力充沛」（命中/攻速），有冷却节奏
//   B. 常驻回收：消耗 N 块 → 品鉴点（奥义本身就是持续消耗的不封顶系统）
// 参数集中在此，便于调平衡。

/** A：战斗内使用 —— 立刻恢复最大品鉴值的百分比 */
export const BISCUIT_HEAL_PCT = 0.25
/** A：精力充沛的回合数 */
export const BISCUIT_BUFF_TURNS = 5
/** A：命中加成（绝对值，与神秘调料同量级） */
export const BISCUIT_ACC = 8
/** A：攻速加成（%，缩短出手间隔） */
export const BISCUIT_SPEED_PCT = 10
/** A：自身冷却回合（与料理 3 回合同规格，略长一回合） */
export const BISCUIT_COOLDOWN_TURNS = 4

/** B：单块饼干可兑换的品鉴点（保守取值：略低于「打一场同级战斗」的效率，避免取代战斗成为主要来源） */
export const BISCUIT_TASTE_RATE = 10
/** B：单次兑换上限（防止一次性误操作，可反复兑换） */
export const BISCUIT_EXCHANGE_MAX = 999

/** B：兑换 N 块可得的品鉴点 */
export function tasteFromBiscuits(count) {
  const n = Math.max(0, Math.floor(count ?? 0))
  return n * BISCUIT_TASTE_RATE
}

/** B：按持有量算出可兑换的最大块数 */
export function maxExchangeable(owned) {
  return Math.max(0, Math.min(BISCUIT_EXCHANGE_MAX, Math.floor(owned ?? 0)))
}

/** A：战斗内一次补给的效果预览（页面提示用） */
export function biscuitCombatText(maxHp) {
  const heal = Math.floor((maxHp ?? 0) * BISCUIT_HEAL_PCT)
  return `回复 ${heal} 品鉴值 · 命中 +${BISCUIT_ACC} · 攻速 +${BISCUIT_SPEED_PCT}%（${BISCUIT_BUFF_TURNS} 回合）`
}
