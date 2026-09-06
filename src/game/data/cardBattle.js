// 卡牌对战核心逻辑（2026-09-06 重构：从 LogView.vue 抽出为纯逻辑层，可单测）
// 玩法规格不变：已收集的料理/装备为卡、选 3 张、AI 从料理卡池抽 3 张、3 局 2 胜、胜 +50 金、首胜 +能量饼干。
import { getItem, ITEMS } from './items.js'
import { useUiStore } from '../../stores/ui.js'

/** 卡牌边框色（稀有度/品质/等级） */
export function cardColor(id) {
  const it = getItem(id)
  if (!it) return 'var(--border)'
  if (it.quality === '神话') return 'var(--bad-strong)'
  if (it.quality === '传说') return 'var(--warn-strong)'
  if (it.type === 'equipment') return '#7b1fa2'
  if (it.tier >= 8) return 'var(--bad-strong)'
  if (it.tier >= 5) return 'var(--warn-strong)'
  if (it.tier >= 3) return 'var(--info)'
  return 'var(--muted)'
}

/** 卡牌战力（与原实现一致：回血 + 价值×0.5 + 档位×3） */
export function cardStrength(id) {
  const it = getItem(id)
  if (!it) return 0
  return (it.heal ?? 0) + it.value * 0.5 + it.tier * 3
}

/** 卡牌收藏池：已收集的料理/装备（排序后） */
export function cardPoolFrom(collected) {
  return Object.keys(collected ?? {})
    .filter((id) => { const it = getItem(id); return it && (it.type === 'food' || it.type === 'equipment') })
    .sort()
}

/** AI 卡组：玩家已收集料理池抽 3（不足时全料理池补足，保证 3 局满员） */
export function pickAi(collected, rng = Math.random) {
  let aiPool = Object.keys(collected ?? {}).filter((id) => ITEMS[id]?.type === 'food')
  if (aiPool.length < 3) {
    aiPool = [...aiPool, ...Object.keys(ITEMS).filter((id) => ITEMS[id]?.type === 'food')]
  }
  const shuffled = [...aiPool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

/**
 * 模拟一局卡牌对战（纯函数，rng 可注入便于测试）
 * @returns {{won:boolean, rounds:Array<{mine,theirs,ms,ts,win}>}}
 */
export function simulateBattle(mineIds, collected, rng = Math.random) {
  const ai = pickAi(collected, rng)
  let wins = 0
  const rounds = []
  for (let i = 0; i < 3; i++) {
    const mine = mineIds[i] ?? null
    const theirs = ai[i] ?? null
    const ms = mine ? cardStrength(mine) : 0
    const ts = theirs ? cardStrength(theirs) : 0
    const win = ms > ts
    rounds.push({ mine, theirs, ms, ts, win })
    if (win) wins++
  }
  return { won: wins >= 2, rounds }
}

/** 结算奖励并记账（玩家侧写入；与旧实现行为一致，含首胜能量饼干） */
export function settleBattle(player, result) {
  let firstWinBonus = false
  if (result.won) {
    player.gainGold(50)
    const isFirst = (player.stats.cardBattle?.wins ?? 0) === 0
    player.stats.cardBattle.wins++
    if (isFirst) {
      firstWinBonus = true
      player.gainItem('energyBiscuit', 1)
      try { useUiStore().pushLog('🎉 卡牌对战首胜：额外获得能量饼干 ×1）', 'gain') } catch (e) { /* ignore */ }
    }
  } else {
    player.stats.cardBattle.losses++
  }
  return firstWinBonus
}
