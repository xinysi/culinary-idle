// 食神秘境（2026-09-09 新增）— Roguelike 局内模式：逐层挑战随机对手，每胜一层 3 选 1 临时增益，
// 增益仅在本局生效（每局重置），阵亡结算积分换奖励。复用既有 Combat 引擎与 opp() 生成器，
// 不触碰 COMBAT_REGIONS/BOSS 铁律数据（对手由 opp() 动态生成，与试炼塔同一模式）。
import { opp } from './combat.js'

/** 本局可选增益池（3 选 1；同一增益可叠多层） */
export const REALM_BUFFS = [
  { id: 'atk10', name: '利刃附魔', desc: '攻击 +12%', mod: { attackPct: 12 } },
  { id: 'def10', name: '铁壁护持', desc: '防御 +15%', mod: { defensePct: 15 } },
  { id: 'hp15', name: '饱食之力', desc: '最大品鉴值 +15%', mod: { maxHpPct: 15 } },
  { id: 'crit5', name: '精准调味', desc: '暴击率 +6%', mod: { critChance: 0.06 } },
  { id: 'acc8', name: '香气缠绕', desc: '命中 +10%', mod: { accuracyPct: 10 } },
  { id: 'eva8', name: '油滑身法', desc: '闪避 +8%', mod: { evasionPct: 8 } },
  { id: 'speed8', name: '快刀乱麻', desc: '攻速 +8%', mod: { speedPct: 8 } },
  { id: 'heal12', name: '回春高汤', desc: '每回合回复 3% 最大品鉴值', mod: { healPerTurnPct: 3 } },
  { id: 'gold20', name: '金玉满堂', desc: '本局结算金币 +25%', mod: { goldPct: 25 } },
]

export function realmOpponentLevel(floor, combatLevel) {
  const base = Math.max(1, combatLevel)
  return Math.max(1, Math.min(99, base + Math.floor(floor * 1.5)))
}

/** 本局结算奖励（按层数） */
export function realmReward(floor) {
  const f = Math.max(0, floor)
  return {
    gold: 150 + f * 90,
    items: { mysterySpice: f >= 5 ? 1 : 0, energyBiscuit: f >= 10 ? 1 : 0 },
  }
}

/** 随机抽取 count 个不重复增益（rng 可注入便于测试） */
export function rollRealmChoices(count = 3, rng = Math.random) {
  const pool = [...REALM_BUFFS]
  const out = []
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return out
}

// 秘境对手名（每层后缀层数，便于辨识）
const REALM_NAMES = ['秘境守卫', '幻境厨灵', '迷踪食客', '深渊饕餮', '幻味使者', '虚境刀客', '无名食神']

/** 生成某层的秘境对手（opp() 动态生成，与试炼塔同模式；血量随层数上浮） */
export function realmOpponent(floor, combatLevel, rng = Math.random) {
  const lv = realmOpponentLevel(floor, combatLevel)
  const style = ['knife', 'plating', 'flavor'][Math.floor(rng() * 3)]
  const name = `${REALM_NAMES[Math.floor(rng() * REALM_NAMES.length)]}·第${floor + 1}层`
  const o = opp(lv, name, style, { drops: [{ itemId: 'mysterySpice', chance: 0.03 }] })
  o.hp = Math.max(10, Math.round(o.hp * (1 + floor * 0.06)))
  o.isRealm = true
  return o
}
