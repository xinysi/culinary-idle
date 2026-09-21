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

// ── 档位（2026-09-19 参照 Rocky Idle 的 Runs 增加）────────────────────────────
// 参考作的 Runs 是**分档**的（`runs_tiers`、每档有倍率 `this_tier: Nx`），通关推进档位 ⇒ 挑战与回报同步抬升；
// 本作秘境原口径是「单一难度 + 按层结算」，对手等级封顶 99 ⇒ 打到一定程度后没有爬升目标。
export const REALM_TIER_MAX = 10
/** 档位倍率：**对手属性与本局奖励都乘它**（第 1 档 ×1.00 → 第 10 档 ×3.25） */
export function realmTierMult(tier = 1) {
  const t = Math.max(1, Math.min(REALM_TIER_MAX, Math.floor(Number(tier)) || 1))
  return +(1 + 0.25 * (t - 1)).toFixed(2)
}
/** 升档目标：本局**通过** N 层即升 1 档（第 1 档要 6 层 → 第 9 档要 38 层） */
export function realmTierGoal(tier = 1) {
  const t = Math.max(1, Math.min(REALM_TIER_MAX, Math.floor(Number(tier)) || 1))
  return 6 + 4 * (t - 1)
}

export function realmOpponentLevel(floor, combatLevel, tier = 1) {
  const base = Math.max(1, combatLevel)
  const lv = base + Math.floor(floor * 1.5)
  // ⚠️ 原来封顶 **99**：那让「对决 99 之后秘境永远同一难度」。现抬到 140（与挑战塔同口径），
  //    难度增长改由**档位倍率**承担；等级上限只防溢出。
  return Math.max(1, Math.min(140, lv + (Math.max(1, tier) - 1)))
}

/** 本局结算奖励（按层数 × 档位倍率）；深层与高档给**觅珍抽奖券**（货币，不是物品） */
export function realmReward(floor, tier = 1) {
  const f = Math.max(0, floor)
  const mult = realmTierMult(tier)
  const items = {}
  if (f >= 5) items.mysterySpice = 1
  if (f >= 10) items.energyBiscuit = 1
  const tickets = f >= 20 ? Math.floor(f / 10) * Math.max(1, Math.min(REALM_TIER_MAX, Math.floor(tier) || 1)) : 0
  return { gold: Math.round((150 + f * 90) * mult), items, tickets }
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
export function realmOpponent(floor, combatLevel, tier = 1, rng = Math.random) {
  const lv = realmOpponentLevel(floor, combatLevel, tier)
  const style = ['knife', 'plating', 'flavor'][Math.floor(rng() * 3)]
  const name = `${REALM_NAMES[Math.floor(rng() * REALM_NAMES.length)]}·第${floor + 1}层`
  const o = opp(lv, name, style, { drops: [{ itemId: 'mysterySpice', chance: 0.03 }] })
  const mult = realmTierMult(tier)
  o.hp = Math.max(10, Math.round(o.hp * (1 + floor * 0.06) * mult))
  // 档位同时抬攻/防（只抬血量会让高层变成「磨」，抬攻防才是「更难」）
  o.atk = Math.round((o.atk ?? 1) * mult)
  o.def = Math.round((o.def ?? 0) * mult)
  o.isRealm = true
  o.realmTier = Math.max(1, Math.min(REALM_TIER_MAX, Math.floor(Number(tier)) || 1))
  return o
}
