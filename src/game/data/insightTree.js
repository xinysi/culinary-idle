// 菜系图谱（2026-09-09 新增）— 永久天赋树：用「美食见闻」解锁节点，提供永久加成。
// 见闻获取：图鉴首次收集 +1 / 成就解锁 +5 / 赛季领档 +3 / 首次击败首领 +2。
// 纯新增层：效果只在聚合处叠加（经验/产量/成功率/对决），不改动任何固定数据。
export const INSIGHT_BRANCHES = [
  { id: 'gather', name: '采集线', icon: '🌿' },
  { id: 'craft', name: '制作线', icon: '🍳' },
  { id: 'combat', name: '对决线', icon: '⚔️' },
]

/** 节点：cost 为美食见闻；requires 为前置节点 id；effect 为叠加到聚合层的加成 */
export const INSIGHT_NODES = [
  // 采集线
  { id: 'g1', branch: 'gather', name: '眼明手快', cost: 10, requires: [], effect: { yieldPct: 3 }, desc: '采集产量 +3%' },
  { id: 'g2', branch: 'gather', name: '熟能生巧', cost: 20, requires: ['g1'], effect: { xpPct: 3 }, desc: '全技能经验 +3%' },
  { id: 'g3', branch: 'gather', name: '田野之友', cost: 40, requires: ['g2'], effect: { yieldPct: 5 }, desc: '采集产量 +5%' },
  { id: 'g4', branch: 'gather', name: '大地馈赠', cost: 80, requires: ['g3'], effect: { xpPct: 5 }, desc: '全技能经验 +5%' },
  // 制作线
  { id: 'c1', branch: 'craft', name: '火候精研', cost: 10, requires: [], effect: { craftPct: 3 }, desc: '制作成功率 +3%' },
  { id: 'c2', branch: 'craft', name: '配方巧思', cost: 20, requires: ['c1'], effect: { xpPct: 3 }, desc: '全技能经验 +3%' },
  { id: 'c3', branch: 'craft', name: '匠心独运', cost: 40, requires: ['c2'], effect: { craftPct: 5 }, desc: '制作成功率 +5%' },
  { id: 'c4', branch: 'craft', name: '名厨之路', cost: 80, requires: ['c3'], effect: { xpPct: 5 }, desc: '全技能经验 +5%' },
  // 对决线
  { id: 'b1', branch: 'combat', name: '刀锋直觉', cost: 10, requires: [], effect: { attackPct: 3 }, desc: '攻击 +3%' },
  { id: 'b2', branch: 'combat', name: '厚味护体', cost: 20, requires: ['b1'], effect: { defensePct: 3 }, desc: '防御 +3%' },
  { id: 'b3', branch: 'combat', name: '饱食之躯', cost: 40, requires: ['b2'], effect: { maxHpPct: 5 }, desc: '最大品鉴值 +5%' },
  { id: 'b4', branch: 'combat', name: '食神威压', cost: 80, requires: ['b3'], effect: { attackPct: 5, defensePct: 5 }, desc: '攻击/防御 +5%' },
]

export function getInsightNode(id) {
  return INSIGHT_NODES.find((n) => n.id === id) ?? null
}

/** 已解锁节点的效果合计 */
export function insightEffectSum(unlocked = []) {
  const out = { xpPct: 0, yieldPct: 0, craftPct: 0, attackPct: 0, defensePct: 0, maxHpPct: 0 }
  for (const id of unlocked) {
    const def = getInsightNode(id)
    if (!def) continue
    for (const [k, v] of Object.entries(def.effect)) out[k] = (out[k] ?? 0) + v
  }
  return out
}

/** 节点是否可解锁（前置齐全 + 见闻足够） */
export function canUnlockInsight(id, unlocked = [], insights = 0) {
  const def = getInsightNode(id)
  if (!def) return { ok: false, msg: '节点不存在' }
  if (unlocked.includes(id)) return { ok: false, msg: '已解锁' }
  for (const r of def.requires) if (!unlocked.includes(r)) return { ok: false, msg: '前置节点未解锁' }
  if (insights < def.cost) return { ok: false, msg: `美食见闻不足（需 ${def.cost}）` }
  return { ok: true }
}
