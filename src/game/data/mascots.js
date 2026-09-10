// 吉祥物（2026-09-10 新增）— 餐厅吉祥物：买下后可「每天蹭一次」，给随机小奖励并积累好感。
// 设计约束：奖励全部为既有物品/金币；不新增物品、不改动任何固定数据。

/** 吉祥物：cost 售价、pets 好感等级门槛（蹭的次数）、rewards 每次奖励池 */
export const MASCOTS = [
  { id: 'cat', name: '招财猫', icon: '🐱', cost: 8000, desc: '招财进宝：蹭一蹭常掉金币', goldBase: 300, itemChance: 0.25, items: { mysterySpice: 1 } },
  { id: 'dough', name: '面团小人', icon: '🍞', cost: 15000, desc: '面粉成精：爱送烘焙原料', goldBase: 220, itemChance: 0.5, items: { flour: 5 } },
  { id: 'koi', name: '锦鲤', icon: '🐟', cost: 30000, desc: '好运连连：蹭完常带稀有渔获', goldBase: 260, itemChance: 0.5, items: { goldenDragonFish: 1 } },
  { id: 'stove', name: '灶王玩偶', icon: '🧧', cost: 60000, desc: '灶火相伴：金币更丰厚，偶尔给调料', goldBase: 900, itemChance: 0.3, items: { mysterySpice: 2 } },
  { id: 'pot', name: '铜锅精灵', icon: '🍲', cost: 120000, desc: '锅气十足：给的能量饼干能多挂几小时', goldBase: 1200, itemChance: 0.35, items: { energyBiscuit: 1 } },
]

const MASCOT_INDEX = new Map(MASCOTS.map((m) => [m.id, m]))

export function getMascot(id) {
  return MASCOT_INDEX.get(id) ?? null
}

/** 好感等级：按累计蹭的次数（1/5/15/30/60 次 → Lv1~5），每级奖励 +25% */
export const MASCOT_BOND_STEPS = [1, 5, 15, 30, 60]

export function mascotBondLevel(pets) {
  const n = Math.max(0, Math.floor(pets ?? 0))
  let lv = 0
  for (const s of MASCOT_BOND_STEPS) if (n >= s) lv++
  return lv
}

export function mascotBondProgress(pets) {
  const n = Math.max(0, Math.floor(pets ?? 0))
  const lv = mascotBondLevel(n)
  if (lv >= MASCOT_BOND_STEPS.length) return { level: lv, current: n, needed: n, progress: 1 }
  const base = lv === 0 ? 0 : MASCOT_BOND_STEPS[lv - 1]
  const next = MASCOT_BOND_STEPS[lv]
  return { level: lv, current: n - base, needed: next - base, progress: Math.min(1, (n - base) / (next - base)) }
}

/** 每日奖励：金币 = 基础 ×（1 + 0.25×好感等级），并有机会给吉祥物专属物品 */
export function mascotReward(def, pets, rng = Math.random) {
  const lv = mascotBondLevel(pets)
  const gold = Math.round((def?.goldBase ?? 0) * (1 + 0.25 * lv))
  const items = {}
  if (def?.items && rng() < (def.itemChance ?? 0)) {
    for (const [id, qty] of Object.entries(def.items)) items[id] = qty
  }
  return { gold, items }
}
