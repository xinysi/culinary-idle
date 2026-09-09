// 厨神试炼（2026-09-10 新增）— 限制条件计分挑战：指定对手 + 达成条件 → 首次通关大奖，重复通关给金币。
// 设计约束：对手由 opp() 动态生成（与试炼塔/秘境同模式），不触碰 COMBAT_REGIONS/BOSS 铁律数据。
// 判定所需数据（回合数/剩余血量）由 Combat 的 combat:end 事件附带，只读取、不改战斗公式。
import { opp } from './combat.js'

/** 解锁条件：对决达到该等级 */
export const TRIAL_UNLOCK_LEVEL = 30

/**
 * 试炼定义：
 *   levelOffset 对手等级 = 玩家对决等级 + offset（封顶 99）
 *   cond: { type: 'turns'|'hp'|'streak', value }
 *   reward: 首次通关奖励；重复通关按 30% 金币
 */
export const TRIALS = [
  {
    id: 't_speed', name: '速攻试炼', icon: '⚡', levelOffset: 2,
    desc: '在 12 回合内击败对手（等级 +2）',
    cond: { type: 'turns', value: 12 },
    reward: { gold: 4000, items: { energyBiscuit: 1 } },
  },
  {
    id: 't_flawless', name: '无伤试炼', icon: '🛡️', levelOffset: 2,
    desc: '以 ≥90% 剩余品鉴值击败对手（等级 +2）',
    cond: { type: 'hp', value: 90 },
    reward: { gold: 6000, items: { mysterySpice: 1 } },
  },
  {
    id: 't_overlevel', name: '越级试炼', icon: '🔥', levelOffset: 5,
    desc: '击败高你 5 级的对手',
    cond: { type: 'win', value: 0 },
    reward: { gold: 9000, items: { mysterySpice: 1 } },
  },
  {
    id: 't_streak', name: '连战试炼', icon: '🔗', levelOffset: 1,
    desc: '连续击败 3 位对手（等级 +1，失败即重来）',
    cond: { type: 'streak', value: 3 },
    reward: { gold: 12000, items: { mysterySpice: 2, energyBiscuit: 1 } },
  },
]

const TRIAL_INDEX = new Map(TRIALS.map((t) => [t.id, t]))

export function getTrial(id) {
  return TRIAL_INDEX.get(id) ?? null
}

/** 试炼对手（opp() 动态生成，等级封顶 99） */
export function trialOpponent(def, combatLevel, rng = Math.random) {
  const lv = Math.max(1, Math.min(99, Math.max(1, combatLevel) + (def?.levelOffset ?? 0)))
  const style = ['knife', 'plating', 'flavor'][Math.floor(rng() * 3)]
  const o = opp(lv, `${def.icon} ${def.name}对手`, style, { drops: [] })
  o.isTrial = true
  return o
}

/** 重复通关奖励（首次的 30% 金币） */
export function repeatReward(def) {
  return { gold: Math.round((def?.reward?.gold ?? 0) * 0.3), items: {} }
}
