// 卡牌对战核心逻辑（2026-09-06 重构：从 LogView.vue 抽出为纯逻辑层，可单测）
// 玩法（2026-09-06 平衡优化）：
//  - 战力公式统一量纲：tier×15 + 回血 + 装备攻击×3 + 价值×5%（料理/装备同池可比）
//  - 每局战力 ±12% 浮动（避免纯数学必胜，加入抉择变数）
//  - AI 与玩家同池（已收集的料理+装备），强度对称；难度三档调整 AI 战力与奖励倍率
//  - 奖励：胜 50×难度倍率；每日首胜额外 +50；整体首胜额外 +能量饼干（保留原规格）
import { getItem, ITEMS } from './items.js'
import { useUiStore } from '../../stores/ui.js'

/** 难度档：AI 战力倍率 / 奖励倍率 */
export const DIFFICULTIES = {
  easy: { label: '休闲', aiMult: 0.85, rewardMult: 1 },
  normal: { label: '标准', aiMult: 1, rewardMult: 1.5 },
  hard: { label: '挑战', aiMult: 1.2, rewardMult: 2.5 },
}

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

/** 卡牌战力（统一量纲：档位主导 + 回血/攻击主属性 + 5% 价值） */
export function cardStrength(id) {
  const it = getItem(id)
  if (!it) return 0
  const atk = Number(it.stats?.attack ?? 0)
  return it.tier * 15 + (it.heal ?? 0) + atk * 3 + it.value * 0.05
}

/** 卡牌收藏池：已收集的料理/装备（排序后） */
export function cardPoolFrom(collected) {
  return Object.keys(collected ?? {})
    .filter((id) => { const it = getItem(id); return it && (it.type === 'food' || it.type === 'equipment') })
    .sort()
}

/** AI 卡组：玩家已收集的料理+装备同池抽 3（不足时全库补齐，保证 3 局满员） */
export function pickAi(collected, rng = Math.random) {
  let aiPool = Object.keys(collected ?? {}).filter((id) => {
    const it = ITEMS[id]
    return it && (it.type === 'food' || it.type === 'equipment')
  })
  if (aiPool.length < 3) {
    aiPool = [...aiPool, ...Object.keys(ITEMS).filter((id) => {
      const it = ITEMS[id]
      return it && (it.type === 'food' || it.type === 'equipment')
    })]
  }
  const shuffled = [...aiPool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

/** 本地日期键（跨午夜刷新先例对齐 daily.todayKey） */
export function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
}

/**
 * 模拟一局卡牌对战（纯函数，rng/难度可注入便于测试）
 * @param {string[]} mineIds 我方卡（已收集 id）
 * @param {object} collected 玩家收集表 {id: true}
 * @param {{rng?:Function, difficulty?:keyof DIFFICULTIES}} opts
 * @returns {{won:boolean, rounds:Array<{mine,theirs,ms,ts,win,rawMs,rawTs}>, diff:string}}
 */
export function simulateBattle(mineIds, collected, opts = {}) {
  const rng = opts.rng ?? Math.random
  const diff = DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'normal'
  const { aiMult } = DIFFICULTIES[diff] ?? DIFFICULTIES.normal
  const ai = pickAi(collected, rng)
  const variance = (rng) => 0.88 + rng() * 0.24 // ±12% 浮动
  let wins = 0
  const rounds = []
  for (let i = 0; i < 3; i++) {
    const mine = mineIds[i] ?? null
    const theirs = ai[i] ?? null
    const rawMs = mine ? cardStrength(mine) : 0
    const rawTs = theirs ? cardStrength(theirs) : 0
    const ms = mine ? (rawMs * variance(rng)) : 0
    const ts = theirs ? (rawTs * aiMult * variance(rng)) : 0
    const win = ms > ts
    rounds.push({ mine, theirs, ms, ts, win, rawMs, rawTs })
    if (win) wins++
  }
  return { won: wins >= 2, rounds, diff }
}

/**
 * 结算并记账（玩家侧写入）
 * @returns {{reward:number, dailyBonus:number, firstBonus:boolean}}
 */
export function settleBattle(player, result, difficulty = 'normal') {
  const { rewardMult } = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal
  let reward = 0
  let dailyBonus = 0
  let firstBonus = false
  if (result.won) {
    reward = Math.round(50 * rewardMult)
    const s = player.stats.cardBattle ?? {}
    // 每日首胜：额外 +50
    const tk = todayKey()
    if (s.day !== tk) {
      s.day = tk
      dailyBonus = 50
    }
    player.gainGold(reward + dailyBonus)
    const isFirst = (s.wins ?? 0) === 0
    s.wins = (s.wins ?? 0) + 1
    if (isFirst) {
      firstBonus = true
      player.gainItem('energyBiscuit', 1)
      try { useUiStore().pushLog('🎉 卡牌对战首胜：额外获得能量饼干 ×1）', 'gain') } catch (e) { /* ignore */ }
    }
  } else {
    player.stats.cardBattle.losses = (player.stats.cardBattle.losses ?? 0) + 1
  }
  return { reward, dailyBonus, firstBonus }
}
