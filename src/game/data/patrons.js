// 食神信仰（2026-09-10 新增）— 全局规则层：八位守护神各 3 级信仰，同一时间只信一位。
// 供奉升级永久保留；切换信仰需金币 + 24 小时冷却。效果只挂在既有聚合点（料理回血/技能经验/采集产量/餐厅收入/地窖出窖）。
// 设计约束：不新增物品（供品为既有食材）、不改动任何既有数值。

/** 供品数量随等级递增；金币花费也随等级递增 */
export const PATRON_MAX_LEVEL = 3

export const PATRONS = [
  { id: 'p_stove', name: '灶君', icon: '🔥', offer: ['salt', 'soySauce'], effect: { healPct: 8 }, desc: '料理回血 +8% / 级' },
  { id: 'p_wine', name: '酒神', icon: '🍶', offer: ['riceWine', 'grape'], effect: { cellarPct: 12 }, desc: '地窖出窖金币 +12% / 级' },
  { id: 'p_blade', name: '刀灵', icon: '🔪', offer: ['ironOre', 'silverOre'], effect: { xpSkills: { knife: 6, plating: 6, flavorArtistry: 6 } }, desc: '刀工/摆盘/调味经验 +6% / 级' },
  { id: 'p_field', name: '农神', icon: '🌾', offer: ['wheat', 'corn'], effect: { yieldPct: 6 }, desc: '采集产量 +6% / 级' },
  { id: 'p_hunt', name: '猎神', icon: '🏹', offer: ['trap', 'pheasantEgg'], effect: { xpSkills: { hunting: 8, fishing: 8 } }, desc: '狩猎/垂钓经验 +8% / 级' },
  { id: 'p_market', name: '商神', icon: '💰', offer: ['goldOre', 'silverOre'], effect: { incomePct: 8 }, desc: '餐厅收入 +8% / 级' },
  { id: 'p_scholar', name: '书神', icon: '📚', offer: ['flour', 'milk'], effect: { xpPct: 4 }, desc: '全技能经验 +4% / 级' },
  { id: 'p_cellar', name: '窖神', icon: '🕯️', offer: ['pickled_ext_01', 'bambooShoot'], effect: { yieldPct: 4, incomePct: 4 }, desc: '采集产量 +4% / 级、餐厅收入 +4% / 级' },
]

const PATRON_INDEX = new Map(PATRONS.map((p) => [p.id, p]))

export function getPatron(id) {
  return PATRON_INDEX.get(id) ?? null
}

/** 供奉到第 level 级的花费：供品 5×level、金币 6000×level² */
export function patronCost(def, level) {
  const lv = Math.max(1, Math.min(PATRON_MAX_LEVEL, Math.round(level)))
  const mats = {}
  for (const id of def?.offer ?? []) mats[id] = 5 * lv
  return { mats, gold: 6000 * lv * lv }
}

/** 切换信仰的金币与冷却 */
export const PATRON_SWITCH_GOLD = 12000
export const PATRON_SWITCH_COOLDOWN_MS = 24 * 3600_000

/** 把某守护神的效果按等级展开为聚合效果 */
export function patronEffectAt(def, level) {
  const out = { healPct: 0, yieldPct: 0, incomePct: 0, cellarPct: 0, xpPct: 0, xpSkills: {} }
  const lv = Math.max(0, Math.min(PATRON_MAX_LEVEL, level ?? 0))
  if (!def || lv <= 0) return out
  const e = def.effect ?? {}
  out.healPct = (e.healPct ?? 0) * lv
  out.yieldPct = (e.yieldPct ?? 0) * lv
  out.incomePct = (e.incomePct ?? 0) * lv
  out.cellarPct = (e.cellarPct ?? 0) * lv
  out.xpPct = (e.xpPct ?? 0) * lv
  for (const [k, v] of Object.entries(e.xpSkills ?? {})) out.xpSkills[k] = v * lv
  return out
}
