// 大反馈演出（2026-09-18，留存改进 ⑥）——「一次性的大时刻」：首次转生 · 首次把某季十档领满。
//
// 为什么单独一个模块：这两个时刻的**触发条件与幂等口径**要在一处说清，别散在视图里各判一次。
// 口径与既有纪律一致：
//  - 只演一次（`stats.prestigeCelebrated` / `stats.seasonFullCelebrated` 两个账本，进存档）；
//  - 只**读**状态、只发一个 UI 事件，不改任何玩法数值（数据铁律）。
import { EventBus } from './EventBus.js'
import { getSkillDef } from '../data/skills.js'

/**
 * 注册两个庆祝时刻。返回注销函数（App 卸载时调用）。
 * @param {object} player usePlayerStore() 实例
 * @param {object} ui useUiStore() 实例（要提供 celebrate(payload)）
 */
export function initCelebrations(player, ui) {
  const offs = []

  // ① 首次转生：一个技能从此走进「轮回」，是全局第一个大里程碑
  offs.push(EventBus.on('player:prestige', (e) => {
    if (player.stats?.prestigeCelebrated) return
    if (player.stats) player.stats.prestigeCelebrated = true
    const name = getSkillDef(e?.skillId)?.name ?? e?.skillId ?? '技能'
    ui.celebrate?.({
      icon: '♻️',
      title: '首次转生 · 踏入轮回',
      sub: `「${name}」回到 Lv${1 + (e?.carry ?? 0)}（含师徒传承 ${e?.carry ?? 0} 级），`
        + `该技能永久 <b>+20%</b> 经验，等级上限突破到 120 —— 轮回印记可用于「厨神之路」。`,
      tone: 'gold',
    })
  }))

  // ② 首次把某季十档全部领满（`season:claim` 的 full 由 player.seasonClaimTier 给出）
  offs.push(EventBus.on('season:claim', (e) => {
    if (!e?.full) return
    if (player.stats?.seasonFullCelebrated) return
    if (player.stats) player.stats.seasonFullCelebrated = true
    ui.celebrate?.({
      icon: '🎪',
      title: '赛季奖励全部领满！',
      sub: `「${e?.seasonName ?? e?.name ?? '本赛季'}」十档奖励已全部到手。`
        + `赛季点数按任务累计，下一个赛季已在路上。`,
      tone: 'primary',
    })
  }))

  return () => offs.forEach((off) => { try { off() } catch { /* 已注销 */ } })
}
